export const useDashboardStats = () => {
  const { useActiveOrganization } = useAuth()
  const activeOrg = useActiveOrganization()

  const orgId = computed(() => activeOrg.value?.data?.id)

  const { data: stats, pending: loading, refresh } = useFetch<{
    leads: number
    contacts: number
    submissions: number
  }>(
    () => `/api/organization/${orgId.value}/dashboard`,
    {
      watch: [orgId],
      default: () => ({ leads: 0, contacts: 0, submissions: 0 }),
      immediate: !!orgId.value
    }
  )

  return {
    stats,
    loading,
    refresh
  }
}
