export const useContacts = () => {
  const { useActiveOrganization } = useAuth()
  const activeOrg = useActiveOrganization()

  const orgId = computed(() => activeOrg.value?.data?.id)

  const { data: contacts, pending: loading, refresh } = useFetch<any[]>(
    () => `/api/organization/${orgId.value}/contacts`,
    {
      watch: [orgId],
      default: () => [],
      immediate: !!orgId.value
    }
  )

  const createContact = async (payload: {
    name?: string
    email?: string
    phone?: string
    company?: string
    tags?: string[]
    source?: string
    notes?: string
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
    const result = await $fetch(`/api/organization/${orgId.value}/contacts`, {
      method: 'POST',
      body: payload
    })
    await refresh()
    return result
  }

  const updateContact = async (id: string, payload: Partial<Parameters<typeof createContact>[0]>) => {
    const result = await $fetch(`/api/organization/${orgId.value}/contacts/${id}`, {
      method: 'PATCH',
      body: payload
    })
    await refresh()
    return result
  }

  const deleteContact = async (id: string) => {
    await $fetch(`/api/organization/${orgId.value}/contacts/${id}`, {
      method: 'DELETE'
    })
    await refresh()
  }

  const getContact = async (id: string) => {
    return await $fetch(`/api/organization/${orgId.value}/contacts/${id}`)
  }

  return {
    contacts,
    loading,
    refresh,
    createContact,
    updateContact,
    deleteContact,
    getContact
  }
}
