<script setup lang="ts">
/**
 * Organization Settings Page
 * Uses extracted components for maintainability:
 * - SettingsGeneralSection: Name, slug, timezone
 * - SettingsApiKeysSection: API key management
 * - SettingsSessionsSection: Trusted devices
 * - SettingsDangerZone: Leave/delete organization
 */
import { canUpdateOrgSettings } from '~~/shared/utils/permissions'

definePageMeta({
  layout: 'dashboard'
})

const { useActiveOrganization, user } = useAuth()
const activeOrg = useActiveOrganization()

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
</script>

<template>
  <div class="max-w-4xl mx-auto py-8 px-4">
    <h1 class="text-3xl font-semibold mb-8">
      Organization settings
    </h1>

    <!-- General Settings -->
    <div class="mb-8">
      <SettingsGeneralSection :can-edit="canUpdateSettings" />
    </div>

    <!-- API Keys -->
    <div class="mb-8">
      <SettingsApiKeysSection :can-manage="canUpdateSettings" />
    </div>

    <!-- Trusted Devices -->
    <div class="mb-8">
      <SettingsSessionsSection />
    </div>

    <!-- Danger Zone -->
    <SettingsDangerZone />
  </div>
</template>
