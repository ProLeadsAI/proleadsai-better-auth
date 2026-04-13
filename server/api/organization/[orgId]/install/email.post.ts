import { InstallEmailRateLimiter } from '~~/server/services/install/rateLimiter'
import { resendInstance } from '~~/server/utils/drivers'
import { renderInstallInstructions } from '~~/server/utils/email'
import { requireOrgMembership } from '~~/server/utils/organization'
import { runtimeConfig } from '~~/server/utils/runtimeConfig'

function isValidEmail(value: string) {
  const parts = value.split('@')
  if (parts.length !== 2)
    return false

  const [local, domain] = parts
  if (!local || !domain || domain.startsWith('.') || domain.endsWith('.'))
    return false

  return domain.includes('.')
}

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({
      statusCode: 400,
      message: 'Organization ID is required'
    })
  }

  const {
    user,
    organization
  } = await requireOrgMembership(event, orgId)

  const body = await readBody<{
    recipientEmail?: string
    organizationName?: string
    installMode?: 'inline' | 'floating'
    placementInstruction?: string
    iframeUrl?: string
    installCode?: string
  }>(event)

  const recipientEmail = body?.recipientEmail?.trim().toLowerCase()
  const installMode = body?.installMode === 'floating' ? 'floating' : 'inline'
  const placementInstruction = body?.placementInstruction?.trim() || 'Paste the full install code just before the closing </body> tag.'
  const iframeUrl = body?.iframeUrl?.trim() || ''
  const installCode = body?.installCode?.trim() || ''

  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    throw createError({
      statusCode: 400,
      message: 'A valid recipient email is required'
    })
  }

  if (!iframeUrl || !installCode) {
    throw createError({
      statusCode: 400,
      message: 'Install details are required'
    })
  }

  const rateLimiter = new InstallEmailRateLimiter(10)
  const { allowed, retryAfterSeconds } = await rateLimiter.checkAndLock(user.id)

  if (!allowed) {
    throw createError({
      statusCode: 429,
      message: `Please wait ${retryAfterSeconds} seconds before sending another install email`
    })
  }

  if (!runtimeConfig.resendApiKey) {
    throw createError({
      statusCode: 500,
      message: 'Email sending is not configured'
    })
  }

  const html = await renderInstallInstructions({
    organizationName: body?.organizationName?.trim() || organization.name,
    installMode,
    placementInstruction,
    iframeUrl,
    installCode
  })

  await resendInstance.emails.send({
    from: `${runtimeConfig.public.appName} <${runtimeConfig.public.appNotifyEmail}>`,
    to: recipientEmail,
    subject: `Install instructions for ${body?.organizationName?.trim() || organization.name}`,
    html,
    replyTo: user.email
  })

  return {
    success: true
  }
})
