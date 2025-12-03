/**
 * WordPress Plugin Integration - Verify OTP
 * Just verifies the OTP and returns user info
 */

import { useServerAuth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }

  const body = await readBody(event)

  if (!body.email || !body.code) {
    throw createError({ statusCode: 400, message: 'Email and code are required' })
  }

  const email = body.email.toLowerCase().trim()
  const otp = body.code.trim()

  const serverAuth = useServerAuth()

  // Use Better Auth's signInEmailOTP
  const result = await serverAuth.api.signInEmailOTP({
    body: { email, otp }
  })

  if (!result?.user) {
    throw createError({ statusCode: 400, message: 'Invalid verification code' })
  }

  return {
    success: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name
    }
  }
})
