<script setup lang="ts">
interface AddressData {
  streetAddress: string
  streetAddress2: string
  postOfficeBoxNumber: string
  addressLocality: string
  addressRegion: string
  postalCode: string
  addressCountry: string
  latitude?: string
  longitude?: string
}

interface FormData {
  name: string
  email: string
  phone: string
  company: string
  tagsInput: string
  source: string
  metadata: string
  address: AddressData
}

const props = defineProps<{
  open: boolean
  title: string
  isEdit: boolean
  entityType: 'contact' | 'lead'
  initialData?: Partial<FormData>
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [data: FormData]
}>()

const toast = useToast()

// Form state
const form = reactive<FormData>({
  name: '',
  email: '',
  phone: '',
  company: '',
  tagsInput: '',
  source: '',
  metadata: '',
  address: {
    streetAddress: '',
    streetAddress2: '',
    postOfficeBoxNumber: '',
    addressLocality: '',
    addressRegion: '',
    postalCode: '',
    addressCountry: '',
    latitude: '',
    longitude: ''
  }
})

// Address autocomplete
const addressSearch = ref('')
const addressSuggestions = ref<Array<{ label: string, value: string }>>([])
const isSearching = ref(false)
const showSuggestions = ref(false)

// Hide suggestions with delay (to allow click on suggestion)
const hideSuggestionsDelayed = () => {
  window.setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

// Debounced address search
let searchTimeout: ReturnType<typeof setTimeout>
let lastSearchLength = 0

const doSearch = async (query: string) => {
  isSearching.value = true
  try {
    const results = await $fetch<Array<{ label: string, value: string }>>('/api/autocomplete/address', {
      query: { q: query }
    })
    addressSuggestions.value = results || []
    showSuggestions.value = true
  } catch (e) {
    console.error('Address search error:', e)
    addressSuggestions.value = []
  } finally {
    isSearching.value = false
  }
}

const searchAddress = (query: string) => {
  if (!query || query.length < 2) {
    addressSuggestions.value = []
    lastSearchLength = 0
    return
  }

  clearTimeout(searchTimeout)

  // Search immediately when hitting 2 chars, debounce after
  if (query.length === 2 && lastSearchLength < 2) {
    lastSearchLength = query.length
    doSearch(query)
  } else {
    lastSearchLength = query.length
    searchTimeout = window.setTimeout(() => doSearch(query), 150)
  }
}

// Select address from suggestions
const selectAddress = async (suggestion: { label: string, value: string }) => {
  showSuggestions.value = false
  addressSearch.value = suggestion.label

  try {
    const details = await $fetch<any>('/api/autocomplete/address-details', {
      query: { place_id: suggestion.value }
    })

    if (details?.address_components) {
      // Parse address components
      const components = details.address_components
      const getComponent = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.long_name || ''
      const getShortComponent = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.short_name || ''

      form.address.streetAddress = `${getComponent('street_number')} ${getComponent('route')}`.trim()
      form.address.addressLocality = getComponent('locality') || getComponent('sublocality')
      form.address.addressRegion = getShortComponent('administrative_area_level_1')
      form.address.postalCode = getComponent('postal_code')
      form.address.addressCountry = getShortComponent('country')

      // Get coordinates
      if (details.geometry?.location) {
        form.address.latitude = String(details.geometry.location.lat)
        form.address.longitude = String(details.geometry.location.lng)
      }
    }
  } catch (e) {
    console.error('Failed to get address details:', e)
    toast.add({ title: 'Failed to get address details', color: 'error' })
  }
}

// Watch for initial data changes
watch(() => props.initialData, (data) => {
  if (data) {
    form.name = data.name || ''
    form.email = data.email || ''
    form.phone = data.phone || ''
    form.company = data.company || ''
    form.tagsInput = data.tagsInput || ''
    form.source = data.source || ''
    form.metadata = data.metadata || ''
    if (data.address) {
      Object.assign(form.address, data.address)
      // Set search field to show current address
      if (data.address.streetAddress) {
        addressSearch.value = `${data.address.streetAddress}, ${data.address.addressLocality || ''}, ${data.address.addressRegion || ''} ${data.address.postalCode || ''}`.trim()
      }
    }
  }
}, { immediate: true })

// Reset form when modal closes
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    form.name = ''
    form.email = ''
    form.phone = ''
    form.company = ''
    form.tagsInput = ''
    form.source = ''
    form.metadata = ''
    form.address = {
      streetAddress: '',
      streetAddress2: '',
      postOfficeBoxNumber: '',
      addressLocality: '',
      addressRegion: '',
      postalCode: '',
      addressCountry: '',
      latitude: '',
      longitude: ''
    }
    addressSearch.value = ''
    addressSuggestions.value = []
  }
})

