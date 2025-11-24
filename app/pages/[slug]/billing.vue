<script setup lang="ts">
import { PLANS } from '~~/shared/utils/plans'

definePageMeta({
  layout: 'dashboard'
})

const { useActiveOrganization, subscription: stripeSubscription } = useAuth()
const activeOrg = useActiveOrganization()
const loading = ref(false)
const billingInterval = ref<'month' | 'year'>('month')

// Fetch subscription for the active organization
const { data: subscriptions, refresh } = await useFetch('/api/auth/subscription/list', {
  query: computed(() => ({
    referenceId: activeOrg.value?.data?.id
  })),
  headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
})

const activeSub = computed(() => {
  if (!subscriptions.value) return null
  // subscriptions.value might be the array directly or wrapped? 
  // better-auth API returns array.
  return (subscriptions.value as any[]).find(
    sub => sub.status === 'active' || sub.status === 'trialing'
  )
})

const activePlan = computed(() => {
    return billingInterval.value === 'month' ? PLANS.PRO_MONTHLY : PLANS.PRO_YEARLY
})

const currentPlan = computed(() => {
    if (activeSub.value) {
        return 'pro'
    }
    return 'free' 
})

const isCanceled = computed(() => {
    return activeSub.value?.cancelAtPeriodEnd
})

const trialInfo = computed(() => {
    if (!activeSub.value?.trialEnd) return null
    const trialEnd = new Date(activeSub.value.trialEnd)
    const now = new Date()
    const diffTime = trialEnd.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return {
        daysLeft: diffDays > 0 ? diffDays : 0,
        endDate: trialEnd.toLocaleDateString()
    }
})

const nextChargeDate = computed(() => {
    if (activeSub.value?.periodEnd) {
        return new Date(activeSub.value.periodEnd).toLocaleDateString()
    }
    return null
})

