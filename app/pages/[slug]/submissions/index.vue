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

interface Submission {
  id: string
  formName: string | null
  name: string | null
  email: string | null
  phone: string | null
  createdAt: string
}

// Fetch submissions
const { data: submissions, pending: loading, refresh } = await useFetch<Submission[]>(
  () => `/api/organization/${activeOrg.value?.data?.id}/submissions`,
  {
    watch: [() => activeOrg.value?.data?.id],
    default: () => [],
    immediate: !!activeOrg.value?.data?.id
  }
)

// Global filter
const globalFilter = ref('')

// Filtered submissions based on search
const filteredSubmissions = computed(() => {
  if (!globalFilter.value)
    return submissions.value || []
  const search = globalFilter.value.toLowerCase()
  return (submissions.value || []).filter((sub) => {
    const name = (sub.name || '').toLowerCase()
    const email = (sub.email || '').toLowerCase()
    const phone = (sub.phone || '').toLowerCase()
    const formName = (sub.formName || '').toLowerCase()
    return name.includes(search) || email.includes(search) || phone.includes(search) || formName.includes(search)
  })
})

// Helper functions
const formatDate = (date: string | Date | null | undefined): string => {
  if (!date)
    return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const viewSubmission = (id: string) => {
  router.push(`/${route.params.slug}/submissions/${id}`)
}

// Table columns
const columns: TableColumn<Submission>[] = [
  {
    accessorKey: 'formName',
    header: 'Form',
    cell: ({ row }) => h(UBadge, { variant: 'subtle', size: 'sm' }, () => row.getValue('formName') || 'Unknown')
  },
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
    accessorKey: 'createdAt',
    header: 'Submitted',
    cell: ({ row }) => formatDate(row.getValue('createdAt'))
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => h('div', { class: 'text-right' }, h(UButton, {
      icon: 'i-lucide-eye',
      variant: 'ghost',
      color: 'neutral',
      size: 'xs',
      onClick: () => viewSubmission(row.original.id)
    }))
  }
]

// Delete modal state
const deleteModal = reactive({
  isOpen: false,
  submissionId: null as string | null
})

const handleDelete = async () => {
  if (!deleteModal.submissionId)
    return

  try {
    await $fetch(`/api/organization/${activeOrg.value?.data?.id}/submissions/${deleteModal.submissionId}`, {
      method: 'DELETE'
    })
    toast.add({ title: 'Submission deleted', color: 'success' })
    deleteModal.isOpen = false
    deleteModal.submissionId = null
    await refresh()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete submission',
      color: 'error'
    })
  }
}

// Row click handler
const onRowSelect = (_e: Event, row: any) => {
  viewSubmission(row.original.id)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">
          Submissions
        </h1>
        <p class="text-sm text-neutral-500">
          Form submissions from your website
        </p>
      </div>
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
      v-else-if="!submissions?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-inbox"
        class="w-12 h-12 text-neutral-300 mx-auto mb-4"
      />
      <h3 class="text-lg font-medium mb-2">
        No submissions yet
      </h3>
      <p class="text-neutral-500">
        Submissions will appear here when users fill out forms on your website.
      </p>
    </UCard>

    <!-- Submissions Table -->
    <div
      v-else
      class="flex flex-col flex-1 w-full border border-default rounded-lg"
    >
      <!-- Search Bar -->
      <div class="flex px-4 py-3.5 border-b border-default">
        <UInput
          v-model="globalFilter"
          placeholder="Filter submissions..."
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
        :data="filteredSubmissions"
        :columns="columns"
        :loading="loading"
        class="flex-1"
        @select="onRowSelect"
      />
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal
      v-model:open="deleteModal.isOpen"
      title="Delete Submission"
    >
      <template #body>
        <p>Are you sure you want to delete this submission? This action cannot be undone.</p>
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
