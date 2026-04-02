<script setup lang="ts">
import type { PlanKey } from '~~/shared/utils/plans'
import { getTierForInterval, PLAN_TIERS } from '~~/shared/utils/plans'

const props = defineProps<{
  open: boolean
  reason?: 'invite' | 'create-org'
  organizationId?: string
  teamName?: string
  teamSlug?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'upgraded': []
}>()

const selectedTier = ref<Exclude<PlanKey, 'free'>>('pro')
const loading = ref(false)
const toast = useToast()

// Use shared payment status composable
const { isPaymentFailed: hasPastDueSubscription, organizationId } = usePaymentStatus()

const availableTiers = computed(() => {
  return Object.values(PLAN_TIERS).sort((a, b) => a.order - b.order)
})

// Get the selected plan config
const selectedPlanConfig = computed(() => {
  return getTierForInterval(selectedTier.value, 'month')
})

// Open billing portal to fix payment
async function openBillingPortal() {
  const orgId = props.organizationId || organizationId.value
  if (!orgId)
    return
  loading.value = true
  try {
    const { url } = await $fetch('/api/stripe/portal', {
      method: 'POST',
      body: { organizationId: orgId }
    })
    if (url) {
      window.location.href = url
    }
  } catch (e) {
    console.error('Failed to open billing portal:', e)
    toast.add({ title: 'Failed to open billing portal', color: 'error' })
  } finally {
    loading.value = false
  }
}

const title = computed(() => {
  return 'Choose Your Plan'
})

const description = computed(() => {
  return 'Unlock more credits and features for your team'
})

const message = computed(() => {
  if (props.reason === 'invite') {
    return 'Upgrade to get more credits per month and unlock all features.'
  }
  return 'Choose a plan to unlock more credits and features.'
})

async function handleUpgrade() {
  if (!props.organizationId) {
    toast.add({ title: 'No organization found', color: 'error' })
    return
  }

  loading.value = true
  try {
    const { useActiveOrganization, client } = useAuth()
    const activeOrg = useActiveOrganization()
    const orgSlug = activeOrg.value?.data?.slug || props.teamSlug || 't'

    // Use Better Auth subscription.upgrade with selected tier
    const planId = selectedPlanConfig.value.id

    await client.subscription.upgrade({
      plan: planId,
      referenceId: props.organizationId,
      successUrl: `${window.location.origin}/${orgSlug}/billing?upgraded=true`,
      cancelUrl: `${window.location.href}`
    })

    emit('upgraded')
  } catch (e: any) {
    toast.add({
      title: 'Failed to start checkout',
      description: e.message,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="hasPastDueSubscription ? 'Payment Required' : title"
    :description="hasPastDueSubscription ? 'Your subscription has a payment issue' : description"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <!-- Past Due - Show fix payment UI -->
      <div
        v-if="hasPastDueSubscription"
        class="space-y-4"
      >
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <UIcon
              name="i-lucide-alert-triangle"
              class="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
            />
            <div>
              <h3 class="font-semibold text-red-800 dark:text-red-200">
                Payment Failed
              </h3>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                Your last payment was declined. Please update your payment method to continue using Pro features.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Normal upgrade UI -->
      <div
        v-else
        class="space-y-4"
      >
        <p class="text-sm text-muted-foreground">
          {{ message }}
        </p>

        <!-- Team Name and Slug (only for create-org) -->
        <div
          v-if="reason === 'create-org' && teamName && teamSlug"
          class="space-y-3 pb-4 border-b border-gray-200 dark:border-gray-700"
        >
          <div>
            <label class="text-sm font-medium">Team Name</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="flex items-center gap-2 text-sm">
                <UIcon
                  name="i-lucide-building-2"
                  class="w-4 h-4 text-gray-500"
                />
                <span>{{ teamName }}</span>
              </div>
            </div>
          </div>
          <div>
            <label class="text-sm font-medium">Team URL (Slug)</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="flex items-center gap-2 text-sm font-mono">
                <UIcon
                  name="i-lucide-link"
                  class="w-4 h-4 text-gray-500"
                />
                <span>{{ teamSlug }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="tier in availableTiers"
            :key="tier.key"
            class="relative border rounded-xl p-5 cursor-pointer transition-all"
            :class="[
              selectedTier === tier.key
                ? 'border-primary ring-2 ring-primary bg-primary/5'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
              tier.order === 2 ? 'md:scale-[1.02]' : ''
            ]"
            @click="selectedTier = tier.key as Exclude<PlanKey, 'free'>"
          >
            <div
              v-if="tier.order === 2"
              class="absolute -top-3 left-1/2 -translate-x-1/2"
            >
              <span class="px-3 py-1 text-xs font-bold bg-primary text-white rounded-full">
                Most Popular
              </span>
            </div>

            <div class="flex justify-between items-start mb-3">
              <div>
                <h3 class="font-bold text-lg">
                  {{ tier.name }}
                </h3>
                <p class="text-xs text-muted-foreground">
                  {{ tier.key === 'starter' ? 'For small teams' : 'For growing businesses' }}
                </p>
              </div>
              <UIcon
                v-if="selectedTier === tier.key"
                name="i-lucide-check-circle"
                class="w-6 h-6 text-primary"
              />
              <div
                v-else
                class="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"
              />
            </div>

            <div class="mb-4">
              <div class="flex items-baseline gap-1">
                <span class="text-3xl font-bold">
                  ${{ getTierForInterval(tier.key as Exclude<PlanKey, 'free'>, 'month').price.toFixed(2) }}
                </span>
                <span class="text-sm text-muted-foreground">
                  / month
                </span>
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                Unlimited team members
              </p>
            </div>

            <ul class="space-y-2">
              <li
                v-for="(feature, i) in tier.features"
                :key="i"
                class="flex items-start gap-2 text-sm"
              >
                <UIcon
                  name="i-lucide-check"
                  class="w-4 h-4 text-green-500 mt-0.5 shrink-0"
                />
                <span class="text-muted-foreground">{{ feature }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="outline"
        @click="emit('update:open', false)"
      />
      <!-- Past due - show fix payment button -->
      <UButton
        v-if="hasPastDueSubscription"
        label="Update Payment Method"
        color="error"
        icon="i-lucide-credit-card"
        :loading="loading"
        @click="openBillingPortal"
      />
      <!-- Normal upgrade button -->
      <UButton
        v-else
        :label="`Upgrade to ${PLAN_TIERS[selectedTier].name}`"
        color="primary"
        :loading="loading"
        @click="handleUpgrade"
      />
    </template>
  </UModal>
</template>
