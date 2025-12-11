/**
 * Set password for users who don't have one (e.g., signed up via social/magic link)
 * Uses Better Auth's built-in setPassword API
 */

import { useServerAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password, confirmPassword } = body

  if (!password || !confirmPassword) {
    throw createError({ statusCode: 400, message: 'Password and confirmation are required' })
  }

  if (password !== confirmPassword) {
    throw createError({ statusCode: 400, message: 'Passwords do not match' })
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  const serverAuth = useServerAuth()

  // Use Better Auth's setPassword API - requires session headers
  try {
    const result = await serverAuth.api.setPassword({
      body: { newPassword: password },
      headers: event.headers
    })
    console.log('[SetPassword] Result:', result)
    return { success: true, message: 'Password set successfully' }
  } catch (error: any) {
    console.error('[SetPassword] Error:', error)
    throw createError({
      statusCode: error.status || 500,
      message: error.message || 'Failed to set password'
    })
  }
})
