<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { useActiveOrganization } = useAuth()
const activeOrg = useActiveOrganization()

definePageMeta({
  layout: 'dashboard'
})

const submissionId = computed(() => route.params.id as string)

// Fetch submission with addresses
const { data: submission, pending: loading } = await useFetch(
  () => `/api/organization/${activeOrg.value?.data?.id}/submissions/${submissionId.value}`,
  {
    watch: [() => activeOrg.value?.data?.id, submissionId],
    immediate: !!activeOrg.value?.data?.id && !!submissionId.value
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
      Back to Submissions
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
      v-else-if="!submission"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-12 h-12 text-neutral-300 mx-auto mb-4"
      />
      <h3 class="text-lg font-medium mb-2">
        Submission not found
      </h3>
      <p class="text-neutral-500 mb-4">
        This submission may have been deleted or you don't have access.
      </p>
      <UButton
        label="Back to Submissions"
        @click="router.push(`/${route.params.slug}/submissions`)"
      />
    </UCard>

    <!-- Submission Details -->
    <div
      v-else
      class="space-y-6"
    >
      <!-- Header Card -->
      <UCard>
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <UBadge variant="subtle">
                {{ submission.formName || 'Unknown Form' }}
              </UBadge>
            </div>
            <h1 class="text-2xl font-bold">
              {{ submission.name || 'Anonymous Submission' }}
            </h1>
            <p class="text-neutral-500">
              {{ submission.email || 'No email provided' }}
            </p>
          </div>
        </div>

        <USeparator class="my-4" />

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-neutral-500">
              Phone
            </p>
            <p class="font-medium">
              {{ formatPhone(submission.phone) }}
            </p>
          </div>
          <div>
            <p class="text-neutral-500">
              Submitted
            </p>
            <p class="font-medium">
              {{ formatDate(submission.createdAt) }}
            </p>
          </div>
          <div>
            <p class="text-neutral-500">
              Session ID
            </p>
            <p class="font-mono text-xs">
              {{ submission.session_id || '—' }}
            </p>
          </div>
          <div>
            <p class="text-neutral-500">
              Tool Session
            </p>
            <p class="font-mono text-xs">
              {{ submission.toolSessionId || '—' }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- Message -->
      <UCard v-if="submission.message">
        <template #header>
          <h2 class="text-lg font-semibold">
            Message
          </h2>
        </template>
        <p class="whitespace-pre-wrap">
          {{ submission.message }}
        </p>
      </UCard>

      <!-- Addresses / Roof Data -->
      <UCard v-if="submission.addresses?.length">
        <template #header>
          <h2 class="text-lg font-semibold">
            Addresses & Roof Estimates
          </h2>
        </template>

        <div class="space-y-4">
          <div
            v-for="address in submission.addresses"
            :key="address.id"
            class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4"
          >
            <!-- Address Info -->
            <div class="mb-3">
              <p class="font-medium">
                {{ address.streetAddress }}
                <span v-if="address.streetAddress2">, {{ address.streetAddress2 }}</span>
              </p>
              <p class="text-sm text-neutral-500">
                {{ address.addressLocality }}, {{ address.addressRegion }} {{ address.postalCode }}
                <span v-if="address.addressCountry">, {{ address.addressCountry }}</span>
              </p>
            </div>

            <!-- Roof Map -->
            <div
              v-if="address.latitude && address.longitude"
              class="mb-4"
            >
              <RoofMap
                :latitude="address.latitude"
                :longitude="address.longitude"
                :roof-outline-points="address.roofOutlinePoints"
              />
            </div>

            <!-- Roof Data -->
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

              <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                <p class="text-xs text-yellow-600 dark:text-yellow-400">
                  Price/Square
                </p>
                <p class="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                  {{ formatCurrency(address.pricePerSquare) }}
                </p>
              </div>

              <div
                v-if="address.predominantPitchType"
                class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3"
              >
                <p class="text-xs text-purple-600 dark:text-purple-400">
                  Roof Pitch
                </p>
                <p class="text-lg font-bold text-purple-700 dark:text-purple-300">
                  {{ address.predominantPitchType }}
                </p>
              </div>
            </div>

            <!-- Source & Timestamp -->
            <div class="flex items-center gap-4 mt-3 text-xs text-neutral-500">
              <span v-if="address.source">
                <UBadge
                  variant="subtle"
                  size="sm"
                >{{ address.source }}</UBadge>
              </span>
              <span>Created: {{ formatDate(address.createdAt) }}</span>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Metadata -->
      <UCard v-if="submission.metadata && Object.keys(submission.metadata).length">
        <template #header>
          <h2 class="text-lg font-semibold">
            Metadata
          </h2>
        </template>

        <div class="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 overflow-x-auto">
          <pre class="text-sm">{{ JSON.stringify(submission.metadata, null, 2) }}</pre>
        </div>
      </UCard>
    </div>
  </div>
</template>
