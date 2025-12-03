<script setup lang="ts">
const props = defineProps<{
  latitude: string | number
  longitude: string | number
  roofOutlinePoints?: Array<{ lat: number, lng: number }>
}>()

const config = useRuntimeConfig()
const mapContainer = ref<HTMLElement | null>(null)
const mapLoaded = ref(false)

// Convert to numbers
const lat = computed(() => Number(props.latitude))
const lng = computed(() => Number(props.longitude))

onMounted(async () => {
  if (!mapContainer.value)
    return

  // Load Google Maps script
  const apiKey = config.public.googleMapsApiKeyPublic
  if (!apiKey) {
    console.warn('Google Maps API key not configured')
    return
  }

  // Check if already loaded
  if (!window.google?.maps) {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`
    script.async = true
    script.defer = true

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google Maps'))
      document.head.appendChild(script)
    })
  }

  initMap()
})

function initMap() {
  if (!mapContainer.value || !window.google?.maps)
    return

  const center = { lat: lat.value, lng: lng.value }

  const map = new window.google.maps.Map(mapContainer.value, {
    center,
    zoom: 20,
    mapTypeId: 'satellite',
    tilt: 0,
    disableDefaultUI: true,
    zoomControl: true
  })

  // Draw roof outline if available
  if (props.roofOutlinePoints?.length) {
    const _roofPolygon = new window.google.maps.Polygon({
      paths: props.roofOutlinePoints,
      strokeColor: '#10B981',
      strokeOpacity: 1,
      strokeWeight: 3,
      fillColor: '#10B981',
      fillOpacity: 0.25,
      map
    })

    // Fit bounds to show entire roof
    const bounds = new window.google.maps.LatLngBounds()
    props.roofOutlinePoints.forEach((point) => {
      bounds.extend(point)
    })
    map.fitBounds(bounds, 50)
  }

  mapLoaded.value = true
}

// Extend window type for Google Maps
declare global {
  interface Window {
    google: any
  }
}
</script>

<template>
  <div class="relative w-full h-64 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
    <div
      ref="mapContainer"
      class="w-full h-full"
    />

    <!-- Loading state -->
    <div
      v-if="!mapLoaded"
      class="absolute inset-0 flex items-center justify-center"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-neutral-400"
      />
    </div>
  </div>
</template>
