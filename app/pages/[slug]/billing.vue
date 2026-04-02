<script setup lang="ts">
import type { PlanInterval, PlanKey } from '~~/shared/utils/plans'
import { getPlanKeyFromId, getPlanPricing, getTierForInterval, PLAN_TIERS } from '~~/shared/utils/plans'

definePageMeta({
  layout: 'dashboard'
})

const { useActiveOrganization, subscription: stripeSubscription, refreshActiveOrg } = useAuth()
const activeOrg = useActiveOrganization()
const router = useRouter()
const loading = ref(false)
const billingInterval = ref<PlanInterval>('month')
const route = useRoute()
const toast = useToast()
const showDowngradeModal = ref(false)
const downgradeData = ref<{ nextChargeDate: string, legacyWarning?: string | null }>({ nextChargeDate: '' })
const showUpgradeModal = ref(false)
const showTierChangeModal = ref(false)
const tierChangePreview = ref<any>(null)
const tierChangeLoading = ref(false)
const showTierChangePreview = ref(false)
const pendingTierChange = ref<{ tierKey: Exclude<PlanKey, 'free'>, interval: PlanInterval } | null>(null)

watchEffect(() => {
  showUpgradeModal.value = route.query.showUpgrade === 'true'
})

// Handle Stripe success redirect - poll for updated subscription
onMounted(async () => {
  if (route.query.success === 'true') {
    loading.value = true

    // Poll for up to 10 seconds (5 attempts x 2s)
    let attempts = 0
    const maxAttempts = 5

    while (attempts < maxAttempts) {
      // Wait 2s between checks
      await new Promise(resolve => setTimeout(resolve, 2000))

      console.log(`Checking for subscription update... (Attempt ${attempts + 1}/${maxAttempts})`)
      await refreshActiveOrg()

      // Check if we have a Pro subscription now
      const currentSubs = (activeOrg.value?.data as any)?.subscriptions || []
      const hasPro = currentSubs.some((s: any) => s.status === 'active' || s.status === 'trialing')

      if (hasPro) {
        console.log('Pro subscription found!')
        break
      }

      attempts++
    }

    loading.value = false

    // Clear the success param to clean up URL
    const newQuery = { ...route.query }
    delete newQuery.success

    // Handle redirect if present
    const redirectUrl = newQuery.redirect
    if (redirectUrl) {
      delete newQuery.redirect
      const target = decodeURIComponent(redirectUrl as string)

      if (target.startsWith('http')) {
        window.location.href = target
        return
      } else {
        router.push(target)
        return
      }
    }

    router.replace({ query: newQuery })

    toast.add({
      title: 'Subscription updated',
      description: 'Your plan has been successfully updated.',
      color: 'success'
    })
  }
})

const refresh = async () => {
  await refreshActiveOrg()
}

const { activeSub, isPaymentFailed } = usePaymentStatus()

// Get the current tier key from subscription plan ID
const currentTierKey = computed<PlanKey>(() => {
  if (!activeSub.value?.plan)
    return 'free'
  return getPlanKeyFromId(activeSub.value.plan)
})

const activePlan = computed(() => {
  const tierKey = currentTierKey.value === 'free' ? 'starter' : currentTierKey.value as Exclude<PlanKey, 'free'>
  return getTierForInterval(tierKey, 'month')
})

const currentSubPlanConfig = computed(() => {
  if (!activeSub.value)
    return null

  const pricing = getPlanPricing(activeSub.value.plan)
  if (pricing) {
    return {
      price: pricing.price,
      interval: pricing.interval
    }
  }

  return {
    price: activePlan.value.price,
    interval: 'month' as PlanInterval
  }
})

const currentPlan = computed(() => {
  if (activeSub.value) {
    const key = currentTierKey.value
    return key === 'free' ? 'starter' : key
  }
  return 'free'
})

// Get current interval from subscription
const currentBillingInterval = computed<PlanInterval>(() => {
  return 'month'
})

