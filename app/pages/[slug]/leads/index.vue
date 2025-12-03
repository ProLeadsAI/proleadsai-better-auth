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

interface Lead {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  labels: string[] | null
  addresses?: any[]
  metadata?: Record<string, any>
}

// Fetch leads
const { data: leads, pending: loading, refresh } = await useFetch<Lead[]>(
  () => `/api/organization/${activeOrg.value?.data?.id}/leads`,
  {
    watch: [() => activeOrg.value?.data?.id],
    default: () => [],
    immediate: !!activeOrg.value?.data?.id
  }
)

// Global filter
const globalFilter = ref('')

// Filtered leads based on search
const filteredLeads = computed(() => {
  if (!globalFilter.value)
    return leads.value || []
  const search = globalFilter.value.toLowerCase()
  return (leads.value || []).filter((lead) => {
    const name = (lead.name || '').toLowerCase()
    const email = (lead.email || '').toLowerCase()
    const phone = (lead.phone || '').toLowerCase()
    return name.includes(search) || email.includes(search) || phone.includes(search)
  })
})

// Actions
const viewLead = (id: string) => {
  router.push(`/${route.params.slug}/leads/${id}`)
}

// Table columns
const columns: TableColumn<Lead>[] = [
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
    accessorKey: 'labels',
    header: 'Labels',
    cell: ({ row }) => {
      const labels = row.getValue('labels') as string[] | null
      if (!labels || !labels.length)
        return h('span', { class: 'text-muted' }, '—')
      return h('div', { class: 'flex gap-1 flex-wrap' }, labels.slice(0, 3).map(label => h(UBadge, { variant: 'subtle', size: 'xs', key: label }, () => label)))
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
      onClick: () => viewLead(row.original.id)
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
  leadId: null as string | null
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
      labels: parseTags(formData.tagsInput),
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
      await $fetch(`/api/organization/${activeOrg.value?.data?.id}/leads/${formModal.editId}`, {
        method: 'PATCH',
        body: payload
      })
      toast.add({ title: 'Lead updated', color: 'success' })
    } else {
      await $fetch(`/api/organization/${activeOrg.value?.data?.id}/leads`, {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Lead created', color: 'success' })
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
  if (!deleteModal.leadId)
    return

  try {
    await $fetch(`/api/organization/${activeOrg.value?.data?.id}/leads/${deleteModal.leadId}`, {
      method: 'DELETE'
    })
    toast.add({ title: 'Lead deleted', color: 'success' })
    deleteModal.isOpen = false
    deleteModal.leadId = null
    await refresh()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete lead',
      color: 'error'
    })
  }
}

// Row click handler
const onRowSelect = (_e: Event, row: any) => {
  viewLead(row.original.id)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">
          Leads
        </h1>
        <p class="text-sm text-neutral-500">
          Manage your leads and roof estimates
        </p>
      </div>
      <UButton
        label="New Lead"
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
      v-else-if="!leads?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-inbox"
        class="w-12 h-12 text-neutral-300 mx-auto mb-4"
      />
      <h3 class="text-lg font-medium mb-2">
        No leads yet
      </h3>
      <p class="text-neutral-500 mb-4">
        Create your first lead or wait for submissions from your website.
      </p>
      <UButton
        label="Create Lead"
        @click="openCreateModal"
      />
    </UCard>

    <!-- Leads Table -->
    <div
      v-else
      class="flex flex-col flex-1 w-full border border-default rounded-lg"
    >
      <!-- Search Bar -->
      <div class="flex px-4 py-3.5 border-b border-default">
        <UInput
          v-model="globalFilter"
          placeholder="Filter leads..."
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
        :data="filteredLeads"
        :columns="columns"
        :loading="loading"
        class="flex-1"
        @select="onRowSelect"
      />
    </div>

    <!-- Create/Edit Modal -->
    <EntityFormModal
      :open="formModal.isOpen"
      :title="formModal.isEdit ? 'Edit Lead' : 'New Lead'"
      :is-edit="formModal.isEdit"
      entity-type="lead"
      :initial-data="formModal.initialData"
      @update:open="formModal.isOpen = $event"
      @submit="handleFormSubmit"
    />

    <!-- Delete Confirmation Modal -->
    <UModal
      v-model:open="deleteModal.isOpen"
      title="Delete Lead"
    >
      <template #body>
        <p>Are you sure you want to delete this lead? This action cannot be undone.</p>
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
