<i18n src="./i18n.json"></i18n>

<script setup lang="ts">
definePageMeta({
  auth: {
    only: 'guest'
  }
})

const { t } = useI18n()
useHead({
  title: t('resetPassword.title')
})

const auth = useAuth()
const toast = useToast()
const route = useRoute()
const localePath = useLocalePath()
const runtimeConfig = useRuntimeConfig()

const state = reactive({
  otp: undefined as string | undefined,
  password: undefined as string | undefined,
  confirmPassword: undefined as string | undefined
})

// Get email from query params (passed from forgot-password page)
const email = computed(() => route.query.email as string || '')

const schema = z.object({
  otp: z.string().length(6, t('resetPassword.errors.otpLength')),
  password: z.string().min(8, t('resetPassword.errors.minLength', { min: 8 })),
  confirmPassword: z.string().min(8, t('resetPassword.errors.minLength', { min: 8 })).refine(val => val === state.password, {
    message: t('resetPassword.errors.passwordMismatch')
  })
})

type Schema = zodOutput<typeof schema>

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loading.value)
    return

  if (!email.value) {
    toast.add({
      title: 'Email is required. Please go back to forgot password page.',
      color: 'error'
    })
    return
  }

  loading.value = true
  // Use emailOTP-based reset password
  const { error } = await auth.client.emailOtp.resetPassword({
    email: email.value,
    otp: event.data.otp,
    password: event.data.password
  })

  if (error) {
    toast.add({
      title: error.message,
      color: 'error'
    })
  } else {
    toast.add({
      title: t('resetPassword.success'),
      color: 'success'
    })
    navigateTo(localePath(runtimeConfig.public.auth.redirectGuestTo))
  }
  loading.value = false
}
</script>

<template>
  <UContainer class="flex items-center justify-center sm:p-4 sm:min-w-160">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center p-4">
          <h1 class="text-xl font-semibold">
            {{ t('resetPassword.title') }}
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            {{ t('resetPassword.description') }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField
            label="Verification Code"
            name="otp"
            required
          >
            <UInput
              v-model="state.otp"
              type="text"
              class="w-full"
              placeholder="Enter 6-digit code"
              maxlength="6"
            />
            <template #hint>
              <span class="text-xs text-neutral-500">Check your email for the code</span>
            </template>
          </UFormField>

          <UFormField
            :label="t('resetPassword.password')"
            name="password"
            required
          >
            <UInput
              v-model="state.password"
              type="password"
              class="w-full"
              :placeholder="t('resetPassword.passwordPlaceholder')"
            />
          </UFormField>

          <UFormField
            :label="t('resetPassword.confirmPassword')"
            name="confirmPassword"
            required
          >
            <UInput
              v-model="state.confirmPassword"
              type="password"
              class="w-full"
              :placeholder="t('resetPassword.confirmPasswordPlaceholder')"
            />
          </UFormField>

          <UButton
            type="submit"
            color="primary"
            block
            :loading="loading"
          >
            {{ t('resetPassword.submit') }}
          </UButton>
        </UForm>

        <div class="text-center text-sm">
          <UButton
            variant="link"
            color="primary"
            :to="localePath('/signin')"
          >
            {{ t('resetPassword.backToSignIn') }}
          </UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
