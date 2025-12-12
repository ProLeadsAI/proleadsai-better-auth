export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, fetchSession } = useAuth()
  const localePath = useLocalePath()

  await fetchSession()

  if (loggedIn.value) {
    return navigateTo(localePath('/dashboard'))
  }

  return navigateTo(localePath('/signin'))
})