// Get current plan features from PLAN_TIERS
const currentPlanFeatures = computed<string[]>(() => {
  if (currentTierKey.value === 'free') {
    return ['60 credits per month', 'All features included', 'Unlimited team members']
  }
  const tier = PLAN_TIERS[currentTierKey.value as Exclude<PlanKey, 'free'>]
  return tier?.features || []
})

// Handle tier selection - fetch preview first
async function handleTierSelect(newTierKey: Exclude<PlanKey, 'free'>, newInterval: PlanInterval) {
  if (!activeOrg.value?.data?.id)
    return

  tierChangeLoading.value = true
  pendingTierChange.value = { tierKey: newTierKey, interval: newInterval }

  try {
    const preview = await $fetch('/api/stripe/preview-tier-change', {
      method: 'POST',
      body: {
        organizationId: activeOrg.value.data.id,
        newTierKey,
        newInterval
      }
    })

    tierChangePreview.value = preview
    showTierChangeModal.value = false
    showTierChangePreview.value = true
  } catch (e: any) {
    console.error('Preview error:', e)
    toast.add({
      title: 'Error',
      description: e.data?.statusMessage || 'Failed to preview plan change',
      color: 'error'
    })
  } finally {
    tierChangeLoading.value = false
  }
}

// Confirm tier change after preview
async function confirmTierChange() {
  if (!activeOrg.value?.data?.id || !pendingTierChange.value)
    return

  const { tierKey, interval } = pendingTierChange.value
  const tierName = PLAN_TIERS[tierKey]?.name || tierKey

  tierChangeLoading.value = true
  try {
    const result = await $fetch('/api/stripe/change-plan', {
      method: 'POST',
      body: {
        organizationId: activeOrg.value.data.id,
        newInterval: interval,
        newTierKey: tierKey
      }
    }) as any

    showTierChangePreview.value = false
    tierChangePreview.value = null
    pendingTierChange.value = null

    if (result.scheduledAt) {
      toast.add({
        title: 'Plan Change Scheduled',
        description: `Your plan will change to ${tierName} on ${new Date(result.scheduledAt).toLocaleDateString()}`,
        color: 'success'
      })
    } else {
      toast.add({
        title: result.isUpgrade ? 'Plan Upgraded!' : 'Plan Changed',
        description: result.isUpgrade
          ? `You've been upgraded to ${tierName}`
          : `Your plan has been changed to ${tierName}`,
        color: 'success'
      })
    }

    // Refresh to get updated subscription
    await refreshActiveOrg()
  } catch (e: any) {
    console.error('Tier change error:', e)
    toast.add({
      title: 'Error',
      description: e.data?.statusMessage || 'Failed to change plan',
      color: 'error'
    })
  } finally {
    tierChangeLoading.value = false
  }
}

function cancelTierChange() {
  showTierChangePreview.value = false
  tierChangePreview.value = null
  pendingTierChange.value = null
}

const isCanceled = computed(() => {
  return activeSub.value?.cancelAtPeriodEnd
})

const nextChargeDate = computed(() => {
  if (activeSub.value?.periodEnd) {
    return new Date(activeSub.value.periodEnd).toLocaleDateString()
  }
  return null
})

// Cost breakdown
const costBreakdown = computed(() => {
  if (!activeSub.value)
    return null

  const plan = currentSubPlanConfig.value
  if (!plan)
    return null

  return {
    totalCost: plan.price,
    interval: 'month'
  }
})

// Modal State
const modal = reactive({
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  confirmColor: 'primary',
  loading: false,
  onConfirm: async () => {}
})

function openModal(title: string, message: string, confirmLabel: string, confirmColor: string, onConfirm: () => Promise<void>) {
  modal.title = title
  modal.message = message
  modal.confirmLabel = confirmLabel
  modal.confirmColor = confirmColor
  modal.onConfirm = async () => {
    modal.loading = true
    try {
      await onConfirm()
    } finally {
      modal.loading = false
      modal.isOpen = false
    }
  }
  modal.isOpen = true
}

// Track which tier is being upgraded to (for loading state)
const selectedUpgradeTier = ref<Exclude<PlanKey, 'free'> | null>(null)

