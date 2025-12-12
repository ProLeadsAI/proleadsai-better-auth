<script setup lang="ts">
/**
 * Notifications settings section
 * Allows configuring email notifications for new leads
 * Only available for paid organizations
 *
 * Usage: <SettingsNotificationsSection :can-edit="canUpdateSettings" :has-subscription="hasActiveSubscription" />
 */

const _props = defineProps<{
  canEdit?: boolean
  hasSubscription?: boolean
}>()

const { useActiveOrganization } = useAuth()
const activeOrg = useActiveOrganization()
const toast = useToast()

const loading = ref(false)

// Notification settings state using the new JSON structure
interface NotificationTypeSettings {
  enabled: boolean
  roles: string[]
}

interface NotificationSettings {
  newLeads: NotificationTypeSettings
}

const settings = ref<NotificationSettings>({
  newLeads: {
    enabled: false,
    roles: ['owner', 'admin']
  }
})

// Track if settings have been loaded
const settingsLoaded = ref(false)

// Load notification settings from organization
watch(() => activeOrg.value?.data, async (data) => {
  if (!data?.id || settingsLoaded.value)
    return

  try {
    const result = await $fetch<NotificationSettings>(`/api/organization/${data.id}/notification-settings`)
    if (result) {
      settings.value = {
        newLeads: {
          enabled: result.newLeads?.enabled ?? false,
          roles: result.newLeads?.roles ?? ['owner', 'admin']
        }
      }
      settingsLoaded.value = true
    }
  } catch {
    // Settings may not exist yet, use defaults
    settingsLoaded.value = true
  }
}, { immediate: true })

// Helper to check/toggle role in array
function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role)
}

function toggleRole(role: string) {
  const roles = settings.value.newLeads.roles
  const index = roles.indexOf(role)
  if (index === -1) {
    roles.push(role)
  } else {
    roles.splice(index, 1)
  }
}

async function saveNotificationSettings() {
  if (!activeOrg.value?.data?.id)
    return

  loading.value = true
  try {
    await $fetch(`/api/organization/${activeOrg.value.data.id}/notification-settings`, {
      method: 'PATCH' as const,
      body: settings.value
    })
    toast.add({ title: 'Notification settings saved', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'Error saving settings',
      description: e.message,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-900">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">
        Email Notifications
      </h2>
      <UBadge
        v-if="!hasSubscription"
        color="warning"
        variant="soft"
      >
        Pro Feature
      </UBadge>
    </div>

    <p class="text-sm text-gray-500 mb-6">
      Configure email notifications for your organization. Get notified when new leads are captured.
    </p>

    <!-- Upgrade prompt for free users -->
    <div
      v-if="!hasSubscription"
      class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 mb-6"
    >
      <div class="flex items-start gap-3">
        <UIcon
          name="i-lucide-lock"
          class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5"
        />
        <div>
          <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
            Upgrade to Pro to enable email notifications
          </p>
          <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Email notifications are available on paid plans. Upgrade to receive instant alerts when new leads are captured.
          </p>
          <NuxtLink
            :to="`/${$route.params.slug}/billing`"
            class="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 mt-2"
          >
            View plans
            <UIcon
              name="i-lucide-arrow-right"
              class="w-4 h-4"
            />
          </NuxtLink>
        </div>
      </div>
    </div>

    <div :class="{ 'opacity-50 pointer-events-none': !hasSubscription }">
      <!-- New Leads Notification -->
      <div class="space-y-4">
        <div class="flex items-start gap-3">
          <UCheckbox
            v-model="settings.newLeads.enabled"
            :disabled="!canEdit || !hasSubscription"
          />
          <div>
            <label class="text-sm font-medium text-gray-900 dark:text-gray-100">
              New lead notifications
            </label>
            <p class="text-sm text-gray-500">
              Receive an email when a new lead is captured from your WordPress site
            </p>
          </div>
        </div>

        <!-- Role Selection (only show when new leads is enabled) -->
        <div
          v-if="settings.newLeads.enabled"
          class="ml-7 pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-3"
        >
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Send notifications to:
          </p>

          <div class="flex items-center gap-3">
            <UCheckbox
              :model-value="hasRole(settings.newLeads.roles, 'owner')"
              :disabled="!canEdit || !hasSubscription"
              @update:model-value="toggleRole('owner')"
            />
            <label class="text-sm text-gray-700 dark:text-gray-300">
              Owners
            </label>
          </div>

          <div class="flex items-center gap-3">
            <UCheckbox
              :model-value="hasRole(settings.newLeads.roles, 'admin')"
              :disabled="!canEdit || !hasSubscription"
              @update:model-value="toggleRole('admin')"
            />
            <label class="text-sm text-gray-700 dark:text-gray-300">
              Admins
            </label>
          </div>

          <div class="flex items-center gap-3">
            <UCheckbox
              :model-value="hasRole(settings.newLeads.roles, 'member')"
              :disabled="!canEdit || !hasSubscription"
              @update:model-value="toggleRole('member')"
            />
            <label class="text-sm text-gray-700 dark:text-gray-300">
              Members
            </label>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <UButton
          v-if="canEdit && hasSubscription"
          label="Save notifications"
          color="black"
          :loading="loading"
          @click="saveNotificationSettings"
        />
      </div>
    </div>
  </div>
</template>