async function handleUpgrade() {
    if (!activeOrg.value?.data?.id) return

    loading.value = true
    try {
        const planName = billingInterval.value === 'month' ? 'pro-monthly' : 'pro-yearly'
        
        const { error } = await stripeSubscription.upgrade({
            plan: planName,
            referenceId: activeOrg.value.data.id,
            successUrl: `${window.location.origin}/${activeOrg.value.data.slug}/billing?success=true`,
            cancelUrl: `${window.location.origin}/${activeOrg.value.data.slug}/billing?canceled=true`,
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
        alert('Failed to start checkout: ' + (e.message || 'Unknown error'))
        loading.value = false
    }
}

async function manageSubscription() {
    if (!activeOrg.value?.data?.id) return

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
        alert('Failed to open billing portal: ' + (e.message || 'Unknown error'))
    } finally {
        loading.value = false
    }
}

async function cancelSubscription() {
    if (!activeOrg.value?.data?.id) return
    if (!activeSub.value?.stripeSubscriptionId) return
    if (!confirm('Are you sure you want to downgrade to the free plan? You will lose access to pro features at the end of your current billing period.')) return

    loading.value = true
    try {
        const { error } = await stripeSubscription.cancel({
            subscriptionId: activeSub.value.stripeSubscriptionId,
            referenceId: activeOrg.value.data.id,
            returnUrl: window.location.href
        })
        
        if (error) throw error
        
        // Refresh subscription data to update UI
        await refresh()
    } catch (e: any) {
        console.error(e)
        alert('Failed to cancel subscription: ' + (e.message || 'Unknown error'))
    } finally {
        loading.value = false
    }
}
</script>

<template>
  <div class="flex flex-col gap-8 max-w-5xl">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">Billing</h1>
        <div class="flex gap-2">
            <UButton 
                v-if="currentPlan !== 'free' && !isCanceled"
                label="Downgrade to Free" 
                color="red" 
                variant="ghost" 
                :loading="loading"
                @click="cancelSubscription"
                class="cursor-pointer"
            />
            <UButton 
                v-if="currentPlan !== 'free'"
                label="Invoices" 
                color="gray" 
                variant="ghost" 
                icon="i-lucide-file-text"
                :loading="loading"
                @click="manageSubscription"
                class="cursor-pointer"
            />
            <UButton 
                v-if="currentPlan !== 'free'"
                label="Manage Subscription" 
                color="gray" 
                variant="ghost" 
                icon="i-lucide-credit-card"
                :loading="loading"
                @click="manageSubscription"
                class="cursor-pointer"
            />
        </div>
    </div>

    <!-- Current Plan Section -->
    <UCard>
        <div class="flex flex-col md:flex-row gap-6 justify-between">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <h2 class="text-xl font-bold">{{ currentPlan === 'pro' ? 'Pro Plan' : 'Free Plan' }}</h2>
                    <UBadge :color="currentPlan === 'pro' ? 'primary' : 'gray'" variant="solid">Current plan</UBadge>
                    <UBadge v-if="isCanceled" color="orange" variant="subtle">Cancels at end of period</UBadge>
                    <UBadge v-if="activeSub?.status === 'trialing' && trialInfo" color="green" variant="subtle">Trial Active: {{ trialInfo.daysLeft }} days left</UBadge>
                </div>
                <div v-if="currentPlan === 'free'" class="text-4xl font-bold mb-1">$0 <span class="text-base font-normal text-muted-foreground">/ month</span></div>
                <div v-else class="text-4xl font-bold mb-1">
                    {{ activeSub?.plan === PLANS.PRO_YEARLY.key ? PLANS.PRO_YEARLY.price : PLANS.PRO_MONTHLY.price }}
                    <span class="text-base font-normal text-muted-foreground">/ {{ activeSub?.plan === PLANS.PRO_YEARLY.key ? 'year' : 'month' }}</span>
                </div>
                <div v-if="activeSub?.status === 'trialing' && trialInfo" class="text-sm text-muted-foreground mt-1">
                    Free trial ends on {{ trialInfo.endDate }}. You will be charged {{ activeSub?.plan === PLANS.PRO_YEARLY.key ? PLANS.PRO_YEARLY.price : PLANS.PRO_MONTHLY.price }} on that date.
                </div>
                <div v-else-if="currentPlan === 'pro' && nextChargeDate && !isCanceled" class="text-sm text-muted-foreground mt-1">
                    Next charge on {{ nextChargeDate }}
                </div>
            </div>

            <div class="flex-1 max-w-lg">
                <h3 class="font-medium mb-3">What's included:</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <UIcon name="i-lucide-check" class="w-4 h-4 text-green-500" />
                        WordPress Plugin Access
                    </div>
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <UIcon name="i-lucide-check" class="w-4 h-4 text-green-500" />
                        Basic Analytics (Total Searches)
                    </div>
                     <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <UIcon name="i-lucide-check" class="w-4 h-4 text-green-500" />
                        Email Lead Notifications
                    </div>
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <UIcon name="i-lucide-check" class="w-4 h-4 text-green-500" />
                        Up to 3 Team Members
                    </div>
                </div>
            </div>
        </div>
    </UCard>

    <div v-if="currentPlan === 'free'" class="flex items-center gap-4">
        <div class="h-8 w-[1px] bg-gray-200 dark:bg-gray-700"></div>
        <span class="text-sm font-medium text-muted-foreground">Upgrade plan</span>
    </div>

    <!-- Upgrade Section (Only show if free) -->
    <div v-if="currentPlan === 'free'" class="space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold">Upgrade plan</h2>
                <p class="text-sm text-muted-foreground mt-1">
                    Unlock the full power of the Roofing CRM. Manage leads, run estimates, and grow your business.
                </p>
            </div>
             <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button 
                    class="px-3 py-1 text-sm font-medium rounded-md transition-all"
                    :class="billingInterval === 'month' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-muted-foreground'"
                    @click="billingInterval = 'month'"
                >
                    Monthly
                </button>
                <button 
                    class="px-3 py-1 text-sm font-medium rounded-md transition-all"
                    :class="billingInterval === 'year' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-muted-foreground'"
                    @click="billingInterval = 'year'"
                >
                    Yearly
                </button>
            </div>
        </div>

        <!-- Pro Plan Card -->
        <UCard class="border-primary ring-1 ring-primary/50">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="flex flex-col justify-between">
                    <div>
                        <h3 class="text-xl font-bold mb-2">Pro Plan</h3>
                        <div class="text-3xl font-bold mb-2">{{ activePlan.price }} <span class="text-base font-normal text-muted-foreground">/ {{ activePlan.interval }}</span></div>
                        <p class="text-sm text-muted-foreground mb-6">{{ activePlan.description }}</p>
                    </div>
                    <UButton 
                        block
                        label="Upgrade to Pro" 
                        color="primary" 
                        :loading="loading"
                        @click="handleUpgrade"
                        class="cursor-pointer mt-auto"
                    />
                </div>

                <div class="md:col-span-2 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 pt-6 md:pt-0 md:pl-8">
                    <h4 class="font-medium mb-4">Everything in Free, plus:</h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        <div v-for="(feature, i) in activePlan.features" :key="i" class="flex items-center gap-2 text-sm">
                            <UIcon name="i-lucide-check-circle" class="w-5 h-5 text-primary shrink-0" />
                            <span>{{ feature }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </UCard>
    </div>
  </div>
</template>
