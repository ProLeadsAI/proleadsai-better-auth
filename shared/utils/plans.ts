// =============================================================================
// PLAN TIER SYSTEM
// =============================================================================
// Centralized plan definitions. To add a new tier:
// 1. Add Stripe prices (monthly only)
// 2. Add tier to PLAN_TIERS below
// 3. Update PlanKey type
// See docs/PLANS_ARCHITECTURE.md for full guide
// =============================================================================

export type PlanKey = 'free' | 'starter' | 'pro'

export type PlanVersion = 'v1' | 'v2' | 'v3' // Add new versions as needed

export type PlanInterval = 'month'

export interface PlanVariant {
  id: string
  priceId: string
  price: number
}

export interface FeatureLimits {
  credits: number | null // null = unlimited, number = max credits per billing cycle
  sms: boolean
  stormMaps: boolean
  removeBranding: boolean
  apiAccess: boolean
}

export interface PlanTier {
  key: PlanKey
  name: string
  order: number // Higher = more premium (for sorting)
  monthly: PlanVariant
  features: string[]
  limits: FeatureLimits
}

// Credit Booster packs (one-time purchases that expire monthly)
export interface CreditBooster {
  id: string
  name: string
  credits: number
  price: number
  priceId: string
  description: string
}

// All features are unlocked for every plan (including free)
const ALL_FEATURES_UNLOCKED = {
  sms: true,
  stormMaps: true,
  removeBranding: true,
  apiAccess: true
} as const

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NUXT_APP_ENV === 'development'

// =============================================================================
// DEVELOPMENT PLAN DEFINITIONS
// =============================================================================

const DEVELOPMENT_PLAN_TIERS: Record<Exclude<PlanKey, 'free'>, PlanTier> = {
  starter: {
    key: 'starter',
    name: 'Starter (Dev)',
    order: 1,
    monthly: {
      id: 'starter-monthly-dev',
      priceId: 'price_1TFQsGI7NgMAzxasqKnGITDZ',
      price: 0.50
    },
    features: [
      '300 credits per month',
      'All features included',
      'Unlimited team members',
      'API access',
      '🚧 Development Mode'
    ],
    limits: {
      credits: 300,
      ...ALL_FEATURES_UNLOCKED
    }
  },
  pro: {
    key: 'pro',
    name: 'Pro (Dev)',
    order: 2,
    monthly: {
      id: 'pro-monthly-dev',
      priceId: 'price_dev_pro_monthly',
      price: 0.99
    },
    features: [
      '1000 credits per month',
      'All features included',
      'Unlimited team members',
      'Priority support',
      '🚧 Development Mode'
    ],
    limits: {
      credits: 1000,
      ...ALL_FEATURES_UNLOCKED
    }
  }
}

// =============================================================================
// PRODUCTION PLAN DEFINITIONS
// =============================================================================
// TODO: Replace priceId values with your actual Stripe price IDs after creating
// the Starter ($9/mo) and Pro ($19/mo) products in Stripe.

const PRODUCTION_PLAN_TIERS: Record<Exclude<PlanKey, 'free'>, PlanTier> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    order: 1,
    monthly: {
      id: 'starter-monthly-v1',
      priceId: 'price_1TIIhJRJPiME758uxOLhR8Df',
      price: 9.00
    },
    features: [
      '300 credits per month',
      'All features included',
      'Unlimited team members',
      'API access'
    ],
    limits: {
      credits: 300,
      ...ALL_FEATURES_UNLOCKED
    }
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    order: 2,
    monthly: {
      id: 'pro-monthly-v1',
      priceId: 'price_1TIIiURJPiME758u1xSUAxrE',
      price: 19.00
    },
    features: [
      '1000 credits per month',
      'All features included',
      'Unlimited team members',
      'Priority support'
    ],
    limits: {
      credits: 1000,
      ...ALL_FEATURES_UNLOCKED
    }
  }
}

// =============================================================================
// CREDIT BOOSTER PACKS (One-time purchases that expire monthly)
// =============================================================================

export const CREDIT_BOOSTERS: CreditBooster[] = [
  {
    id: 'booster-small',
    name: 'Small Booster',
    credits: 100,
    price: 5.00,
    priceId: 'price_TODO_booster_small',
    description: 'Extra 100 credits for this month'
  },
  {
    id: 'booster-medium',
    name: 'Medium Booster',
    credits: 250,
    price: 10.00,
    priceId: 'price_TODO_booster_medium',
    description: 'Extra 250 credits for this month'
  },
  {
    id: 'booster-large',
    name: 'Large Booster',
    credits: 500,
    price: 20.00,
    priceId: 'price_TODO_booster_large',
    description: 'Extra 500 credits for this month'
  }
]

// =============================================================================
// ENVIRONMENT-SPECIFIC PLAN SELECTION
// =============================================================================

