/**
 * Composable for checking subscription payment status
 * Used across the app to detect failed payments
 */
export function usePaymentStatus() {
  const { useActiveOrganization } = useAuth()
  const activeOrg = useActiveOrganization()

  // Get all subscriptions for the active organization
  const subscriptions = computed(() => {
    const data = activeOrg.value?.data
    return (data as any)?.subscriptions || []
  })

  // Find the active subscription (including past_due)
  // Note: 'incomplete' subscriptions are NOT valid - they occur when checkout is abandoned
  const activeSub = computed(() => {
    const subs = subscriptions.value as any[]
    if (!subs || subs.length === 0)
      return null
    return subs.find(
      (s: any) => s.status === 'active' || s.status === 'past_due'
    ) || null
  })

  // Check if subscription has a failed payment
  const isPaymentFailed = computed(() => activeSub.value?.status === 'past_due')

  // Current plan type (detects starter/pro from plan ID)
  const currentPlan = computed(() => {
    if (!activeSub.value)
      return 'free'
    const planId = activeSub.value.plan
    if (!planId)
      return 'free'
    if (planId.includes('starter'))
      return 'starter'
    if (planId.includes('pro'))
      return 'pro'
    return 'starter' // Default paid plan
  })

  // Organization ID helper
  const organizationId = computed(() => activeOrg.value?.data?.id)
  const organizationSlug = computed(() => activeOrg.value?.data?.slug)

  return {
    subscriptions,
    activeSub,
    isPaymentFailed,
    currentPlan,
    organizationId,
    organizationSlug
  }
}
