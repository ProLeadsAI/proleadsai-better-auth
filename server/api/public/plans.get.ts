import { CREDIT_BOOSTERS, FREE_LIMITS, PLAN_TIERS } from '~~/shared/utils/plans'

/**
 * Public API endpoint for fetching plan information
 * No authentication required - for marketing site
 *
 * GET /api/public/plans
 */
export default defineEventHandler(async (event) => {
  // Set cache headers for CDN/browser caching (1 hour)
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'Content-Type': 'application/json'
  })

  // Transform PLAN_TIERS into a public-friendly format
  const plans = Object.entries(PLAN_TIERS).map(([_key, tier]) => ({
    key: tier.key,
    name: tier.name,
    order: tier.order,
    features: tier.features,
    limits: tier.limits,
    pricing: {
      monthly: {
        price: tier.monthly.price
      }
    }
  }))

  // Sort by order
  plans.sort((a, b) => a.order - b.order)

  return {
    plans,
    creditBoosters: CREDIT_BOOSTERS.map(booster => ({
      id: booster.id,
      name: booster.name,
      credits: booster.credits,
      price: booster.price,
      description: booster.description,
      pricePerCredit: (booster.price / booster.credits).toFixed(2)
    })),
    freeTier: {
      name: 'Free',
      limits: FREE_LIMITS,
      features: [
        `${FREE_LIMITS.credits} credits per month`,
        'All features included',
        'Unlimited team members',
        'WordPress plugin'
      ]
    },
    meta: {
      currency: 'USD',
      currencySymbol: '$',
      unlimitedMembers: true,
      billingInterval: 'monthly'
    }
  }
})
