export const useSubmissions = () => {
  const { useActiveOrganization } = useAuth()
  const activeOrg = useActiveOrganization()

  const orgId = computed(() => activeOrg.value?.data?.id)

  const { data: submissions, pending: loading, refresh } = useFetch<any[]>(
    () => `/api/organization/${orgId.value}/submissions`,
    {
      watch: [orgId],
      default: () => [],
      immediate: !!orgId.value
    }
  )

  const getSubmission = async (id: string) => {
    return await $fetch(`/api/organization/${orgId.value}/submissions/${id}`)
  }

  const deleteSubmission = async (id: string) => {
    await $fetch(`/api/organization/${orgId.value}/submissions/${id}`, {
      method: 'DELETE'
    })
    await refresh()
  }

  return {
    submissions,
    loading,
    refresh,
    getSubmission,
    deleteSubmission
  }
}