async function handleUpgradeWithTier(tierKey: Exclude<PlanKey, 'free'>) {
  if (!activeOrg.value?.data?.id)
    return

  loading.value = true
  selectedUpgradeTier.value = tierKey
  try {
    const selectedPlan = getTierForInterval(tierKey, billingInterval.value)
    const planName = selectedPlan.id

    const redirectParam = route.query.redirect ? `&redirect=${route.query.redirect}` : ''

    const { error } = await stripeSubscription.upgrade({
      plan: planName,
      referenceId: activeOrg.value.data.id,
      successUrl: `${window.location.origin}/${activeOrg.value.data.slug}/billing?success=true${redirectParam}`,
      cancelUrl: `${window.location.origin}/${activeOrg.value.data.slug}/billing?canceled=true${redirectParam}`,
      metadata: {
        organizationId: activeOrg.value.data.id
      }
    })

    if (error) {
      throw error
    }
    // The SDK handles the redirect automatically
  } catch (e: any) {
    console.error(e)
    // eslint-disable-next-line no-alert
    alert(`Failed to start checkout: ${e.message || 'Unknown error'}`)
    loading.value = false
    selectedUpgradeTier.value = null
  }
}

async function manageSubscription() {
  if (!activeOrg.value?.data?.id)
    return

  loading.value = true
  try {
    const { data, error } = await stripeSubscription.billingPortal({
      referenceId: activeOrg.value.data.id,
      returnUrl: window.location.href
    })

    if (error) {
      throw error
    }

    if (data?.url) {
      window.location.href = data.url
    }
  } catch (e: any) {
    console.error(e)
    // eslint-disable-next-line no-alert
    alert(`Failed to open billing portal: ${e.message || 'Unknown error'}`)
  } finally {
    loading.value = false
  }
}

async function cancelSubscription() {
  if (!activeOrg.value?.data?.id)
    return
  if (!activeSub.value?.stripeSubscriptionId)
    return

  loading.value = true

  await refresh()

  try {
    downgradeData.value.nextChargeDate = nextChargeDate.value || 'the end of your billing cycle'
    downgradeData.value.legacyWarning = null

    // Check for legacy pricing warning
    const currentPlanConfig = currentSubPlanConfig.value
    const latestPlanConfig = activePlan.value

    if (currentPlanConfig && latestPlanConfig && currentPlanConfig.price < latestPlanConfig.price) {
      const currentPrice = `$${currentPlanConfig.price.toFixed(2)}`
      const latestPrice = `$${latestPlanConfig.price.toFixed(2)}`
      downgradeData.value.legacyWarning = `Warning: You are currently on a legacy plan (${currentPrice}). If you downgrade, re-subscribing later will cost the new rate of ${latestPrice}.`
    }

    loading.value = false
    showDowngradeModal.value = true
  } catch (e) {
    console.error('Error preparing cancellation:', e)
    loading.value = false
  }
}

async function confirmDowngrade() {
  if (!activeOrg.value?.data?.id || !activeSub.value?.stripeSubscriptionId)
    return

  loading.value = true
  showDowngradeModal.value = false

  try {
    // Use custom API endpoint for cancellation to handle organization-based billing correctly
    await $fetch('/api/stripe/cancel', {
      method: 'POST',
      body: {
        subscriptionId: activeSub.value.stripeSubscriptionId,
        referenceId: activeOrg.value.data.id
      }
    })

    // Refresh subscription data to update UI
    window.location.reload()
  } catch (e: any) {
    console.error(e)
    // eslint-disable-next-line no-alert
    alert(`Failed to cancel subscription: ${e.message || 'Unknown error'}`)
  } finally {
    loading.value = false
  }
}

