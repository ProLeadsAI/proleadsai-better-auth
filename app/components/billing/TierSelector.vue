<script setup lang="ts">
import type { PlanInterval, PlanKey } from '~~/shared/utils/plans'
import { getTierForInterval, PAID_TIERS, PLAN_TIERS } from '~~/shared/utils/plans'

const props = defineProps<{
  currentTierKey: PlanKey
  currentInterval: PlanInterval
  isTrialing?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', tierKey: Exclude<PlanKey, 'free'>, interval: PlanInterval): void
}>()

// Get plan config for display
function getPlanConfig(tierKey: Exclude<PlanKey, 'free'>) {
  return getTierForInterval(tierKey, 'month')
}

// Check if this is the current plan
function isCurrentPlan(tierKey: string) {
  return tierKey === props.currentTierKey
}

// Check if this tier is the current tier (regardless of interval)
function isCurrentTier(tierKey: string) {
  return tierKey === props.currentTierKey
}

// Check if this is an upgrade or downgrade
function getPlanAction(tierKey: Exclude<PlanKey, 'free'>) {
  if (tierKey === props.currentTierKey)
    return 'current'

  const currentTier = PLAN_TIERS[props.currentTierKey as Exclude<PlanKey, 'free'>]
  const targetTier = PLAN_TIERS[tierKey]

  if (!currentTier)
    return 'upgrade' // Free user

  if (targetTier.order > currentTier.order)
    return 'upgrade'
  if (targetTier.order < currentTier.order)
    return 'downgrade'

  return 'current'
}

function getButtonLabel(tierKey: Exclude<PlanKey, 'free'>) {
  const action = getPlanAction(tierKey)
  if (action === 'current')
    return 'Current Plan'
  if (action === 'upgrade')
    return 'Upgrade'
  return 'Downgrade'
}

function getButtonColor(tierKey: Exclude<PlanKey, 'free'>) {
  const action = getPlanAction(tierKey)
  if (action === 'current')
    return 'neutral'
  if (action === 'upgrade')
    return 'primary'
  return 'neutral'
}

function handleSelect(tierKey: Exclude<PlanKey, 'free'>) {
  if (!isCurrentPlan(tierKey))
    emit('select', tierKey, 'month')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Tier Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        v-for="tier in PAID_TIERS"
        :key="tier.key"
        class="relative rounded-xl border-2 transition-all"
        :class="[
          isCurrentTier(tier.key)
            ? 'border-primary bg-primary/5'
            : 'border-gray-200 dark:border-gray-700 hover:border-primary/50',
          tier.order === 2 ? 'ring-2 ring-primary ring-offset-2' : ''
        ]"
      >
        <!-- Popular Badge -->
        <div
          v-if="tier.order === 2"
          class="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full"
        >
          Most Popular
        </div>

        <!-- Current Plan Badge -->
        <div
          v-if="isCurrentTier(tier.key)"
          class="absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full"
        >
          Current
        </div>

        <div class="p-6">
          <!-- Header -->
          <div class="mb-4">
            <h3 class="text-xl font-bold">
              {{ tier.name }}
            </h3>
            <p class="text-sm text-muted-foreground mt-1">
              {{ tier.order === 1 ? 'For individuals and small teams' : 'For growing businesses' }}
            </p>
          </div>

          <!-- Price -->
          <div class="mb-6">
            <div class="flex items-baseline gap-1">
              <span class="text-4xl font-bold">${{ getPlanConfig(tier.key as Exclude<PlanKey, 'free'>).price.toFixed(2) }}</span>
              <span class="text-muted-foreground">/mo</span>
            </div>
            <p class="text-sm text-muted-foreground mt-1">
              Unlimited team members
            </p>
          </div>

          <!-- Features -->
          <ul class="space-y-2 mb-6">
            <li
              v-for="feature in tier.features"
              :key="feature"
              class="flex items-center gap-2 text-sm"
            >
              <UIcon
                name="i-lucide-check"
                class="w-4 h-4 text-green-500 shrink-0"
              />
              <span>{{ feature }}</span>
            </li>
          </ul>

          <!-- CTA Button -->
          <UButton
            :label="getButtonLabel(tier.key as Exclude<PlanKey, 'free'>)"
            :color="getButtonColor(tier.key as Exclude<PlanKey, 'free'>)"
            :disabled="isCurrentPlan(tier.key)"
            block
            size="lg"
            class="cursor-pointer"
            @click="handleSelect(tier.key as Exclude<PlanKey, 'free'>)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