const handleSubmit = () => {
  // Validate: at least name, email, or phone required
  if (!form.name && !form.email && !form.phone) {
    toast.add({ title: 'At least Name, Email, or Phone is required', color: 'error' })
    return
  }

  emit('submit', { ...form })
}

const closeModal = () => {
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <p class="text-sm text-neutral-500">
          At least Name, Email, or Phone is required
        </p>

        <UFormField label="Name">
          <UInput
            v-model="form.name"
            placeholder="John Doe"
          />
        </UFormField>

        <UFormField label="Email">
          <UInput
            v-model="form.email"
            type="email"
            placeholder="john@example.com"
          />
        </UFormField>

        <UFormField label="Phone">
          <UInput
            v-model="form.phone"
            placeholder="(555) 123-4567"
          />
        </UFormField>

        <UFormField label="Company">
          <UInput
            v-model="form.company"
            placeholder="Acme Inc"
          />
        </UFormField>

        <!-- Address Section with Autocomplete -->
        <div class="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
          <h4 class="text-sm font-medium mb-3">
            Address
          </h4>

          <!-- Address Search -->
          <div class="relative mb-3">
            <UFormField label="Search Address">
              <UInput
                v-model="addressSearch"
                placeholder="Start typing an address..."
                icon="i-lucide-search"
                :loading="isSearching"
                @input="searchAddress(addressSearch)"
                @focus="showSuggestions = addressSuggestions.length > 0"
                @blur="hideSuggestionsDelayed"
              />
            </UFormField>

            <!-- Suggestions Dropdown -->
            <div
              v-if="showSuggestions && addressSuggestions.length > 0"
              class="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-auto"
            >
              <button
                v-for="suggestion in addressSuggestions"
                :key="suggestion.value"
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                @mousedown.prevent="selectAddress(suggestion)"
              >
                {{ suggestion.label }}
              </button>
            </div>
          </div>

          <div class="space-y-3">
            <UFormField label="Street Address">
              <UInput
                v-model="form.address.streetAddress"
                placeholder="123 Main St"
              />
            </UFormField>

            <UFormField label="Street Address 2">
              <UInput
                v-model="form.address.streetAddress2"
                placeholder="Apt, Suite, etc."
              />
            </UFormField>

            <UFormField label="PO Box">
              <UInput
                v-model="form.address.postOfficeBoxNumber"
                placeholder="PO Box 123"
              />
            </UFormField>

            <UFormField label="City">
              <UInput
                v-model="form.address.addressLocality"
                placeholder="City"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-3">
              <UFormField label="State/Region">
                <UInput
                  v-model="form.address.addressRegion"
                  placeholder="CA"
                />
              </UFormField>

              <UFormField label="Postal Code">
                <UInput
                  v-model="form.address.postalCode"
                  placeholder="90210"
                />
              </UFormField>
            </div>

            <UFormField label="Country">
              <UInput
                v-model="form.address.addressCountry"
                placeholder="USA"
              />
            </UFormField>
          </div>
        </div>

        <!-- Additional Fields -->
        <div class="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
          <UFormField label="Tags (comma-separated)">
            <UInput
              v-model="form.tagsInput"
              placeholder="customer, vip, lead"
            />
          </UFormField>

          <UFormField
            label="Source"
            class="mt-3"
          >
            <UInput
              v-model="form.source"
              placeholder="Website, Referral, etc."
            />
          </UFormField>

          <UFormField
            label="Metadata (JSON)"
            class="mt-3"
          >
            <UTextarea
              v-model="form.metadata"
              placeholder="{&quot;key&quot;: &quot;value&quot;}"
              rows="3"
              class="font-mono text-sm"
            />
            <p class="text-xs text-neutral-400 mt-1">
              Optional JSON object
            </p>
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="outline"
        @click="closeModal"
      />
      <UButton
        :label="isEdit ? 'Update' : 'Create'"
        @click="handleSubmit"
      />
    </template>
  </UModal>
</template>