async function resumeSubscription() {
  if (!activeOrg.value?.data?.id)
    return
  if (!activeSub.value?.stripeSubscriptionId)
    return

  const date = nextChargeDate.value || 'the next billing cycle'

  openModal(
    'Resume Subscription',
    `Are you sure you want to resume your subscription? Your plan will renew at no cost to you until the next billing cycle which is ${date}.`,
    'Yes, Resume',
    'primary',
    async () => {
      loading.value = true
      try {
        await $fetch('/api/stripe/resume', {
          method: 'POST',
          body: {
            subscriptionId: activeSub.value!.stripeSubscriptionId,
            referenceId: activeOrg.value!.data!.id
          }
        })

        // Refresh subscription data to update UI
        await refresh()
      } catch (e: any) {
        console.error(e)
        // eslint-disable-next-line no-alert
        alert(`Failed to resume subscription: ${e.message || 'Unknown error'}`)
      } finally {
        loading.value = false
      }
    }
  )
}

const invoiceHistoryRef = ref<{ refresh: () => void } | null>(null)
const portalLoading = ref(false)

async function openBillingPortal() {
  if (!activeOrg.value?.data?.id)
    return

  portalLoading.value = true
  try {
    const { url } = await $fetch('/api/stripe/portal', {
      method: 'POST',
      body: {
        organizationId: activeOrg.value.data.id,
        returnUrl: window.location.href
      }
    })
    if (url) {
      window.location.href = url
    }
  } catch (e: any) {
    console.error('Failed to open billing portal:', e)
    toast.add({
      title: 'Failed to open billing portal',
      description: e.data?.message || e.message,
      color: 'error'
    })
  } finally {
    portalLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-8 max-w-5xl">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Billing
      </h1>
      <div class="flex gap-2">
        <UButton
          v-if="currentPlan !== 'free'"
          label="Manage Billing"
          color="gray"
          variant="ghost"
          icon="i-lucide-credit-card"
          :loading="loading"
          class="cursor-pointer"
          @click="manageSubscription"
        />
        <UButton
          v-if="currentPlan !== 'free' && !isCanceled"
          label="Downgrade to Free"
          color="red"
          variant="ghost"
          :loading="loading"
          class="cursor-pointer"
          @click="cancelSubscription"
        />
        <UButton
          v-if="currentPlan !== 'free' && isCanceled"
          label="Resume Subscription"
          color="primary"
          variant="solid"
          :loading="loading"
          class="cursor-pointer"
          @click="resumeSubscription"
        />
      </div>
    </div>

    <!-- Current Plan Section -->
    <UCard>
      <div class="flex flex-col md:flex-row gap-6 justify-between">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <h2 class="text-xl font-bold">
              {{ currentPlan === 'free' ? 'Free Plan' : (currentPlan === 'starter' ? 'Starter Plan' : 'Pro Plan') }}
            </h2>
            <UBadge
              :color="currentPlan !== 'free' ? 'primary' : 'neutral'"
              variant="solid"
            >
              Current plan
            </UBadge>
            <UBadge
              v-if="isCanceled"
              color="warning"
              variant="subtle"
            >
              Cancels on {{ nextChargeDate }}
            </UBadge>
            <UBadge
              v-if="activeSub?.status === 'past_due'"
              color="error"
              variant="solid"
            >
              Payment Failed
            </UBadge>
          </div>

          <!-- Cost Breakdown -->
          <div
            v-if="costBreakdown"
            class="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
          >
            <div class="flex justify-between text-sm">
              <span class="font-semibold">{{ currentPlan === 'starter' ? 'Starter' : 'Pro' }} Plan</span>
              <span class="font-bold text-lg">${{ costBreakdown.totalCost.toFixed(2) }} / {{ costBreakdown.interval }}</span>
            </div>
          </div>

          <div
            v-if="currentPlan === 'free'"
            class="text-4xl font-bold mb-1"
          >
            $0 <span class="text-base font-normal text-muted-foreground">/ month</span>
          </div>

          <div
            v-if="currentPlan !== 'free' && nextChargeDate && !isCanceled"
            class="text-sm text-muted-foreground mt-1"
          >
            Next charge on {{ nextChargeDate }}
          </div>

          <!-- Payment Failed - Show focused fix payment UI -->
          <BillingPaymentFailedCard support-email="support@example.com" />

          <!-- Normal plan management (hide when payment failed) -->
          <template v-if="!isPaymentFailed">
            <!-- Plan Management Buttons -->
            <div
              v-if="currentPlan !== 'free' && !isCanceled"
              class="mt-4 flex flex-wrap gap-2"
            >
              <UButton
                variant="outline"
                size="sm"
                icon="i-lucide-arrow-up-down"
                @click="showTierChangeModal = true"
              >
                Change Plan
              </UButton>
            </div>

            <!-- Payment Method -->
            <div
              v-if="currentPlan !== 'free'"
              class="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800"
            >
              <h3 class="text-sm font-semibold mb-2">
                Payment Method
              </h3>
              <p class="text-xs text-muted-foreground mb-3">
                Update your card, view billing history, or manage your subscription in the Stripe portal.
              </p>
              <UButton
                size="sm"
                variant="outline"
                color="neutral"
                icon="i-lucide-credit-card"
                :loading="portalLoading"
                @click="openBillingPortal"
              >
                Manage Payment Method
              </UButton>
            </div>
          </template>
        </div>

        <div class="flex-1">
          <h3 class="font-medium mb-3">
            What's included:
          </h3>
          <div class="grid grid-cols-1 gap-y-2">
            <div
              v-for="feature in currentPlanFeatures"
              :key="feature"
              class="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <UIcon
                name="i-lucide-check"
                class="w-4 h-4 text-green-500 mt-0.5 shrink-0"
              />
              <span>{{ feature }}</span>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Credit Usage -->
    <BillingCreditUsageCard />

    <!-- Invoice History (Only show for Pro users) -->
    <UCard v-if="currentPlan !== 'free'">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-receipt"
            class="w-5 h-5 text-muted-foreground"
          />
          <h3 class="text-lg font-semibold">
            Invoice History
          </h3>
        </div>
      </template>

      <LazyBillingInvoiceHistory
        v-if="activeOrg?.data?.id"
        ref="invoiceHistoryRef"
        :organization-id="activeOrg.data.id"
      />
    </UCard>

    <!-- Upgrade Section (Only show if free) -->
    <!-- Upgrade Section - Show all plans -->
    <div
      v-if="currentPlan === 'free'"
      class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 p-6 md:p-8"
    >
      <!-- Background decoration -->
      <div class="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div class="relative">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <UIcon
                name="i-lucide-zap"
                class="w-5 h-5 text-primary"
              />
              <span class="text-xs font-semibold text-primary uppercase tracking-wider">Choose Your Plan</span>
            </div>
            <h2 class="text-2xl font-bold">
              Unlock Your Full Potential
            </h2>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="tier in Object.values(PLAN_TIERS).sort((a, b) => a.order - b.order)"
            :key="tier.key"
            class="relative bg-white dark:bg-gray-900 rounded-xl shadow-lg border overflow-hidden transition-all hover:shadow-xl"
            :class="tier.order === 2 ? 'border-primary ring-2 ring-primary' : 'border-gray-200 dark:border-gray-700'"
          >
            <!-- Popular Badge -->
            <div
              v-if="tier.order === 2"
              class="absolute top-0 right-0"
            >
              <div class="bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                Most Popular
              </div>
            </div>

            <div class="p-6">
              <!-- Plan Header -->
              <div class="mb-4">
                <h3 class="text-xl font-bold">
                  {{ tier.name }}
                </h3>
                <p class="text-sm text-muted-foreground">
                  {{ tier.key === 'starter' ? 'For small teams' : 'For growing businesses' }}
                </p>
              </div>

              <!-- Price -->
              <div class="mb-4">
                <div class="flex items-baseline gap-1">
                  <span class="text-4xl font-bold">${{ getTierForInterval(tier.key as Exclude<PlanKey, 'free'>, 'month').price.toFixed(2) }}</span>
                  <span class="text-muted-foreground">/ month</span>
                </div>
                <p class="text-sm text-muted-foreground mt-1">
                  Unlimited team members
                </p>
              </div>

              <!-- CTA Button -->
              <UButton
                size="lg"
                :label="`Upgrade to ${tier.name}`"
                :color="tier.order === 2 ? 'primary' : 'neutral'"
                :variant="tier.order === 2 ? 'solid' : 'outline'"
                :loading="loading && selectedUpgradeTier === tier.key"
                class="w-full mb-4"
                @click="handleUpgradeWithTier(tier.key as Exclude<PlanKey, 'free'>)"
              >
                <template #trailing>
                  <UIcon name="i-lucide-arrow-right" />
                </template>
              </UButton>

              <!-- Features -->
              <div class="space-y-2">
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  What's included:
                </p>
                <ul class="space-y-2">
                  <li
                    v-for="(feature, i) in tier.features"
                    :key="i"
                    class="flex items-start gap-2 text-sm"
                  >
                    <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <UIcon
                        name="i-lucide-check"
                        class="w-3 h-3 text-primary"
                      />
                    </div>
                    <span>{{ feature }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirmation Modal -->
      <UModal
        v-model:open="modal.isOpen"
        :title="modal.title"
        :description="modal.message"
      >
        <template #footer>
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            :disabled="modal.loading"
            @click="modal.isOpen = false"
          />
          <UButton
            :label="modal.confirmLabel"
            :color="modal.confirmColor"
            variant="solid"
            :loading="modal.loading"
            @click="modal.onConfirm"
          />
        </template>
      </UModal>

      <!-- Downgrade Confirmation Modal -->
      <UModal
        v-model:open="showDowngradeModal"
        title="Downgrade to Free Plan"
      >
        <template #body>
          <div class="space-y-4">
            <div
              v-if="downgradeData.legacyWarning"
              class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200 flex gap-2 items-start"
            >
              <UIcon
                name="i-lucide-trending-up"
                class="w-5 h-5 shrink-0 mt-0.5"
              />
              <span>{{ downgradeData.legacyWarning }}</span>
            </div>

            <p class="text-sm">
              Your subscription will be canceled. You'll be moved to the Free plan with 60 credits per month.
            </p>

            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div class="flex items-center gap-2 text-sm">
                <UIcon
                  name="i-lucide-calendar"
                  class="w-4 h-4 text-blue-600 dark:text-blue-400"
                />
                <span class="font-medium">Active Until:</span>
                <span>{{ downgradeData.nextChargeDate }}</span>
              </div>
            </div>
          </div>
        </template>

        <template #footer>
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="showDowngradeModal = false"
          />
          <UButton
            label="Yes, Downgrade"
            color="error"
            :loading="loading"
            @click="confirmDowngrade"
          />
        </template>
      </UModal>

      <!-- Upgrade Modal for new teams -->
      <BillingUpgradeModal
        v-model:open="showUpgradeModal"
        :organization-id="activeOrg?.data?.id"
        :team-name="activeOrg?.data?.name"
        :team-slug="activeOrg?.data?.slug"
      />

      <!-- Tier Change Modal (Pro <-> Pro+) -->
      <UModal
        v-model:open="showTierChangeModal"
        title="Change Your Plan"
        :ui="{ content: 'max-w-3xl' }"
      >
        <template #body>
          <BillingTierSelector
            :current-tier-key="currentTierKey"
            :current-interval="currentBillingInterval"
            :is-trialing="false"
            @select="handleTierSelect"
          />

          <div
            v-if="tierChangeLoading"
            class="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-loader-2"
                class="w-5 h-5 animate-spin"
              />
              <span>Loading preview...</span>
            </div>
          </div>
        </template>

        <template #footer>
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="showTierChangeModal = false"
          />
        </template>
      </UModal>

      <!-- Tier Change Preview Modal -->
      <UModal
        v-model:open="showTierChangePreview"
        title="Confirm Plan Change"
      >
        <template #body>
          <BillingTierChangePreview
            :preview="tierChangePreview"
            :loading="tierChangeLoading"
            @confirm="confirmTierChange"
            @cancel="cancelTierChange"
          />
        </template>
      </UModal>
    </div>
  </div>
</template>
