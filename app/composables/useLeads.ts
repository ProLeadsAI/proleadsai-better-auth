export const useLeads = () => {
  const { useActiveOrganization } = useAuth()
  const activeOrg = useActiveOrganization()
  const _toast = useToast()

  const orgId = computed(() => activeOrg.value?.data?.id)

  const { data: leads, pending: loading, refresh } = useFetch<any[]>(
    () => `/api/organization/${orgId.value}/leads`,
    {
      watch: [orgId],
      default: () => [],
      immediate: !!orgId.value
    }
  )

  const createLead = async (payload: {
    name?: string
    email?: string
    phone?: string
    labels?: string[]
    metadata?: Record<string, any>
    address?: {
      streetAddress: string
      streetAddress2?: string
      postOfficeBoxNumber?: string
      addressLocality: string
      addressRegion: string
      postalCode: string
      addressCountry?: string
      latitude?: string
      longitude?: string
    }
  }) => {
    const result = await $fetch(`/api/organization/${orgId.value}/leads`, {
      method: 'POST',
      body: payload
    })
    await refresh()
    return result
  }

  const updateLead = async (id: string, payload: Partial<Parameters<typeof createLead>[0]>) => {
    const result = await $fetch(`/api/organization/${orgId.value}/leads/${id}`, {
      method: 'PATCH',
      body: payload
    })
    await refresh()
    return result
  }

  const deleteLead = async (id: string) => {
    await $fetch(`/api/organization/${orgId.value}/leads/${id}`, {
      method: 'DELETE'
    })
    await refresh()
  }

  const getLead = async (id: string) => {
    return await $fetch(`/api/organization/${orgId.value}/leads/${id}`)
  }

  return {
    leads,
    loading,
    refresh,
    createLead,
    updateLead,
    deleteLead,
    getLead
  }
}