export const PLAN_TIERS: Record<Exclude<PlanKey, 'free'>, PlanTier> =
  isDevelopment ? DEVELOPMENT_PLAN_TIERS : PRODUCTION_PLAN_TIERS

// Free tier limits (not in PLAN_TIERS since it's not purchasable)
export const FREE_LIMITS: FeatureLimits = {
  credits: isDevelopment ? 1000 : 60,
  ...ALL_FEATURES_UNLOCKED
}

// =============================================================================
// LEGACY PLAN VERSIONS
// =============================================================================
// When you change pricing, add the OLD plan here before updating PLAN_TIERS.
// This preserves pricing display for existing subscribers.
// Key format: 'planId' (e.g., 'pro-monthly-v1')

export interface LegacyPlanPricing {
  price: number
  tierKey: PlanKey
  interval: PlanInterval
  limits?: Partial<FeatureLimits> // Optional: override limits for this legacy plan
}

export const LEGACY_PLAN_PRICING: Record<string, LegacyPlanPricing> = {
  // Old Pro plan before credit-based pricing (v1)
  'pro-monthly-v1': { price: 29.99, tierKey: 'pro', interval: 'month', limits: { credits: 500 } }
}

// =============================================================================
// HELPER: Get plan variant for interval
// =============================================================================

export function getTierVariant(tierKey: Exclude<PlanKey, 'free'>, interval: PlanInterval): PlanVariant {
  // Only monthly intervals are supported now
  if (interval !== 'month') {
    throw new Error(`Only monthly intervals are supported, got: ${interval}`)
  }
  return PLAN_TIERS[tierKey].monthly
}

