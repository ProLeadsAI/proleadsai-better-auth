import { getAuthSession } from '~~/server/utils/auth'
import { sendMetaCompleteRegistration } from '~~/server/utils/meta-capi'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.public.facebookPixelId || !config.facebookCapiToken) {
    return {
      ok: false,
      skipped: true,
      reason: 'meta_not_configured'
    }
  }

  const session = await getAuthSession(event)
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  if (!session.user.emailVerified) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email is not verified'
    })
  }

  const eventId = `confirm_${session.user.id}_${Date.now()}`
  const requestUrl = getRequestURL(event)
  const eventSourceUrl = new URL('/account-confirmed', requestUrl.origin).toString()

  await sendMetaCompleteRegistration({
    pixelId: config.public.facebookPixelId,
    accessToken: config.facebookCapiToken,
    testEventCode: config.facebookTestEventCode,
    eventId,
    eventSourceUrl,
    email: session.user.email,
    externalId: String(session.user.id),
    clientIpAddress: getRequestIP(event, { xForwardedFor: true }) || undefined,
    clientUserAgent: getHeader(event, 'user-agent') || undefined,
    fbp: getCookie(event, '_fbp') || undefined,
    fbc: getCookie(event, '_fbc') || undefined
  })

  return { ok: true, eventId }
})
