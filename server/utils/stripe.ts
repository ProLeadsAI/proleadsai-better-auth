import { stripe } from '@better-auth/stripe'
import { and, eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { member as memberTable, organization as organizationTable } from '~~/server/db/schema'
import { PAID_TIERS } from '~~/shared/utils/plans'
import { logAuditEvent } from './auditLogger'
import { resetUsageFromSubscription } from './credits'
import { useDB } from './db'
import { runtimeConfig } from './runtimeConfig'
import {
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionConfirmedEmail,
  sendSubscriptionExpiredEmail
} from './stripeEmails'

/**
 * STRIPE ORGANIZATION BILLING IMPLEMENTATION
 *
 * 1. Customer Creation:
 *    - Customers are created for ORGANIZATIONS, not Users.
 *    - `ensureStripeCustomer(organizationId)` is called explicitly (e.g. before checkout).
 *    - It fetches the Organization and its Owner (for email).
 *    - It creates a Stripe Customer with metadata `organizationId`.
 *    - The Stripe Customer ID is stored in `organization.stripeCustomerId`.
 *
 * 2. Webhook Handling:
 *    - Webhooks are handled by Better Auth's `stripe` plugin.
 *    - The `addPaymentLog` function processes events.
 *    - It retrieves the Organization using `getOrgByStripeCustomerId`.
 *    - Logs are associated with the Organization (via details) and marked as 'system' user actions.
 *
 * 3. Metadata:
 *    - `ownerUserId` is stored in metadata to track the initiator.
 *    - `organizationId` is the primary reference.
 */

export const createStripeClient = () => {
  return new Stripe(runtimeConfig.stripeSecretKey!)
}

export const ensureStripeCustomer = async (organizationId: string) => {
  const client = createStripeClient()
  const db = await useDB()

  console.log('[Stripe Debug] ensureStripeCustomer called for:', organizationId)

  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.id, organizationId)
  })

  if (!org) {
    throw new Error('Organization not found')
  }

  console.log('[Stripe Debug] Organization found:', {
    id: org.id,
    name: org.name,
    stripeCustomerId: org.stripeCustomerId
  })

  // Check if customer already exists in database AND Stripe
  if (org.stripeCustomerId) {
    console.log('[Stripe Debug] Customer found in database:', org.stripeCustomerId)
    try {
      // Verify customer actually exists in Stripe
      await client.customers.retrieve(org.stripeCustomerId)
      console.log('[Stripe Debug] Customer verified in Stripe:', org.stripeCustomerId)
      return { id: org.stripeCustomerId }
    } catch (error) {
      console.log('[Stripe Debug] Customer NOT found in Stripe, will create new one:', error.message)
      // Customer exists in database but not in Stripe, continue to create new one
    }
  }

  // Fetch Owner for email
  const member = await db.query.member.findFirst({
    where: and(
      eq(memberTable.organizationId, organizationId),
      eq(memberTable.role, 'owner')
    ),
    with: { user: true }
  })

  const email = member?.user.email

  // Create new customer if not exists
  const customerParams: Stripe.CustomerCreateParams = {
    name: org.name,
    metadata: {
      organizationId: org.id,
      ownerUserId: member?.user.id || ''
    }
  }

  if (email) {
    customerParams.email = email
  }

  const customer = await client.customers.create(customerParams)

  // Update organization with stripe customer id
  await db.update(organizationTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizationTable.id, organizationId))

  return customer
}

const getOrgByStripeCustomerId = async (stripeCustomerId: string) => {
  const db = await useDB()
  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.stripeCustomerId, stripeCustomerId)
  })
  return org
}

/**
 * Sync Stripe customer name with organization name (shows on invoices).
 * Called after subscription events to ensure the customer name stays as the org name
 * (not the cardholder name from payment method).
 * @param organizationId - The organization ID
 * @param newName - Optional: pass the new name directly to avoid DB race conditions
 */
export const syncStripeCustomerName = async (organizationId: string, newName?: string) => {
  const db = await useDB()
  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.id, organizationId)
  })

  if (!org?.stripeCustomerId)
    return

  const nameToSync = newName || org.name
  const client = createStripeClient()
  await client.customers.update(org.stripeCustomerId, {
    name: nameToSync
  })
  console.log(`[Stripe] Synced customer ${org.stripeCustomerId} name to "${nameToSync}"`)
}

export const addPaymentLog = async (action: string, subscription: any) => {
  // Handle both Better Auth subscription object and raw Stripe subscription object
  const customerId = subscription.stripeCustomerId ||
    (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id)

  if (!customerId)
    return

  const org = await getOrgByStripeCustomerId(customerId)
  if (!org)
    return

  await logAuditEvent({
    userId: undefined, // Webhook event, no specific user
    category: 'payment',
    action: `${action}:${subscription.plan?.id || subscription.plan?.name || 'unknown'}`,
    targetType: 'stripeCustomerId',
    targetId: customerId,
    status: 'success',
    details: `Organization: ${org.name} (${org.id})`
  })
}

