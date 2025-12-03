<script setup lang="ts">
/**
 * Business settings section
 * Allows updating business-specific settings like price per square and domain
 *
 * Usage: <SettingsBusinessSection :can-edit="canUpdateSettings" />
 */

const { canEdit } = defineProps<{
  canEdit?: boolean
}>()

const { useActiveOrganization } = useAuth()
const activeOrg = useActiveOrganization()
const toast = useToast()

const loading = ref(false)
const pricePerSq = ref<number>(350)
const domainName = ref('')

// Fetch settings from API
const orgId = computed(() => activeOrg.value?.data?.id)

const { data: settings, refresh: refreshSettings } = await useFetch<{
  pricePerSq: number
  domainName: string
}>(() => `/api/organization/${orgId.value}/settings`, {
  watch: [orgId],
  immediate: !!orgId.value,
  default: () => ({ pricePerSq: 350, domainName: '' })
})

// Sync local state when settings load
watch(settings, (data) => {
  if (data) {
    pricePerSq.value = data.pricePerSq ?? 350
    domainName.value = data.domainName ?? ''
  }
}, { immediate: true })

async function updateBusinessSettings() {
  if (!activeOrg.value?.data?.id)
    return
  loading.value = true

  try {
    await $fetch(`/api/organization/${activeOrg.value.data.id}/settings`, {
      method: 'PATCH',
      body: {
        pricePerSq: pricePerSq.value,
        domainName: domainName.value
      }
    })

    toast.add({ title: 'Business settings updated', color: 'success' })
    await refreshSettings()
  } catch (e: any) {
    toast.add({
      title: 'Error updating business settings',
      description: e.data?.message || e.message,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-900">
    <h2 class="text-xl font-semibold mb-4">
      Business Settings
    </h2>

    <form
      class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
      @submit.prevent="updateBusinessSettings"
    >
      <div>
        <UFormField
          label="Price Per Sq"
          required
        >
          <UInput
            v-model.number="pricePerSq"
            type="number"
            placeholder="350"
            :disabled="!canEdit"
          />
        </UFormField>
        <p class="text-xs text-gray-500 mt-1">
          This is the starting price of your roofing price per square.
        </p>
      </div>

      <UFormField label="Domain Name">
        <UInput
          v-model="domainName"
          placeholder="http://localhost:8882"
          :disabled="!canEdit"
        />
      </UFormField>

      <div class="md:col-span-2">
        <UButton
          v-if="canEdit"
          type="submit"
          label="Save"
          color="black"
          :loading="loading"
        />
      </div>
    </form>
  </div>
</template>
