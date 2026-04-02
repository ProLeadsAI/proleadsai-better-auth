import { CREDIT_COSTS } from '~~/shared/utils/credits'

interface CreditBalance {
  used: number
  limit: number | null
  remaining: number | null
  periodStart: string | null
  periodEnd: string | null
  plan: string
}

export function useCreditBalance() {
  const { useActiveOrganization } = useAuth()
  const activeOrg = useActiveOrganization()
  const organizationId = computed(() => activeOrg.value?.data?.id)

  // Credit balance
  const { data: balance, pending: balanceLoading, refresh: refreshBalance } = useFetch<CreditBalance>(
    '/api/credits/balance',
    {
      query: { organizationId },
      watch: [organizationId],
      immediate: true,
      default: () => ({ used: 0, limit: null, remaining: null, periodStart: null, periodEnd: null, plan: 'free' })
    }
  )

  // Derived values
  const used = computed(() => balance.value?.used ?? 0)
  const limit = computed(() => balance.value?.limit)
  const remaining = computed(() => balance.value?.remaining)
  const plan = computed(() => balance.value?.plan ?? 'free')

  const periodEnd = computed(() => {
    if (!balance.value?.periodEnd)
      return null

    return new Date(balance.value.periodEnd)
  })

  // Usage percentage (0-100)
  const usagePercent = computed(() => {
    if (limit.value === null || limit.value === 0)
      return 0

    return Math.min(100, Math.round((used.value / limit.value) * 100))
  })

  // Status color for progress bar
  const statusColor = computed(() => {
    if (usagePercent.value >= 90)
      return 'error'
    if (usagePercent.value >= 75)
      return 'warning'

    return 'primary'
  })

  // Is the org running low on credits?
  const isLow = computed(() => usagePercent.value >= 75)
  const isExhausted = computed(() => {
    if (limit.value === null)
      return false

    return remaining.value !== null && remaining.value <= 0
  })

  // Formatted refill date
  const refillDate = computed(() => {
    if (!periodEnd.value)
      return null

    return periodEnd.value.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })

  // Days until refill
  const daysUntilRefill = computed(() => {
    if (!periodEnd.value)
      return null

    const now = new Date()
    const diff = periodEnd.value.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })

  return {
    balance,
    balanceLoading,
    refreshBalance,
    used,
    limit,
    remaining,
    plan,
    periodEnd,
    usagePercent,
    statusColor,
    isLow,
    isExhausted,
    refillDate,
    daysUntilRefill,
    organizationId,
    CREDIT_COSTS
  }
}
