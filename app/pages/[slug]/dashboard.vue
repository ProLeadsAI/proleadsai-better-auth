<script setup lang="ts">
const { user, useActiveOrganization } = useAuth()
const router = useRouter()
const route = useRoute()
const activeOrg = useActiveOrganization()

const wordpressIntegration = computed(() => {
  const integrations: any = (activeOrg.value?.data as any)?.integrations
  return integrations?.wordpress
})

const hasActiveSubscription = computed(() => {
  const subs: any[] = (activeOrg.value?.data as any)?.subscriptions || []
  if (!Array.isArray(subs))
    return false
  return subs.some(s => s?.status === 'active' || s?.status === 'trialing')
})

const crmLocked = computed(() => {
  return !!wordpressIntegration.value?.connected && !hasActiveSubscription.value
})

definePageMeta({
  layout: 'dashboard'
})

// Fetch dashboard stats
const { data: stats, pending: statsLoading } = await useFetch(() => `/api/organization/${activeOrg.value?.data?.id}/dashboard`, {
  watch: [() => activeOrg.value?.data?.id],
  default: () => ({ leads: 0, contacts: 0, submissions: 0 }),
  immediate: !!activeOrg.value?.data?.id
})

onMounted(() => {
  if (import.meta.client) {
    const pendingInvite = localStorage.getItem('pending_invite')
    if (pendingInvite) {
      localStorage.removeItem('pending_invite')
      router.push(`/accept-invite/${pendingInvite}`)
    }
  }
})

const statCards = computed(() => [
  {
    label: 'Leads',
    value: stats.value?.leads ?? 0,
    icon: 'i-lucide-funnel',
    to: `/${route.params.slug}/leads`,
    color: 'text-blue-500'
  },
  {
    label: 'Contacts',
    value: stats.value?.contacts ?? 0,
    icon: 'i-lucide-contact',
    to: `/${route.params.slug}/contacts`,
    color: 'text-green-500'
  },
  {
    label: 'Submissions',
    value: stats.value?.submissions ?? 0,
    icon: 'i-lucide-inbox',
    to: `/${route.params.slug}/submissions`,
    color: 'text-purple-500'
  }
])
</script>

<template>
  <div class="flex flex-col gap-6">
    <UCard v-if="!crmLocked">
      <template #header>
        <h3 class="text-lg font-semibold">
          Welcome back{{ user?.name ? `, ${user.name}` : '' }}!
        </h3>
      </template>
      <p class="text-neutral-500">
        Here's an overview of your organization's activity.
      </p>
    </UCard>

    <!-- Stats Cards -->
    <div
      v-if="!crmLocked"
      class="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      <NuxtLink
        v-for="stat in statCards"
        :key="stat.label"
        :to="stat.to"
        class="group"
      >
        <UCard class="transition-shadow hover:shadow-md">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-neutral-500">
                {{ stat.label }}
              </p>
              <p class="text-3xl font-bold mt-1">
                <template v-if="statsLoading">
                  <span class="text-neutral-300">—</span>
                </template>
                <template v-else>
                  {{ stat.value }}
                </template>
              </p>
            </div>
            <div
              class="p-3 rounded-full bg-neutral-100 dark:bg-neutral-800 group-hover:scale-110 transition-transform"
            >
              <UIcon
                :name="stat.icon"
                class="w-6 h-6"
                :class="[stat.color]"
              />
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">
          Integrations
        </h3>
      </template>

      <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div class="flex items-center justify-between gap-4 px-4 py-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="h-9 w-9 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-none">
              <UIcon
                name="i-simple-icons-wordpress"
                class="h-5 w-5"
              />
            </div>
            <div class="min-w-0">
              <div class="font-medium leading-5">
                WordPress
              </div>
              <div class="text-sm text-neutral-500 truncate">
                <template v-if="wordpressIntegration?.connected">
                  <template v-if="wordpressIntegration?.url">
                    <a
                      class="hover:underline"
                      :href="wordpressIntegration.url"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ wordpressIntegration.url }}
                    </a>
                  </template>
                  <template v-else>
                    URL not set
                  </template>
                </template>
                <template v-else>
                  Not connected
                </template>
              </div>
            </div>
          </div>
          <UBadge
            :color="wordpressIntegration?.connected ? 'green' : 'gray'"
            variant="subtle"
            class="flex-none"
          >
            {{ wordpressIntegration?.connected ? 'Connected' : 'Not connected' }}
          </UBadge>
        </div>
      </div>
    </UCard>
  </div>
</template>
