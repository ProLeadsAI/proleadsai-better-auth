<script setup lang="ts">
import { trackCompleteRegistration } from '~~/app/utils/meta'

definePageMeta({
  auth: false,
  layout: false
})

const auth = useAuth()
const route = useRoute()
const localePath = useLocalePath()
const toast = useToast()

const status = ref<'loading' | 'error'>('loading')
const errorMessage = ref('')

const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/'))
    return redirect

  return localePath('/')
})

const trackingStorageKey = computed(() => {
  const userId = auth.user.value?.id
  return userId ? `meta_complete_registration_${userId}` : null
})

async function handleConfirmation() {
  const error = route.query.error
  if (typeof error === 'string' && error.length > 0) {
    status.value = 'error'
    errorMessage.value = error.replaceAll('_', ' ')
    return
  }

  await auth.fetchSession()

  if (!auth.user.value?.emailVerified) {
    status.value = 'error'
    errorMessage.value = 'Your account could not be confirmed.'
    return
  }

  const storageKey = trackingStorageKey.value
  if (storageKey && sessionStorage.getItem(storageKey) === 'sent') {
    await navigateTo(redirectTarget.value, { replace: true })
    return
  }

  try {
    const response = await $fetch('/api/tracking/meta/complete-registration', {
      method: 'POST'
    })

    if (response.ok && response.eventId) {
      trackCompleteRegistration(response.eventId)

      if (storageKey)
        sessionStorage.setItem(storageKey, 'sent')
    }
  } catch (error) {
    console.error('Failed to send Meta registration tracking event:', error)
    toast.add({
      title: 'Account confirmed, but Meta tracking failed.',
      color: 'warning'
    })
  }

  await navigateTo(redirectTarget.value, { replace: true })
}

onMounted(handleConfirmation)
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
    <UCard class="w-full max-w-md">
      <div class="space-y-3 text-center p-2">
        <h1 class="text-xl font-semibold text-neutral-900">
          <span v-if="status === 'loading'">Confirming your account</span>
          <span v-else>Confirmation issue</span>
        </h1>

        <p
          v-if="status === 'loading'"
          class="text-sm text-neutral-600"
        >
          Finalizing verification and redirecting you now.
        </p>

        <p
          v-else
          class="text-sm text-neutral-600"
        >
          {{ errorMessage }}
        </p>

        <div
          v-if="status === 'loading'"
          class="flex justify-center pt-2"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="h-5 w-5 animate-spin text-primary"
          />
        </div>

        <UButton
          v-if="status === 'error'"
          :to="localePath('/signin')"
          color="primary"
          class="mx-auto"
        >
          Go to sign in
        </UButton>
      </div>
    </UCard>
  </div>
</template>
