<script setup lang="ts">
/**
 * Member Invite Form Component
 * Handles inviting members to the organization (unlimited members, no seat limits)
 *
 * Usage: <MembersInviteForm :can-manage="canManageMembers" :is-pro="isPro" />
 */

const { canManage, isPro: _isPro } = defineProps<{
  canManage?: boolean
  isPro?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { organization, useActiveOrganization, fetchSession, refreshActiveOrg } = useAuth()
const activeOrg = useActiveOrganization()
const toast = useToast()

const inviteEmail = ref('')
const inviteRole = ref('member')
const loading = ref(false)

const roles = [
  { label: 'Member', value: 'member' },
  { label: 'Admin', value: 'admin' },
  { label: 'Owner', value: 'owner' }
]

async function inviteMember() {
  try {
    if (!inviteEmail.value || !activeOrg.value?.data?.id)
      return

    loading.value = true

    const { error } = await organization.inviteMember({
      email: inviteEmail.value,
      role: inviteRole.value as 'member' | 'admin' | 'owner',
      organizationId: activeOrg.value.data.id
    })

    if (error)
      throw error

    toast.add({ title: 'Invitation sent', color: 'success' })
    inviteEmail.value = ''
    await fetchSession()
    await refreshActiveOrg()
    emit('refresh')
  } catch (e: any) {
    console.error('InviteMember Error:', e)
    toast.add({
      title: 'Error inviting member',
      description: e.message,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    v-if="canManage"
    class="border-b border-neutral-200 dark:border-neutral-700 pb-6 mb-6"
  >
    <div class="space-y-3">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Invite a team member</label>

      <!-- Desktop: Single row layout -->
      <div class="hidden sm:flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
        <!-- Email Input -->
        <div class="flex-1 flex items-center gap-2 pl-2">
          <UIcon
            name="i-lucide-mail"
            class="w-4 h-4 text-gray-400 flex-shrink-0"
          />
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="colleague@example.com"
            autocomplete="off"
            data-lpignore="true"
            data-form-type="other"
            class="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 py-2 min-w-0"
            @keydown.enter.prevent="inviteMember()"
          >
        </div>

        <!-- Divider -->
        <div class="w-px h-6 bg-gray-200 dark:bg-gray-600" />

        <!-- Role Selector -->
        <UDropdownMenu
          :items="roles.map(r => ({
            label: r.label,
            icon: r.value === 'owner' ? 'i-lucide-crown' : r.value === 'admin' ? 'i-lucide-shield' : 'i-lucide-user',
            type: 'checkbox',
            checked: inviteRole === r.value,
            onUpdateChecked: () => { inviteRole = r.value }
          }))"
        >
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50"
          >
            <UIcon
              :name="inviteRole === 'owner' ? 'i-lucide-crown' : inviteRole === 'admin' ? 'i-lucide-shield' : 'i-lucide-user'"
              class="w-4 h-4"
            />
            <span>{{ roles.find(r => r.value === inviteRole)?.label }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="w-3.5 h-3.5 text-gray-400"
            />
          </button>
        </UDropdownMenu>

        <!-- Divider -->
        <div class="w-px h-6 bg-gray-200 dark:bg-gray-600" />

        <!-- Invite Button -->
        <UButton
          :loading="loading"
          :disabled="!inviteEmail"
          icon="i-lucide-user-plus"
          color="primary"
          size="sm"
          class="mr-1 cursor-pointer"
          @click="inviteMember"
        >
          Send Invite
        </UButton>
      </div>

      <!-- Mobile: Stacked layout -->
      <div class="sm:hidden space-y-3">
        <!-- Email Input -->
        <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
          <UIcon
            name="i-lucide-mail"
            class="w-4 h-4 text-gray-400 flex-shrink-0"
          />
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="colleague@example.com"
            autocomplete="off"
            data-lpignore="true"
            data-form-type="other"
            class="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-w-0"
            @keydown.enter.prevent="inviteMember()"
          >
        </div>

        <!-- Role + Button Row -->
        <div class="flex items-center gap-2">
          <!-- Role Selector -->
          <UDropdownMenu
            :items="roles.map(r => ({
              label: r.label,
              icon: r.value === 'owner' ? 'i-lucide-crown' : r.value === 'admin' ? 'i-lucide-shield' : 'i-lucide-user',
              type: 'checkbox',
              checked: inviteRole === r.value,
              onUpdateChecked: () => { inviteRole = r.value }
            }))"
          >
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <UIcon
                :name="inviteRole === 'owner' ? 'i-lucide-crown' : inviteRole === 'admin' ? 'i-lucide-shield' : 'i-lucide-user'"
                class="w-4 h-4"
              />
              <span>{{ roles.find(r => r.value === inviteRole)?.label }}</span>
              <UIcon
                name="i-lucide-chevron-down"
                class="w-3.5 h-3.5 text-gray-400"
              />
            </button>
          </UDropdownMenu>

          <!-- Invite Button -->
          <UButton
            :loading="loading"
            :disabled="!inviteEmail"
            icon="i-lucide-user-plus"
            color="primary"
            class="flex-1 cursor-pointer"
            @click="inviteMember"
          >
            Send Invite
          </UButton>
        </div>
      </div>

      <p class="text-xs text-gray-500 dark:text-gray-400">
        Press Enter to send or click the button
      </p>
    </div>
  </div>
</template>
