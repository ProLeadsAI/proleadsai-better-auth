import type { Subscription } from '@better-auth/stripe'
import { stripe } from '@better-auth/stripe'
import { eq, and } from 'drizzle-orm'
import Stripe from 'stripe'
import { PLANS } from '../../shared/utils/plans'
import { organization as organizationTable, member as memberTable } from '../database/schema'
import { logAuditEvent } from './auditLogger'
import { useDB } from './db'
import { runtimeConfig } from './runtimeConfig'

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

const createStripeClient = () => {
  return new Stripe(runtimeConfig.stripeSecretKey!)
}

export const ensureStripeCustomer = async (organizationId: string) => {
  const client = createStripeClient()
  const db = await useDB()
  
  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.id, organizationId)
  })

  if (!org) {
    throw new Error('Organization not found')
  }

  // Check if customer already exists
  if (org.stripeCustomerId) {
    return { id: org.stripeCustomerId }
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

const addPaymentLog = async (action: string, subscription: Subscription) => {
  const org = await getOrgByStripeCustomerId(subscription.stripeCustomerId!)
  if (!org) return

  await logAuditEvent({
    userId: undefined, // Webhook event, no specific user
    category: 'payment',
    action: `${action}:${subscription.plan}`,
    targetType: 'stripeCustomerId',
    targetId: subscription.stripeCustomerId,
    status: 'success',
    details: `Organization: ${org.name} (${org.id})`
  })
}

export const setupStripe = () => stripe({
  stripeClient: createStripeClient(),
  stripeWebhookSecret: runtimeConfig.stripeWebhookSecret,
  onEvent: async (event) => {
    // console.log('Stripe Webhook Received:', event.type, event.id)
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
    authorizeReference: async ({ user, referenceId }) => {
      const db = await useDB()
      const member = await db.query.member.findFirst({
        where: and(
          eq(memberTable.organizationId, referenceId),
          eq(memberTable.userId, user.id)
        )
      })
      
      if (member?.role === 'owner') {
        // Ensure Stripe Customer exists for the Organization before allowing action
        await ensureStripeCustomer(referenceId)
        return true
      }
      
      return false
    },
    getCheckoutSessionParams: async ({ user, session, plan, subscription }, ctx) => {
      // Try to find referenceId from the request body if available
      let customerId = undefined
      const body = ctx?.body as any
      
      if (body?.referenceId) {
          // We need to look up the org by ID
          const db = await useDB()
          const organization = await db.query.organization.findFirst({
              where: eq(organizationTable.id, body.referenceId)
          })
          if (organization?.stripeCustomerId) {
              customerId = organization.stripeCustomerId
          }
      }

      return {
        params: {
          customer: customerId, // Explicitly set the Org's customer ID
          allow_promotion_codes: true,
          tax_id_collection: {
            enabled: true
          },
          billing_address_collection: 'required',
          metadata: {
             // Ensure metadata is preserved/set
             ...(body?.metadata || {})
          }
        }
      }
    },
    plans: async () => {
      const plans = [
        {
          name: 'pro-monthly',
          priceId: runtimeConfig.stripePriceIdProMonth,
          freeTrial: {
            days: 14,
            onTrialStart: async (subscription: Subscription) => {
              await addPaymentLog('trial_start', subscription)
            },
            onTrialEnd: async ({ subscription }: { subscription: Subscription }) => {
              await addPaymentLog('trial_end', subscription)
            },
            onTrialExpired: async (subscription: Subscription) => {
              await addPaymentLog('trial_expired', subscription)
            }
          }
        },
        {
          name: 'pro-yearly',
          priceId: runtimeConfig.stripePriceIdProYear,
          freeTrial: {
            days: 14,
            onTrialStart: async (subscription: Subscription) => {
              await addPaymentLog('trial_start', subscription)
            },
            onTrialEnd: async ({ subscription }: { subscription: Subscription }) => {
              await addPaymentLog('trial_end', subscription)
            },
            onTrialExpired: async (subscription: Subscription) => {
              await addPaymentLog('trial_expired', subscription)
            }
          }
        }
      ]
      // console.log('Stripe Configured Plans:', JSON.stringify(plans, null, 2))
      return plans
    },
    onSubscriptionComplete: async ({ subscription }) => {
      await addPaymentLog('subscription_created', subscription)
    },
    onSubscriptionUpdate: async ({ subscription }) => {
      await addPaymentLog('subscription_updated', subscription)
    },
    onSubscriptionCancel: async ({ subscription }) => {
      await addPaymentLog('subscription_canceled', subscription)
    },
    onSubscriptionDeleted: async ({ subscription }) => {
      await addPaymentLog('subscription_deleted', subscription)
    }
  }
})
