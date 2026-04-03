import { CREDIT_COSTS } from '~~/shared/utils/credits'
import { FREE_LIMITS } from '~~/shared/utils/plans'

interface CreditBalance {
  used: number
  limit: number | null
  remaining: number | null
  periodStart: string | null
  periodEnd: string | null
  plan: string
}

export function useCreditBalance() {
  const route = useRoute()
  const { organization, session, useActiveOrganization } = useAuth()
  const activeOrg = useActiveOrganization()
  const { data: organizations } = useLazyAsyncData('user-organizations', async () => {
    const { data } = await organization.list()
    return data
  }, {
    getCachedData: () => undefined
  })

  const organizationId = computed(() => {
    const activeOrgId = activeOrg.value?.data?.id
    if (activeOrgId)
      return activeOrgId

    const routeSlug = route.params.slug as string | undefined
    if (routeSlug && routeSlug !== 't' && organizations.value?.length) {
      const matchedOrg = organizations.value.find((org: any) => org.slug === routeSlug)
      if (matchedOrg?.id)
        return matchedOrg.id
    }

    const sessionOrgId = (session.value as any)?.activeOrganizationId
    if (sessionOrgId)
      return sessionOrgId

    return null
  })

  // Credit balance
  const { data: balance, pending: balanceLoading, refresh: refreshBalance } = useFetch<CreditBalance>(
    '/api/credits/balance',
    {
      query: { organizationId },
      watch: [organizationId],
      immediate: false,
      default: () => ({ used: 0, limit: FREE_LIMITS.credits, remaining: FREE_LIMITS.credits, periodStart: null, periodEnd: null, plan: 'free' })
    }
  )

  watch(organizationId, (orgId) => {
    if (orgId)
      refreshBalance()
  }, { immediate: true })

  const isResolvingOrganization = computed(() => !organizationId.value)

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
    balanceLoading: computed(() => balanceLoading.value || isResolvingOrganization.value),
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
