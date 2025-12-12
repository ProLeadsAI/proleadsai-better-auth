<script setup lang="ts">
/**
 * Organization Settings Page
 * Uses extracted components for maintainability:
 * - SettingsGeneralSection: Name, slug, timezone
 * - SettingsBusinessSection: Business info
 * - SettingsNotificationsSection: Email notifications
 * - SettingsApiKeysSection: API key management
 * - SettingsDangerZone: Leave/delete organization
 *
 * Note: Trusted Devices (sessions) moved to Profile page as it's user-specific
 */
import { canUpdateOrgSettings } from '~~/shared/utils/permissions'

definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const { useActiveOrganization, user } = useAuth()
const activeOrg = useActiveOrganization()

// Inner navigation sections
const sections = [
  { id: 'general', label: 'General', icon: 'i-lucide-settings' },
  { id: 'business', label: 'Business', icon: 'i-lucide-building-2' },
  { id: 'notifications', label: 'Notifications', icon: 'i-lucide-bell' },
  { id: 'api-keys', label: 'API Keys', icon: 'i-lucide-key' },
  { id: 'danger', label: 'Danger Zone', icon: 'i-lucide-alert-triangle' }
]

const activeSection = ref('general')

// Scroll to section when clicking nav
function scrollToSection(sectionId: string) {
  activeSection.value = sectionId
  const element = document.getElementById(`section-${sectionId}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// Computed permissions
const currentUserRole = computed(() => {
  if (!activeOrg.value?.data?.members || !user.value?.id)
    return null
  const member = activeOrg.value.data.members.find((m: any) => m.userId === user.value!.id)
  return member?.role
})

const canUpdateSettings = computed(() => {
  return canUpdateOrgSettings(currentUserRole.value as any)
})

// Check if organization has active subscription
const hasActiveSubscription = computed(() => {
  const subs: any[] = (activeOrg.value?.data as any)?.subscriptions || []
  if (!Array.isArray(subs))
    return false
  return subs.some(s => s?.status === 'active' || s?.status === 'trialing')
})
</script>

<template>
  <div class="max-w-5xl mx-auto py-4 px-4">
    <!-- Profile Settings Banner -->
    <NuxtLink
      :to="`/${route.params.slug}/profile`"
      class="flex items-center justify-between px-3 py-2.5 mb-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors group"
    >
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-user-cog"
          class="w-4 h-4 text-primary-600 dark:text-primary-400"
        />
        <span class="text-sm text-primary-800 dark:text-primary-200">
          Looking for your personal settings? Update your profile, email, and password
        </span>
      </div>
      <UIcon
        name="i-lucide-arrow-right"
        class="w-5 h-5 text-primary-500 group-hover:translate-x-1 transition-transform"
      />
    </NuxtLink>

    <h1 class="text-3xl font-semibold mb-6">
      Organization settings
    </h1>

    <div class="flex gap-8">
      <!-- Inner Navigation Sidebar -->
      <nav class="hidden md:block w-48 shrink-0">
        <div class="sticky top-20 space-y-1">
          <button
            v-for="section in sections"
            :key="section.id"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left"
            :class="[
              activeSection === section.id
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            ]"
            @click="scrollToSection(section.id)"
          >
            <UIcon
              :name="section.icon"
              class="w-4 h-4"
            />
            {{ section.label }}
          </button>
        </div>
      </nav>

      <!-- Settings Content -->
      <div class="flex-1 space-y-8">
        <!-- General Settings -->
        <div id="section-general">
          <SettingsGeneralSection :can-edit="canUpdateSettings" />
        </div>

        <!-- Business Settings -->
        <div id="section-business">
          <SettingsBusinessSection :can-edit="canUpdateSettings" />
        </div>

        <!-- Notifications Settings -->
        <div id="section-notifications">
          <SettingsNotificationsSection
            :can-edit="canUpdateSettings"
            :has-subscription="hasActiveSubscription"
          />
        </div>

        <!-- API Keys -->
        <div id="section-api-keys">
          <SettingsApiKeysSection :can-manage="canUpdateSettings" />
        </div>

        <!-- Danger Zone -->
        <div id="section-danger">
          <SettingsDangerZone />
        </div>
      </div>
    </div>
  </div>
</template>
