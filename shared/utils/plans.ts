export const PLANS = {
  // --- LEGACY PLANS (Matches your existing Database & Stripe IDs) ---
  // This must come FIRST so existing users match this config ($14.99)
  PRO_MONTHLY: {
    id: 'pro-monthly-v1',
    priceId: 'price_1Sb9YAL7TP83v94rd6Kzvp1W',
    key: 'pro',
    interval: 'month',
    label: 'Monthly',
    priceNumber: 19.99,
    seatPriceNumber: 6.00,
    description: 'Billed monthly',
    trialDays: 14,
    features: [
      'Full CRM Access & Rich Data',
      'In-app Estimate Runner',
      'Standalone Usage (No WP needed)',
      'Unlimited Team Members',
      'Priority Support'
    ]
  },
  PRO_YEARLY: {
    id: 'pro-yearly-v1',
    priceId: 'price_1Sb9YAL7TP83v94rd6Kzvp1W',
    key: 'pro',
    interval: 'year',
    label: 'Yearly',
    priceNumber: 199.99,
    seatPriceNumber: 49.99,
    description: 'Billed yearly (Save ~45%)',
    trialDays: 14,
    features: [
      'Full CRM Access & Rich Data',
      'In-app Estimate Runner',
      'Standalone Usage (No WP needed)',
      'Unlimited Team Members',
      'Priority Support'
    ]
  }
}

/**
 * Normalize a plan ID by removing the -no-trial suffix
 * This ensures consistent plan lookups regardless of how the subscription was created
 */
export function normalizePlanId(planId: string | null | undefined): string | null {
  if (!planId)
    return null
  return planId.replace('-no-trial', '')
}

/**
 * Find a plan by ID (handles -no-trial suffix automatically)
 */
export function findPlanById(planId: string | null | undefined): typeof PLANS[keyof typeof PLANS] | undefined {
  const normalizedId = normalizePlanId(planId)
  return Object.values(PLANS).find(p => p.id === normalizedId)
}

/**
 * Find a plan by price ID
 */
export function findPlanByPriceId(priceId: string | null | undefined): typeof PLANS[keyof typeof PLANS] | undefined {
  if (!priceId)
    return undefined
  return Object.values(PLANS).find(p => p.priceId === priceId)
}
