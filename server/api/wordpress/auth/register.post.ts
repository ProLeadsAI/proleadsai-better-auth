/**
 * WordPress Plugin Integration - Send OTP
 * Simple proxy to Better Auth's emailOTP endpoint
 */

import { useServerAuth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })

  if (event.method === 'OPTIONS') {
    return ''
  }

  const body = await readBody(event)

  if (!body.email) {
    throw createError({ statusCode: 400, message: 'Email is required' })
  }

  const email = body.email.toLowerCase().trim()
  const serverAuth = useServerAuth()

  // Use Better Auth's emailOTP plugin
  await serverAuth.api.sendVerificationOTP({
    body: { email, type: 'sign-in' }
  })

  return { success: true, message: 'Verification code sent', email }
})
