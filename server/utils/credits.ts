/**
 * Credit Usage Service
 *
 * Handles credit consumption, enforcement, and billing cycle resets.
 * Credits are tracked per-organization in the organization_usage table.
 */

import type { CreditAction } from '~~/shared/utils/credits'
import { eq, sql } from 'drizzle-orm'
import { creditActivity, organizationUsage, subscription as subscriptionTable } from '~~/server/db/schema'
import { CREDIT_COSTS } from '~~/shared/utils/credits'
import { FREE_LIMITS, getPlanLimits } from '~~/shared/utils/plans'
import { useDB } from './db'

// =============================================================================
// GET ACTIVE SUBSCRIPTION
// =============================================================================

/**
 * Get the active or trialing subscription for an organization.
 * Returns null if no valid subscription exists (free tier).
 */
export async function getActiveSubscription(organizationId: string) {
  const db = await useDB()
  const subs = await db.query.subscription.findMany({
    where: eq(subscriptionTable.referenceId, organizationId)
  })

  return subs.find(
    s => s.status === 'active' || s.status === 'trialing'
  ) || null
}

// =============================================================================
// RESET USAGE FROM SUBSCRIPTION
// =============================================================================

/**
 * Reset credit usage for a new billing cycle.
 * Called on subscription renewal/creation and when billing period has elapsed.
 */
export async function resetUsageFromSubscription(
  sub: { periodStart?: Date | null, periodEnd?: Date | null },
  organizationId: string
) {
  const db = await useDB()

  const periodStart = sub.periodStart || new Date()
  const periodEnd = sub.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Upsert: insert if not exists, reset if exists
  await db
    .insert(organizationUsage)
    .values({
      organizationId,
      creditsUsed: 0,
      periodStart,
      periodEnd
    })
    .onConflictDoUpdate({
      target: organizationUsage.organizationId,
      set: {
        creditsUsed: 0,
        periodStart,
        periodEnd,
        updatedAt: new Date()
      }
    })

  return db.query.organizationUsage.findFirst({
    where: eq(organizationUsage.organizationId, organizationId)
  })
}

// =============================================================================
// INITIALIZE FREE TIER USAGE
// =============================================================================

/**
 * Initialize usage row for free-tier orgs (no subscription).
 * Period = 30 days from now.
 */
async function initFreeUsage(organizationId: string) {
  const db = await useDB()
  const now = new Date()
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  await db
    .insert(organizationUsage)
    .values({
      organizationId,
      creditsUsed: 0,
      periodStart: now,
      periodEnd
    })
    .onConflictDoUpdate({
      target: organizationUsage.organizationId,
      set: {
        creditsUsed: 0,
        periodStart: now,
        periodEnd,
        updatedAt: now
      }
    })

  return db.query.organizationUsage.findFirst({
    where: eq(organizationUsage.organizationId, organizationId)
  })
}

// =============================================================================
// CONSUME CREDITS (WITH CONCURRENCY PROTECTION)
// =============================================================================

/**
 * Consume credits for an action. Throws if over limit.
 *
 * Uses an atomic UPDATE ... WHERE check to prevent race conditions:
 * the row is only updated if credits_used + cost <= maxCredits.
 * If 0 rows are affected, the org is out of credits.
 */
// Action labels for display in the activity timeline
const ACTION_LABELS: Record<CreditAction, string> = {
  search: 'Roof estimate search',
  lead_submit: 'Lead submission'
}

