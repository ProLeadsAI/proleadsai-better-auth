/**
 * Subscription lifecycle handlers
 * These functions are called by Better Auth Stripe webhooks
 */

/**
 * Check if subscription is expired or will expire soon
 */
export function isSubscriptionExpired(subscription: any): boolean {
  if (!subscription)
    return true

  const now = new Date()
  const periodEnd = new Date(subscription.periodEnd)

  return now > periodEnd && subscription.status !== 'active'
}

/**
 * Get days until subscription expires
 */
export function getDaysUntilExpiration(subscription: any): number {
  if (!subscription?.periodEnd)
    return 0

  const now = new Date()
  const periodEnd = new Date(subscription.periodEnd)
  const diffTime = periodEnd.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}
