<i18n src="./i18n.json"></i18n>

<script setup lang="ts">
definePageMeta({
  auth: {
    only: 'guest'
  }
})

const { t } = useI18n()

useHead({
  title: t('signIn.signIn')
})
const auth = useAuth()
const toast = useToast()
const route = useRoute()
const localePath = useLocalePath()

const redirectTo = computed(() => {
  const redirect = route.query.redirect as string
  // If redirect is provided, use it directly (don't process through localePath)
  // This preserves paths like /settings/billing from external sources
  if (redirect) {
    return redirect.startsWith('/') ? redirect : `/${redirect}`
  }
  return localePath('/')
})

const schema = z.object({
  email: z.email(t('signIn.errors.invalidEmail')),
  password: z.string().min(8, t('signIn.errors.passwordLength', { min: 8 })),
  rememberMe: z.boolean().optional()
})
type Schema = zodOutput<typeof schema>

const state = reactive<Partial<Schema>>({
  email: undefined,
  password: undefined,
  rememberMe: false
})

const loading = ref(false)
const loadingAction = ref('')
const isEmailVerifyModalOpen = ref(false)
const resendLoading = ref(false)
let unverifiedEmail = ''

// Magic link state
const showMagicLink = ref(false)
const magicLinkEmail = ref('')
const magicLinkSent = ref(false)

// Pre-populate email from URL query param
onMounted(() => {
  const emailParam = route.query.email as string
  if (emailParam) {
    state.email = emailParam
    magicLinkEmail.value = emailParam
    // If magic link mode requested, show it
    if (route.query.mode === 'magic') {
      showMagicLink.value = true
    }
  }
})

async function onSocialLogin(action: 'google') {
  loading.value = true
  loadingAction.value = action
  auth.signIn.social({ provider: action, callbackURL: redirectTo.value })
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loading.value)
    return
  loading.value = true
  loadingAction.value = 'submit'
  const { error } = await auth.signIn.email({
    email: event.data.email,
    password: event.data.password,
    rememberMe: event.data.rememberMe,
    callbackURL: redirectTo.value
  })
  if (error) {
    if (error.code === auth.errorCodes.EMAIL_NOT_VERIFIED) {
      unverifiedEmail = event.data.email
      isEmailVerifyModalOpen.value = true
      loading.value = false
      return
    }
    toast.add({
      title: error.message,
      color: 'error'
    })
  }
  loading.value = false
}

async function handleResendEmail() {
  if (resendLoading.value)
    return
  resendLoading.value = true
  const { error } = await auth.sendVerificationEmail({
    email: unverifiedEmail,
    callbackURL: redirectTo.value
  })
  if (error) {
    toast.add({
      title: error.message,
      color: 'error'
    })
  } else {
    toast.add({
      title: t('signIn.sendEmailSuccess'),
      color: 'success'
    })
  }

  isEmailVerifyModalOpen.value = false
  resendLoading.value = false
}

async function onMagicLinkSubmit() {
  if (loading.value || !magicLinkEmail.value)
    return
  loading.value = true
  loadingAction.value = 'magicLink'
  const { error } = await auth.client.signIn.magicLink({
    email: magicLinkEmail.value,
    callbackURL: redirectTo.value
  })
  if (error) {
    toast.add({
      title: error.message,
      color: 'error'
    })
  } else {
    magicLinkSent.value = true
    toast.add({
      title: t('signIn.magicLinkSent'),
      color: 'success'
    })
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
            {{ t('signIn.welcome', { name: t('global.appName') }) }}
          </h1>
        </div>
      </template>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-simple-icons-google"
            class="justify-center"
            :loading="loading && loadingAction === 'google'"
            :disabled="loading"
            @click="onSocialLogin('google')"
          >
            Google
          </UButton>
        </div>

        <USeparator :label="t('signIn.or')" />

        <!-- Magic Link Option -->
        <div
          v-if="showMagicLink"
          class="space-y-4"
        >
          <div v-if="!magicLinkSent">
            <UFormField
              :label="t('signIn.email')"
              name="magicLinkEmail"
              required
            >
              <UInput
                v-model="magicLinkEmail"
                type="email"
                class="w-full"
                :placeholder="t('signIn.emailPlaceholder')"
                autocomplete="email"
              />
            </UFormField>
            <UButton
              color="primary"
              block
              class="mt-4"
              :disabled="loading || !magicLinkEmail"
              :loading="loading && loadingAction === 'magicLink'"
              @click="onMagicLinkSubmit"
            >
              {{ t('signIn.sendMagicLink') }}
            </UButton>
          </div>
          <div
            v-else
            class="text-center py-4"
          >
            <UIcon
              name="i-heroicons-envelope"
              class="w-12 h-12 text-primary mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('signIn.magicLinkSentDesc') }}
            </p>
          </div>
          <UButton
            variant="link"
            color="neutral"
            block
            @click="showMagicLink = false; magicLinkSent = false"
          >
            {{ t('signIn.backToPassword') }}
          </UButton>
        </div>

        <!-- Password Login Form -->
        <UForm
          v-else
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField
            :label="t('signIn.email')"
            name="email"
            required
          >
            <UInput
              v-model="state.email"
              type="email"
              class="w-full"
              :placeholder="t('signIn.emailPlaceholder')"
              autocomplete="email"
            />
          </UFormField>

          <UFormField
            :label="t('signIn.password')"
            name="password"
            required
          >
            <UInput
              v-model="state.password"
              type="password"
              class="w-full"
              :placeholder="t('signIn.passwordPlaceholder')"
            />
          </UFormField>

          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <UFormField name="rememberMe">
              <UCheckbox
                v-model="state.rememberMe"
                :label="t('signIn.rememberMe')"
              />
            </UFormField>
            <UButton
              variant="link"
              color="neutral"
              :to="localePath('/forgot-password')"
            >
              {{ t('signIn.forgotPassword') }}
            </UButton>
          </div>

          <UButton
            type="button"
            variant="link"
            color="neutral"
            block
            @click="showMagicLink = true"
          >
            {{ t('signIn.useMagicLink') }}
          </UButton>

          <UButton
            type="submit"
            color="primary"
            block
            :disabled="loading"
            :loading="loading && loadingAction === 'submit'"
          >
            {{ t('signIn.signIn') }}
          </UButton>

          <div class="text-center text-sm">
            {{ t('signIn.noAccount') }}
            <UButton
              variant="link"
              color="primary"
              :disabled="loading"
              :to="localePath({ path: '/signup', query: route.query })"
            >
              {{ t('signIn.createAccount') }}
            </UButton>
          </div>
        </UForm>
      </div>
    </UCard>

    <UModal v-model:open="isEmailVerifyModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items">
              <h3 class="text-lg font-medium">
                {{ t('signIn.emailNotVerified') }}
              </h3>
            </div>
          </template>

          <p class="text-sm">
            {{ t('signIn.emailNotVerifiedDesc') }}
          </p>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton
                color="neutral"
                variant="outline"
                @click="isEmailVerifyModalOpen = false"
              >
                {{ t('global.page.cancel') }}
              </UButton>
              <UButton
                color="primary"
                :loading="resendLoading"
                @click="handleResendEmail"
              >
                {{ t('signIn.sendEmail') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
