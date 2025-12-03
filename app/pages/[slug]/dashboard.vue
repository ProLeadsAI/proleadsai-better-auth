<script setup lang="ts">
const { user, useActiveOrganization } = useAuth()
const router = useRouter()
const route = useRoute()
const activeOrg = useActiveOrganization()

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
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">
          Welcome back, {{ user?.name }}!
        </h3>
      </template>
      <p class="text-neutral-500">
        Here's an overview of your organization's activity.
      </p>
    </UCard>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
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
  </div>
</template>