export async function consumeCredits({
  organizationId,
  action,
  description,
  metadata
}: {
  organizationId: string
  action: CreditAction
  description?: string
  metadata?: Record<string, any>
}) {
  const cost = CREDIT_COSTS[action]
  const db = await useDB()

  // 1. Determine credit limit from subscription or free tier
  const sub = await getActiveSubscription(organizationId)
  const planLimits = sub ? getPlanLimits(sub.plan) : FREE_LIMITS
  const maxCredits = planLimits.credits

  // null = unlimited credits
  if (maxCredits === null) {
    // Still track usage for reporting, but no enforcement
    await ensureUsageRow(organizationId, sub)

    // Atomic increment without limit check
    await db.execute(
      sql`UPDATE organization_usage
          SET credits_used = credits_used + ${cost}, updated_at = NOW()
          WHERE organization_id = ${organizationId}`
    )

    // Log activity
    await logCreditActivity(db, organizationId, action, cost, description, metadata)
    return
  }

  // 2. Ensure usage row exists and is current
  await ensureUsageRow(organizationId, sub)

  // 3. Atomic consume with limit check
  //    Only updates if credits_used + cost <= maxCredits
  const result = await db.execute(
    sql`UPDATE organization_usage
        SET credits_used = credits_used + ${cost}, updated_at = NOW()
        WHERE organization_id = ${organizationId}
          AND credits_used + ${cost} <= ${maxCredits}`
  )

  // rowCount is available on the result for pg
  const rowsAffected = (result as any).rowCount ?? (result as any).changes ?? 0

  if (rowsAffected === 0) {
    throw createError({
      statusCode: 403,
      statusMessage: 'OUT_OF_CREDITS',
      message: 'You have used all your credits for this billing period. Please upgrade your plan.'
    })
  }

  // 4. Log activity
  await logCreditActivity(db, organizationId, action, cost, description, metadata)
}

export async function exhaustCreditsForGrace({
  organizationId,
  action,
  description,
  metadata
}: {
  organizationId: string
  action: CreditAction
  description?: string
  metadata?: Record<string, any>
}) {
  const db = await useDB()
  const sub = await getActiveSubscription(organizationId)
  const planLimits = sub ? getPlanLimits(sub.plan) : FREE_LIMITS
  const maxCredits = planLimits.credits

  if (maxCredits === null) {
    await logCreditActivity(db, organizationId, action, CREDIT_COSTS[action], description, metadata)
    return
  }

  await ensureUsageRow(organizationId, sub)

  await db.execute(
    sql`UPDATE organization_usage
        SET credits_used = ${maxCredits}, updated_at = NOW()
        WHERE organization_id = ${organizationId}
          AND credits_used < ${maxCredits}`
  )

  await logCreditActivity(db, organizationId, action, CREDIT_COSTS[action], description, metadata)
}

/**
 * Log a credit activity event for the timeline.
 */
async function logCreditActivity(
  db: Awaited<ReturnType<typeof useDB>>,
  organizationId: string,
  action: CreditAction,
  cost: number,
  description?: string,
  metadata?: Record<string, any>
) {
  try {
    await db.insert(creditActivity).values({
      organizationId,
      action,
      creditsCost: cost,
      description: description || ACTION_LABELS[action],
      metadata: metadata || null
    })
  } catch (e) {
    // Don't fail the main operation if logging fails
    console.error('[Credits] Failed to log activity:', e)
  }
}

// =============================================================================
// ENSURE USAGE ROW EXISTS & IS CURRENT
// =============================================================================

/**
 * Ensure usage row exists for org. If period has elapsed, reset it.
 */
async function ensureUsageRow(
  organizationId: string,
  sub: Awaited<ReturnType<typeof getActiveSubscription>>
) {
  const db = await useDB()

  const usage = await db.query.organizationUsage.findFirst({
    where: eq(organizationUsage.organizationId, organizationId)
  })

  const now = new Date()

  if (!usage) {
    // No usage row yet — initialize
    if (sub) {
      await resetUsageFromSubscription(sub, organizationId)
    } else {
      await initFreeUsage(organizationId)
    }
    return
  }

  // If billing period has elapsed, reset
  if (now > usage.periodEnd) {
    if (sub) {
      await resetUsageFromSubscription(sub, organizationId)
    } else {
      await initFreeUsage(organizationId)
    }
  }
}

// =============================================================================
// GET CREDIT BALANCE
// =============================================================================

/**
 * Get current credit usage and limits for an organization.
 */
export async function getCreditBalance(organizationId: string) {
  const db = await useDB()

  const sub = await getActiveSubscription(organizationId)
  const planLimits = sub ? getPlanLimits(sub.plan) : FREE_LIMITS
  const maxCredits = planLimits.credits

  // Ensure row exists
  await ensureUsageRow(organizationId, sub)

  const usage = await db.query.organizationUsage.findFirst({
    where: eq(organizationUsage.organizationId, organizationId)
  })

  const used = usage?.creditsUsed ?? 0
  const limit = maxCredits
  const remaining = limit === null ? null : Math.max(0, limit - used)

  return {
    used,
    limit,
    remaining,
    periodStart: usage?.periodStart ?? null,
    periodEnd: usage?.periodEnd ?? null,
    plan: sub?.plan ?? 'free'
  }
}
