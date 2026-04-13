<script setup lang="ts">
const { mode } = defineProps<{
  mode: 'desktop' | 'mobile'
}>()

const { organization, session, useActiveOrganization } = useAuth()
const { t } = useI18n()
const localePath = useLocalePath()
const activeOrg = useActiveOrganization()
const route = useRoute()

const { data: organizations } = await useLazyAsyncData('site-navigation-organizations', async () => {
  if (!session.value?.activeOrganizationId) {
    return []
  }

  const { data } = await organization.list()
  return data || []
})

const activeOrgSlug = computed(() => {
  if (activeOrg.value?.data?.slug) {
    return activeOrg.value.data.slug
  }

  const routeSlug = route.params.slug
  if (typeof routeSlug === 'string' && routeSlug && routeSlug !== 't') {
    return routeSlug
  }

  if (!session.value?.activeOrganizationId || !organizations.value?.length) {
    return ''
  }

  const org = organizations.value.find((item: any) => item.id === session.value?.activeOrganizationId)
  return org?.slug || ''
})

const navigation = computed(() => {
  const items = [
    { label: t('global.nav.features'), to: localePath('/#features') },
    { label: t('global.nav.pricing'), to: localePath('/pricing') }
  ]

  if (activeOrgSlug.value) {
    items.push({
      label: t('global.nav.install'),
      to: localePath(`/${activeOrgSlug.value}/install`)
    })
  }

  items.push({ label: t('global.nav.dashboard'), to: localePath('/dashboard') })

  return items
})
</script>

<template>
  <div>
    <!-- Desktop Navigation -->
    <div
      v-if="mode === 'desktop'"
      class="flex items-center gap-8"
    >
      <template
        v-for="item in navigation"
        :key="item.label"
      >
        <NuxtLink
          :to="item.to"
          class="text-sm font-medium text-neutral-700 hover:text-primary-500 dark:text-neutral-300 dark:hover:text-primary-400"
        >
          {{ item.label }}
        </NuxtLink>
      </template>
    </div>

    <!-- Mobile Navigation -->
    <div v-if="mode === 'mobile'">
      <UDropdownMenu :items="navigation">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-menu"
          aria-label="menu"
        />
      </UDropdownMenu>
    </div>
  </div>
</template>