export const setupStripe = () => stripe({
  stripeClient: createStripeClient(),
  stripeWebhookSecret: runtimeConfig.stripeWebhookSecret,
  onEvent: async (event) => {
    // Handle payment_intent.payment_failed - send email when card is declined
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const customerId = typeof paymentIntent.customer === 'string'
        ? paymentIntent.customer
        : paymentIntent.customer?.id

      if (customerId) {
        console.log('[Stripe] Payment failed for customer:', customerId, 'Amount:', paymentIntent.amount, 'PI:', paymentIntent.id)
        // sendPaymentFailedEmail has built-in deduplication using KV storage
        await sendPaymentFailedEmail(customerId, paymentIntent.amount, paymentIntent.id)
      }
    }
  },
  createCustomerOnSignUp: false, // Disable for Org-based billing
  subscription: {
    enabled: true,
    getSubscriptionReference: async (subscription: any) => {
      // Try to get organizationId from metadata first
      if (subscription.metadata?.organizationId) {
        return subscription.metadata.organizationId
      }

      // Fallback to stripeCustomerId lookup
      let customerId = subscription.stripeCustomerId
      if (!customerId) {
        if (typeof subscription.customer === 'string') {
          customerId = subscription.customer
        } else if (subscription.customer && typeof subscription.customer === 'object' && 'id' in subscription.customer) {
          customerId = subscription.customer.id
        }
      }

      if (customerId) {
        const org = await getOrgByStripeCustomerId(customerId)
        if (org) {
          return org.id
        }
      }

      return null
    },
    authorizeReference: async ({ user, referenceId }, ctx) => {
      const db = await useDB()
      const member = await db.query.member.findFirst({
        where: and(
          eq(memberTable.organizationId, referenceId),
          eq(memberTable.userId, user.id)
        )
      })

      // Allow all members to view subscription data (for badges, etc.)
      if (member) {
        // For read-only operations (GET requests), allow all members
        if (ctx?.method === 'GET') {
          return true
        }

        // For write operations (POST, PUT, DELETE), only allow owners
        if (member.role === 'owner') {
          // Ensure Stripe Customer exists for the Organization before allowing action
          console.log('[Stripe Debug] Calling ensureStripeCustomer for:', referenceId)
          await ensureStripeCustomer(referenceId)
          console.log('[Stripe Debug] ensureStripeCustomer completed for:', referenceId)
          return true
        }
      }

      return false
    },
    getCheckoutSessionParams: async ({ session, plan }, ctx) => {
      let customerId
      const body = ctx?.body as any
      const activeOrganizationId = (session as any)?.activeOrganizationId

      const targetOrgId = body?.referenceId || activeOrganizationId

      console.log('[Stripe Debug] getCheckoutSessionParams:', {
        activeOrganizationId,
        targetOrgId,
        bodyReferenceId: body?.referenceId,
        planId: plan?.id
      })

      if (targetOrgId) {
        const db = await useDB()
        const organization = await db.query.organization.findFirst({
          where: eq(organizationTable.id, targetOrgId)
        })

        console.log('[Stripe Debug] Organization found:', {
          id: organization?.id,
          name: organization?.name,
          stripeCustomerId: organization?.stripeCustomerId
        })

        if (organization?.stripeCustomerId) {
          customerId = organization.stripeCustomerId
          console.log('[Stripe Debug] Using customer ID from database:', customerId)
        } else {
          console.log('[Stripe Debug] No customer ID found in database, will create new customer')
        }
      }

      // Build checkout params (no per-seat billing)
      const params: any = {
        customer: customerId,
        allow_promotion_codes: true,
        line_items: [{
          price: plan.priceId,
          quantity: 1
        }],
        tax_id_collection: {
          enabled: true
        },
        billing_address_collection: 'required',
        metadata: {
          ...(body?.metadata || {}),
          organizationId: targetOrgId
        }
      }

      console.log('[Stripe Debug] Final checkout params:', {
        customer: customerId,
        planId: plan.id,
        targetOrgId
      })

      return { params }
    },
    plans: async () => {
      // Generate plans dynamically from PLAN_TIERS (no trials, no per-seat billing)
      const plans: any[] = []

      for (const tier of PAID_TIERS) {
        plans.push({
          name: tier.monthly.id,
          priceId: tier.monthly.priceId
        })
      }

      return plans
    },
    onSubscriptionComplete: async ({ subscription }) => {
      await addPaymentLog('subscription_created', subscription)
      if (subscription.referenceId) {
        await syncStripeCustomerName(subscription.referenceId)
        await resetUsageFromSubscription(subscription, subscription.referenceId)
        await sendSubscriptionConfirmedEmail(subscription.referenceId, subscription)
      }
    },
    onSubscriptionUpdate: async ({ subscription }) => {
      console.log('[Stripe] onSubscriptionUpdate fired:', {
        referenceId: subscription.referenceId,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      })
      await addPaymentLog('subscription_updated', subscription)
      if (subscription.referenceId) {
        await syncStripeCustomerName(subscription.referenceId)
        await resetUsageFromSubscription(subscription, subscription.referenceId)

        if (subscription.cancelAtPeriodEnd) {
          console.log('[Stripe] Subscription scheduled for cancellation, sending cancellation email')
          await sendSubscriptionCanceledEmail(subscription.referenceId, subscription)
        }
      }
    },
    onSubscriptionCancel: async ({ subscription }) => {
      await addPaymentLog('subscription_canceled', subscription)
    },
    onSubscriptionDeleted: async ({ subscription }) => {
      await addPaymentLog('subscription_deleted', subscription)
      if (subscription.referenceId) {
        await sendSubscriptionExpiredEmail(subscription.referenceId, subscription)
      }
    }
  }
})
