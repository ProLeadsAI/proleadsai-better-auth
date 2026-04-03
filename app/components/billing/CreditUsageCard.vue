<script setup lang="ts">
const { used, limit, remaining, usagePercent, isLow, isExhausted, refillDate, daysUntilRefill, organizationId, CREDIT_COSTS, balanceLoading } = useCreditBalance()

const progressBarClass = computed(() => {
  if (isExhausted.value)
    return 'bg-red-500'
  if (isLow.value)
    return 'bg-amber-500'

  return 'bg-primary'
})

// Activity timeline
const { data: activityData, pending: activityLoading } = useFetch<{
  items: Array<{
    id: string
    action: string
    creditsCost: number
    description: string
    metadata: Record<string, any> | null
    createdAt: string
  }>
  hasMore: boolean
  nextCursor: string | null
}>('/api/credits/activity', {
  query: { organizationId, limit: 20 },
  watch: [organizationId],
  immediate: true
})

const activities = computed(() => activityData.value?.items || [])

// Action icon mapping
const actionIcons: Record<string, string> = {
  search: 'i-lucide-search',
  lead_submit: 'i-lucide-user-plus'
}

// Action color mapping
const actionColors: Record<string, string> = {
  search: 'text-blue-500',
  lead_submit: 'text-green-500'
}

// Relative time formatting
function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1)
    return 'just now'
  if (diffMins < 60)
    return `${diffMins}m ago`
  if (diffHours < 24)
    return `${diffHours}h ago`
  if (diffDays < 7)
    return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <UCard>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-zap"
            class="w-5 h-5 text-primary"
          />
          <h2 class="text-lg font-semibold">
            Credit Usage
          </h2>
        </div>
        <UBadge
          v-if="isExhausted"
          color="error"
          variant="subtle"
        >
          No credits remaining
        </UBadge>
        <UBadge
          v-else-if="isLow"
          color="warning"
          variant="subtle"
        >
          Running low
        </UBadge>
      </div>

      <!-- Credit Balance Display -->
      <div v-if="!balanceLoading">
        <!-- Main counter -->
        <div class="flex items-baseline gap-2 mb-3">
          <span class="text-4xl font-bold tabular-nums">
            {{ limit === null ? '∞' : remaining }}
          </span>
          <span
            v-if="limit !== null"
            class="text-lg text-muted-foreground"
          >
            / {{ limit }} credits remaining
          </span>
          <span
            v-else
            class="text-lg text-muted-foreground"
          >
            unlimited credits
          </span>
        </div>

        <!-- Progress bar -->
        <div
          v-if="limit !== null"
          class="space-y-2"
        >
          <div class="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              class="h-full rounded-full transition-[width] duration-300 ease-out"
              :class="progressBarClass"
              :style="{ width: `${usagePercent}%` }"
            />
          </div>
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>{{ used }} used</span>
            <span>{{ limit }} total</span>
          </div>
        </div>

        <!-- Refill info -->
        <div
          v-if="refillDate"
          class="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <UIcon
            name="i-lucide-refresh-cw"
            class="w-4 h-4"
          />
          <span>
            Credits refill on <strong class="text-foreground">{{ refillDate }}</strong>
            <template v-if="daysUntilRefill !== null">
              ({{ daysUntilRefill === 0 ? 'today' : daysUntilRefill === 1 ? 'tomorrow' : `in ${daysUntilRefill} days` }})
            </template>
          </span>
        </div>

        <!-- Credit cost legend -->
        <div class="mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Credit Costs
          </h4>
          <div class="flex gap-6 text-sm">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-search"
                class="w-4 h-4 text-blue-500"
              />
              <span>Search</span>
              <UBadge
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ CREDIT_COSTS.search }} credits
              </UBadge>
            </div>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-user-plus"
                class="w-4 h-4 text-green-500"
              />
              <span>Lead Submission</span>
              <UBadge
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ CREDIT_COSTS.lead_submit }} credits
              </UBadge>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div
        v-else
        class="space-y-3"
      >
        <USkeleton class="h-10 w-48" />
        <USkeleton class="h-3 w-full" />
        <USkeleton class="h-4 w-64" />
      </div>

      <!-- Activity Timeline -->
      <div class="border-t border-neutral-200 dark:border-neutral-700 pt-5">
        <h3 class="text-sm font-semibold mb-4 flex items-center gap-2">
          <UIcon
            name="i-lucide-history"
            class="w-4 h-4"
          />
          Recent Activity
        </h3>

        <div
          v-if="activityLoading"
          class="space-y-3"
        >
          <USkeleton
            v-for="i in 5"
            :key="i"
            class="h-10 w-full"
          />
        </div>

        <div
          v-else-if="activities.length === 0"
          class="text-center py-8"
        >
          <UIcon
            name="i-lucide-inbox"
            class="w-8 h-8 mx-auto text-muted-foreground mb-2"
          />
          <p class="text-sm text-muted-foreground">
            No credit usage yet this period
          </p>
        </div>

        <div
          v-else
          class="space-y-1"
        >
          <div
            v-for="activity in activities"
            :key="activity.id"
            class="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <!-- Icon -->
            <div
              class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800"
            >
              <UIcon
                :name="actionIcons[activity.action] || 'i-lucide-zap'"
                class="w-4 h-4"
                :class="actionColors[activity.action] || 'text-muted-foreground'"
              />
            </div>

            <!-- Description -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">
                {{ activity.description }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ timeAgo(activity.createdAt) }}
              </p>
            </div>

            <!-- Cost -->
            <div class="flex-shrink-0 text-right">
              <span class="text-sm font-medium tabular-nums text-red-500 dark:text-red-400">
                -{{ activity.creditsCost }}
              </span>
              <p class="text-xs text-muted-foreground">
                credits
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
