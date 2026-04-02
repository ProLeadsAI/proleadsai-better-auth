// =============================================================================
// CREDIT COST CONFIGURATION
// =============================================================================
// Defines how many credits each action costs.
// Used by consumeCredits() service and frontend display.

export const CREDIT_COSTS = {
  search: 5,
  lead_submit: 20
} as const

export type CreditAction = keyof typeof CREDIT_COSTS