export function getTierForInterval(tierKey: Exclude<PlanKey, 'free'>, interval: PlanInterval) {
  // Only monthly intervals are supported now
  if (interval !== 'month') {
    throw new Error(`Only monthly intervals are supported, got: ${interval}`)
  }

  const tier = PLAN_TIERS[tierKey]

  if (!tier) {
    console.error(`[getTierForInterval] Tier '${tierKey}' not found in PLAN_TIERS. Available tiers:`, Object.keys(PLAN_TIERS))
    // Fallback to 'starter' if tier not found
    const fallbackTier = PLAN_TIERS.starter
    const variant = fallbackTier.monthly
    return {
      id: variant.id,
      priceId: variant.priceId,
      key: fallbackTier.key,
      interval,
      label: 'Monthly',
      price: variant.price,
      features: fallbackTier.features,
      limits: fallbackTier.limits
    }
  }
  const variant = tier.monthly
  return {
    id: variant.id,
    priceId: variant.priceId,
    key: tier.key,
    interval,
    label: 'Monthly',
    price: variant.price,
    features: tier.features,
    limits: tier.limits
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Get all paid tiers sorted by order */
export const PAID_TIERS = Object.values(PLAN_TIERS).sort((a, b) => a.order - b.order)

/** Get all tier keys including free */
export const ALL_PLAN_KEYS: PlanKey[] = ['free', ...PAID_TIERS.map(t => t.key)]

/**
 * Normalize a plan ID (strips legacy suffixes like -no-trial)
 */
export function normalizePlanId(planId: string | null | undefined): string | null {
  if (!planId)
    return null
  return planId.replace('-no-trial', '')
}

/**
 * Get plan key from a plan ID (e.g., 'pro-monthly-v2' -> 'pro')
 * Checks legacy plans first, then current PLAN_TIERS
 */
export function getPlanKeyFromId(planId: string | null | undefined): PlanKey {
  if (!planId)
    return 'free'
  const normalizedId = normalizePlanId(planId)
  if (!normalizedId)
    return 'free'

  // Check legacy plans first (for old plan IDs after price changes)
  const legacy = LEGACY_PLAN_PRICING[normalizedId]
  if (legacy) {
    return legacy.tierKey
  }

  // Check current PLAN_TIERS
  for (const tier of Object.values(PLAN_TIERS)) {
    if (tier.monthly.id === normalizedId) {
      return tier.key
    }
  }

  // Fallback: try to extract tier from plan ID pattern (e.g., 'pro-monthly-v1' -> 'pro')
  const match = normalizedId.match(/^([a-z]+)-monthly-v\d+$/)
  if (match && match[1]) {
    const possibleTier = match[1] as PlanKey
    if (possibleTier in PLAN_TIERS || possibleTier === 'free') {
      return possibleTier
    }
  }

  return 'free'
}

/**
 * Get a plan tier by key
 */
export function getPlanTier(key: PlanKey): PlanTier | undefined {
  if (key === 'free')
    return undefined
  return PLAN_TIERS[key as Exclude<PlanKey, 'free'>]
}

/**
 * Check if a plan has access to a feature
 */
export function canAccess(planKey: PlanKey, feature: keyof FeatureLimits): boolean | number | null {
  if (planKey === 'free') {
    return FREE_LIMITS[feature]
  }
  const tier = PLAN_TIERS[planKey as Exclude<PlanKey, 'free'>]
  return tier?.limits[feature] ?? FREE_LIMITS[feature]
}

/**
 * Get limits for a specific plan ID (checks legacy overrides first)
 * Use this when you need to check what features a specific subscriber has access to
 */
export function getPlanLimits(planId: string | null | undefined): FeatureLimits {
  const normalizedId = normalizePlanId(planId)
  if (!normalizedId) {
    return FREE_LIMITS
  }

  // Check legacy plan for limit overrides
  const legacy = LEGACY_PLAN_PRICING[normalizedId]
  if (legacy) {
    const baseTier = PLAN_TIERS[legacy.tierKey as Exclude<PlanKey, 'free'>]
    if (baseTier) {
      // Merge base tier limits with legacy overrides
      return {
        ...baseTier.limits,
        ...legacy.limits
      }
    }
  }

  // Get limits from current tier
  const tierKey = getPlanKeyFromId(normalizedId)
  if (tierKey === 'free') {
    return FREE_LIMITS
  }

  const tier = PLAN_TIERS[tierKey as Exclude<PlanKey, 'free'>]
  return tier?.limits ?? FREE_LIMITS
}

/**
 * Check if a specific plan ID has access to a feature (checks legacy overrides)
 */
export function canAccessFeature(planId: string | null | undefined, feature: keyof FeatureLimits): boolean | number | null {
  const limits = getPlanLimits(planId)
  return limits[feature]
}

/**
 * Check if plan is at least a certain tier
 */
export function isAtLeastTier(userPlanKey: PlanKey, requiredTierKey: PlanKey): boolean {
  if (requiredTierKey === 'free')
    return true
  if (userPlanKey === 'free')
    return false

  const userTier = PLAN_TIERS[userPlanKey as Exclude<PlanKey, 'free'>]
  const requiredTier = PLAN_TIERS[requiredTierKey as Exclude<PlanKey, 'free'>]

  if (!userTier || !requiredTier)
    return false
  return userTier.order >= requiredTier.order
}

/**
 * Find a plan by ID
 * Returns { tier, variant, interval } or undefined
 */
export function findPlanById(planId: string | null | undefined) {
  return getPlanVariantById(planId)
}

/**
 * Get pricing for a plan ID, checking legacy pricing first
 * Use this for displaying costs to existing subscribers
 */
export function getPlanPricing(planId: string | null | undefined): { price: number, tierKey: PlanKey, interval: PlanInterval } | undefined {
  const normalizedId = normalizePlanId(planId)
  if (!normalizedId)
    return undefined

  // Check legacy pricing first (for grandfathered users)
  const legacy = LEGACY_PLAN_PRICING[normalizedId]
  if (legacy) {
    return legacy
  }

  // Fall back to current tier pricing
  const variant = getPlanVariantById(normalizedId)
  if (variant) {
    return {
      price: variant.variant.price,
      tierKey: variant.tier.key,
      interval: variant.interval
    }
  }

  return undefined
}

/**
 * Check if a plan ID is a legacy/grandfathered plan
 */
export function isLegacyPlan(planId: string | null | undefined): boolean {
  const normalizedId = normalizePlanId(planId)
  if (!normalizedId)
    return false
  return normalizedId in LEGACY_PLAN_PRICING
}

/**
 * Find a plan by Stripe price ID
 * Returns { tier, variant, interval } or undefined
 */
export function findPlanByPriceId(priceId: string | null | undefined): { tier: PlanTier, variant: PlanVariant, interval: PlanInterval } | undefined {
  if (!priceId)
    return undefined
  for (const tier of Object.values(PLAN_TIERS)) {
    if (tier.monthly.priceId === priceId) {
      return { tier, variant: tier.monthly, interval: 'month' }
    }
  }
  return undefined
}

/**
 * Get plan variant by plan ID
 */
export function getPlanVariantById(planId: string | null | undefined): { tier: PlanTier, variant: PlanVariant, interval: PlanInterval } | undefined {
  const normalizedId = normalizePlanId(planId)
  if (!normalizedId)
    return undefined

  for (const tier of Object.values(PLAN_TIERS)) {
    if (tier.monthly.id === normalizedId) {
      return { tier, variant: tier.monthly, interval: 'month' }
    }
  }
  return undefined
}

/**
 * Get plan variant by Stripe price ID
 */
export function getPlanByStripePriceId(priceId: string | null | undefined): { tier: PlanTier, tierKey: PlanKey, variant: PlanVariant, interval: PlanInterval } | undefined {
  if (!priceId)
    return undefined

  for (const [tierKey, tier] of Object.entries(PLAN_TIERS)) {
    if (tier.monthly.priceId === priceId) {
      return { tier, tierKey: tierKey as PlanKey, variant: tier.monthly, interval: 'month' }
    }
  }
  return undefined
}
