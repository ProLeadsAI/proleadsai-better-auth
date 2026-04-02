<script setup lang="ts">
const localePath = useLocalePath()
const route = useRoute()
const { used, limit, usagePercent, isLow, isExhausted, refillDate, balanceLoading } = useCreditBalance()

const slug = computed(() => route.params.slug as string)

// Tooltip text
const tooltipText = computed(() => {
  if (balanceLoading.value)
    return 'Loading credits...'
  if (limit.value === null)
    return 'Unlimited credits'
  if (isExhausted.value)
    return 'No credits remaining - upgrade your plan'
  if (isLow.value)
    return `Low credits - refills ${refillDate.value}`

  return `Credits refill ${refillDate.value}`
})

// Display text
const displayText = computed(() => {
  if (limit.value === null)
    return '∞'

  return `${used.value} / ${limit.value}`
})

// Icon based on status
const icon = computed(() => {
  if (isExhausted.value)
    return 'i-lucide-battery-warning'
  if (isLow.value)
    return 'i-lucide-battery-low'
  if (usagePercent.value >= 50)
    return 'i-lucide-battery-medium'

  return 'i-lucide-battery-full'
})

// Color classes
const colorClass = computed(() => {
  if (isExhausted.value)
    return 'text-red-500 dark:text-red-400'
  if (isLow.value)
    return 'text-amber-500 dark:text-amber-400'

  return 'text-muted-foreground'
})
</script>

<template>
  <UTooltip :text="tooltipText">
    <NuxtLink
      :to="localePath(`/${slug}/billing`)"
      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
      :class="colorClass"
    >
      <UIcon
        :name="icon"
        class="w-4 h-4"
      />
      <span
        v-if="!balanceLoading"
        class="font-medium tabular-nums"
      >
        {{ displayText }}
      </span>
      <span
        v-if="!balanceLoading && limit !== null"
        class="hidden sm:inline text-xs opacity-70"
      >
        credits
      </span>
    </NuxtLink>
  </UTooltip>
</template>
