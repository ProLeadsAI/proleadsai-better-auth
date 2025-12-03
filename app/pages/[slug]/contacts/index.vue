<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { useActiveOrganization } = useAuth()
const activeOrg = useActiveOrganization()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

definePageMeta({
  layout: 'dashboard'
})

interface Contact {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  tags: string[] | null
  source: string | null
  addresses?: any[]
  metadata?: Record<string, any>
}

// Fetch contacts
const { data: contacts, pending: loading, refresh } = await useFetch<Contact[]>(
  () => `/api/organization/${activeOrg.value?.data?.id}/contacts`,
  {
    watch: [() => activeOrg.value?.data?.id],
    default: () => [],
    immediate: !!activeOrg.value?.data?.id
  }
)

// Global filter
const globalFilter = ref('')

// Filtered contacts based on search
const filteredContacts = computed(() => {
  if (!globalFilter.value)
    return contacts.value || []
  const search = globalFilter.value.toLowerCase()
  return (contacts.value || []).filter((contact) => {
    const name = (contact.name || '').toLowerCase()
    const email = (contact.email || '').toLowerCase()
    const phone = (contact.phone || '').toLowerCase()
    const company = (contact.company || '').toLowerCase()
    return name.includes(search) || email.includes(search) || phone.includes(search) || company.includes(search)
  })
})

// Actions
const viewContact = (id: string) => {
  router.push(`/${route.params.slug}/contacts/${id}`)
}

// Table columns
const columns: TableColumn<Contact>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => row.getValue('name') || '—'
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => row.getValue('email') || '—'
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => row.getValue('phone') || '—'
  },
  {
    accessorKey: 'company',
    header: 'Company',
    cell: ({ row }) => row.getValue('company') || '—'
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.getValue('tags') as string[] | null
      if (!tags || !tags.length)
        return h('span', { class: 'text-muted' }, '—')
      return h('div', { class: 'flex gap-1 flex-wrap' }, tags.slice(0, 3).map(tag => h(UBadge, { variant: 'subtle', size: 'xs', key: tag }, () => tag)))
    }
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => h('div', { class: 'text-right' }, h(UButton, {
      icon: 'i-lucide-eye',
      variant: 'ghost',
      color: 'neutral',
      size: 'xs',
      onClick: () => viewContact(row.original.id)
    }))
  }
]

// Modal states
const formModal = reactive({
  isOpen: false,
  isEdit: false,
  editId: null as string | null,
  initialData: null as any
})

const deleteModal = reactive({
  isOpen: false,
  contactId: null as string | null
})

const openCreateModal = () => {
  formModal.isEdit = false
  formModal.editId = null
  formModal.initialData = null
  formModal.isOpen = true
}

// Parse helpers
const parseTags = (input: string): string[] => {
  return input.split(',').map(t => t.trim()).filter(Boolean)
}

const parseMetadata = (input: string): Record<string, any> | null => {
  if (!input?.trim())
    return null
  try {
    return JSON.parse(input)
  }
  catch {
    return null
  }
}

const handleFormSubmit = async (formData: any) => {
  try {
    const payload: any = {
      name: formData.name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      company: formData.company || null,
      tags: parseTags(formData.tagsInput),
      source: formData.source || null,
      metadata: parseMetadata(formData.metadata)
    }

    // Include address if provided
    if (formData.address?.streetAddress) {
      payload.address = {
        streetAddress: formData.address.streetAddress,
        streetAddress2: formData.address.streetAddress2 || null,
        postOfficeBoxNumber: formData.address.postOfficeBoxNumber || null,
        addressLocality: formData.address.addressLocality,
        addressRegion: formData.address.addressRegion,
        postalCode: formData.address.postalCode,
        addressCountry: formData.address.addressCountry || null,
        latitude: formData.address.latitude || null,
        longitude: formData.address.longitude || null
      }
    }

    if (formModal.isEdit && formModal.editId) {
      await $fetch(`/api/organization/${activeOrg.value?.data?.id}/contacts/${formModal.editId}`, {
        method: 'PATCH',
        body: payload
      })
      toast.add({ title: 'Contact updated', color: 'success' })
    } else {
      await $fetch(`/api/organization/${activeOrg.value?.data?.id}/contacts`, {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Contact created', color: 'success' })
    }

    formModal.isOpen = false
    await refresh()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Something went wrong',
      color: 'error'
    })
  }
}

const handleDelete = async () => {
  if (!deleteModal.contactId)
    return

  try {
    await $fetch(`/api/organization/${activeOrg.value?.data?.id}/contacts/${deleteModal.contactId}`, {
      method: 'DELETE'
    })
    toast.add({ title: 'Contact deleted', color: 'success' })
    deleteModal.isOpen = false
    deleteModal.contactId = null
    await refresh()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete contact',
      color: 'error'
    })
  }
}

// Row click handler
const onRowSelect = (_e: Event, row: any) => {
  viewContact(row.original.id)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">
          Contacts
        </h1>
        <p class="text-sm text-neutral-500">
          Manage your contacts and their information
        </p>
      </div>
      <UButton
        label="New Contact"
        icon="i-lucide-plus"
        @click="openCreateModal"
      />
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex items-center justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-neutral-400"
      />
    </div>

    <!-- Empty State -->
    <UCard
      v-else-if="!contacts?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-contact"
        class="w-12 h-12 text-neutral-300 mx-auto mb-4"
      />
      <h3 class="text-lg font-medium mb-2">
        No contacts yet
      </h3>
      <p class="text-neutral-500 mb-4">
        Create your first contact to get started.
      </p>
      <UButton
        label="Create Contact"
        @click="openCreateModal"
      />
    </UCard>

    <!-- Contacts Table -->
    <div
      v-else
      class="flex flex-col flex-1 w-full border border-default rounded-lg"
    >
      <!-- Search & Filter Bar -->
      <div class="flex px-4 py-3.5 border-b border-default">
        <UInput
          v-model="globalFilter"
          placeholder="Filter contacts..."
          icon="i-lucide-search"
          class="max-w-sm"
          type="search"
          name="table-filter"
          autocomplete="off"
          data-lpignore="true"
          data-form-type="other"
          data-1p-ignore
          :ui="{ trailing: 'pr-1' }"
        >
          <template
            v-if="globalFilter"
            #trailing
          >
            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="globalFilter = ''"
            />
          </template>
        </UInput>
      </div>

      <!-- UTable -->
      <UTable
        :data="filteredContacts"
        :columns="columns"
        :loading="loading"
        class="flex-1"
        @select="onRowSelect"
      />
    </div>

    <!-- Create/Edit Modal -->
    <EntityFormModal
      :open="formModal.isOpen"
      :title="formModal.isEdit ? 'Edit Contact' : 'New Contact'"
      :is-edit="formModal.isEdit"
      entity-type="contact"
      :initial-data="formModal.initialData"
      @update:open="formModal.isOpen = $event"
      @submit="handleFormSubmit"
    />

    <!-- Delete Confirmation Modal -->
    <UModal
      v-model:open="deleteModal.isOpen"
      title="Delete Contact"
    >
      <template #body>
        <p>Are you sure you want to delete this contact? This action cannot be undone.</p>
      </template>
      <template #footer>
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="deleteModal.isOpen = false"
        />
        <UButton
          label="Delete"
          color="error"
          @click="handleDelete"
        />
      </template>
    </UModal>
  </div>
</template>
