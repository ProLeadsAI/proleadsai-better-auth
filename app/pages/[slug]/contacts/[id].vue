<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { useActiveOrganization } = useAuth()
const activeOrg = useActiveOrganization()

definePageMeta({
  layout: 'dashboard'
})

const contactId = computed(() => route.params.id as string)

// Fetch contact with addresses and linked leads/submissions
const { data: contact, pending: loading } = await useFetch(
  () => `/api/organization/${activeOrg.value?.data?.id}/contacts/${contactId.value}`,
  {
    watch: [() => activeOrg.value?.data?.id, contactId],
    immediate: !!activeOrg.value?.data?.id && !!contactId.value
  }
)

const formatPhone = (phone: string | null | undefined): string => {
  if (!phone)
    return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  } else if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

const formatDate = (date: string | Date | null | undefined): string => {
  if (!date)
    return '—'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (!amount)
    return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount)
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Back Button -->
    <UButton
      icon="i-lucide-arrow-left"
      variant="ghost"
      color="neutral"
      class="mb-4"
      @click="router.back()"
    >
      Back to Contacts
    </UButton>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-neutral-400"
      />
    </div>

    <!-- Not Found -->
    <UCard
      v-else-if="!contact"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-12 h-12 text-neutral-300 mx-auto mb-4"
      />
      <h3 class="text-lg font-medium mb-2">
        Contact not found
      </h3>
      <p class="text-neutral-500 mb-4">
        This contact may have been deleted or you don't have access.
      </p>
      <UButton
        label="Back to Contacts"
        @click="router.push(`/${route.params.slug}/contacts`)"
      />
    </UCard>

    <!-- Contact Details -->
    <div
      v-else
      class="space-y-6"
    >
      <!-- Header Card -->
      <UCard>
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-bold">
              {{ contact.name || 'Unnamed Contact' }}
            </h1>
            <p class="text-neutral-500">
              {{ contact.email || 'No email' }}
            </p>
            <p
              v-if="contact.company"
              class="text-sm text-neutral-400"
            >
              {{ contact.company }}
            </p>
          </div>
          <div
            v-if="contact.tags?.length"
            class="flex flex-wrap gap-2"
          >
            <UBadge
              v-for="tag in contact.tags"
              :key="tag"
              variant="subtle"
            >
              {{ tag }}
            </UBadge>
          </div>
        </div>

        <USeparator class="my-4" />

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-neutral-500">
              Phone
            </p>
            <p class="font-medium">
              {{ formatPhone(contact.phone) }}
            </p>
          </div>
          <div>
            <p class="text-neutral-500">
              Source
            </p>
            <p class="font-medium">
              {{ contact.source || '—' }}
            </p>
          </div>
          <div>
            <p class="text-neutral-500">
              Created
            </p>
            <p class="font-medium">
              {{ formatDate(contact.createdAt) }}
            </p>
          </div>
          <div>
            <p class="text-neutral-500">
              Updated
            </p>
            <p class="font-medium">
              {{ formatDate(contact.updatedAt) }}
            </p>
          </div>
        </div>

        <div
          v-if="contact.notes"
          class="mt-4"
        >
          <p class="text-neutral-500 text-sm mb-1">
            Notes
          </p>
          <p class="text-sm bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
            {{ contact.notes }}
          </p>
        </div>
      </UCard>

      <!-- Addresses -->
      <UCard v-if="contact.addresses?.length">
        <template #header>
          <h2 class="text-lg font-semibold">
            Addresses
          </h2>
        </template>

        <div class="space-y-4">
          <div
            v-for="address in contact.addresses"
            :key="address.id"
            class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4"
          >
            <div class="mb-3">
              <p class="font-medium">
                {{ address.streetAddress }}
                <span v-if="address.streetAddress2">, {{ address.streetAddress2 }}</span>
              </p>
              <p class="text-sm text-neutral-500">
                {{ address.addressLocality }}, {{ address.addressRegion }} {{ address.postalCode }}
              </p>
            </div>

            <!-- Roof Data if available -->
            <div
              v-if="address.roofAreaSqFt"
              class="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p class="text-xs text-blue-600 dark:text-blue-400">
                  Roof Area
                </p>
                <p class="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {{ address.roofAreaSqFt?.toLocaleString() }} sq ft
                </p>
              </div>
              <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <p class="text-xs text-green-600 dark:text-green-400">
                  Estimate
                </p>
                <p class="text-lg font-bold text-green-700 dark:text-green-300">
                  {{ formatCurrency(address.estimate) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Linked Leads -->
      <UCard v-if="contact.contactLeads?.length">
        <template #header>
          <h2 class="text-lg font-semibold">
            Linked Leads
          </h2>
        </template>

        <div class="space-y-2">
          <NuxtLink
            v-for="link in contact.contactLeads"
            :key="link.leadId"
            :to="`/${route.params.slug}/leads/${link.leadId}`"
            class="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <div class="flex items-center gap-3">
              <UIcon
                name="i-lucide-funnel"
                class="w-5 h-5 text-blue-500"
              />
              <span>Lead {{ link.leadId }}</span>
              <UBadge
                variant="subtle"
                size="sm"
              >
                {{ link.matchType }}
              </UBadge>
            </div>
            <UIcon
              name="i-lucide-chevron-right"
              class="w-4 h-4 text-neutral-400"
            />
          </NuxtLink>
        </div>
      </UCard>

      <!-- Linked Submissions -->
      <UCard v-if="contact.contactSubmissions?.length">
        <template #header>
          <h2 class="text-lg font-semibold">
            Linked Submissions
          </h2>
        </template>

        <div class="space-y-2">
          <NuxtLink
            v-for="link in contact.contactSubmissions"
            :key="link.submissionId"
            :to="`/${route.params.slug}/submissions/${link.submissionId}`"
            class="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <div class="flex items-center gap-3">
              <UIcon
                name="i-lucide-inbox"
                class="w-5 h-5 text-purple-500"
              />
              <span>Submission {{ link.submissionId }}</span>
              <UBadge
                variant="subtle"
                size="sm"
              >
                {{ link.matchType }}
              </UBadge>
            </div>
            <UIcon
              name="i-lucide-chevron-right"
              class="w-4 h-4 text-neutral-400"
            />
          </NuxtLink>
        </div>
      </UCard>

      <!-- Metadata -->
      <UCard v-if="contact.metadata && Object.keys(contact.metadata).length">
        <template #header>
          <h2 class="text-lg font-semibold">
            Metadata
          </h2>
        </template>

        <div class="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 overflow-x-auto">
          <pre class="text-sm">{{ JSON.stringify(contact.metadata, null, 2) }}</pre>
        </div>
      </UCard>
    </div>
  </div>
</template>
