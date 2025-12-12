import { and, desc, eq } from 'drizzle-orm'
import { addresses, leads, member, organization as organizationTable, submissions, subscription, user } from '~~/server/db/schema'
import { validateApiKey } from '~~/server/utils/apiKeyAuth'
import { useDB } from '~~/server/utils/db'
import { resendInstance } from '~~/server/utils/drivers'
import { renderLeadSubmitted } from '~~/server/utils/email'
import { runtimeConfig } from '~~/server/utils/runtimeConfig'

export default defineEventHandler(async (event) => {
  // Set CORS headers for external form submissions
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
  })

  // Handle preflight
  if (getMethod(event) === 'OPTIONS') {
    return null
  }

  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  const body = await readBody(event)

  if (!body.formName) {
    throw createError({ statusCode: 400, message: 'formName is required' })
  }

  // Check for API key authentication
  const apiKeyAuth = await validateApiKey(event)

  // If API key provided, verify it matches the organization
  if (apiKeyAuth && apiKeyAuth.organizationId !== orgId) {
    throw createError({ statusCode: 403, message: 'API key does not match organization' })
  }

  const db = await useDB(event)

  // Verify organization exists
  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.id, orgId)
  })

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Build metadata with API key info if applicable
  const metadata = {
    ...(body.metadata || {}),
    ...(apiKeyAuth
      ? {
          apiKeyName: apiKeyAuth.keyName,
          submittedVia: 'api'
        }
      : {})
  }

  const [newSubmission] = await db.insert(submissions).values({
    organizationId: orgId,
    formName: body.formName,
    name: body.name || null,
    email: body.email || null,
    phone: body.phone || null,
    message: body.message || null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    sessionId: body.sessionId || null,
    toolSessionId: body.toolSessionId || null
  }).returning()

  // If toolSessionId provided, link all searched addresses from that session to this submission
  if (body.toolSessionId) {
    // Find the lead with this toolSessionId
    const lead = await db.query.leads.findFirst({
      where: and(
        eq(leads.toolSessionId, body.toolSessionId),
        eq(leads.organizationId, orgId)
      )
    })

    if (lead) {
      // Link all addresses from that lead to this submission
      await db.update(addresses)
        .set({ submissionId: newSubmission.id })
        .where(eq(addresses.leadId, lead.id))

      // Only mark the most recent address as 'submitted'
      const mostRecentAddress = await db.query.addresses.findFirst({
        where: eq(addresses.leadId, lead.id),
        orderBy: [desc(addresses.createdAt)]
      })
      if (mostRecentAddress) {
        await db.update(addresses)
          .set({ source: 'submitted' })
          .where(eq(addresses.id, mostRecentAddress.id))
      }

      // Update the lead with contact info from submission
      if (body.name || body.email || body.phone) {
        await db.update(leads)
          .set({
            name: body.name || lead.name,
            email: body.email || lead.email,
            phone: body.phone || lead.phone,
            labels: ['submitted']
          })
          .where(eq(leads.id, lead.id))
      }
    }
  }

  // Create address if provided directly (not from session)
  if (body.address?.streetAddress) {
    await db.insert(addresses).values({
      organizationId: orgId,
      submissionId: newSubmission.id,
      streetAddress: body.address.streetAddress,
      streetAddress2: body.address.streetAddress2 || null,
      postOfficeBoxNumber: body.address.postOfficeBoxNumber || null,
      addressLocality: body.address.addressLocality || body.address.city,
      addressRegion: body.address.addressRegion || body.address.state,
      postalCode: body.address.postalCode || body.address.zip,
      addressCountry: body.address.addressCountry || null,
      latitude: body.address.latitude || null,
      longitude: body.address.longitude || null,
      source: 'submitted',
      roofAreaSqFt: body.address.roofAreaSqFt || null,
      pricePerSquare: body.address.pricePerSquare || null,
      estimate: body.address.estimate || null,
      predominantPitchType: body.address.predominantPitchType || null,
      roofOutlinePoints: body.address.roofOutlinePoints || null
    })
  }

  // Send email notifications to org members (paid orgs only, notifications enabled)
  try {
    // 1) paid org gate
    const subs = await db.query.subscription.findMany({
      where: eq(subscription.referenceId, orgId)
    })
    const hasActiveSub = subs.some((s: any) => s.status === 'active' || s.status === 'trialing')
    if (!hasActiveSub) {
      // free orgs: no email notifications
      throw new Error('Org is not paid')
    }

    // 2) notification settings gate
    let notifyEnabled = false
    let roleRecipients: string[] = ['owner', 'admin']
    if ((org as any).notificationSettings) {
      try {
        const parsed = JSON.parse((org as any).notificationSettings)
        notifyEnabled = Boolean(parsed?.newLeads?.enabled)
        if (Array.isArray(parsed?.newLeads?.roles)) {
          roleRecipients = parsed.newLeads.roles
        }
      } catch {
        // ignore invalid JSON
      }
    }
    if (!notifyEnabled) {
      throw new Error('Lead notifications disabled')
    }

    if (!runtimeConfig.resendApiKey) {
      throw new Error('Resend not configured')
    }

    // 3) find the submitted roof/address to include
    const submittedAddress = await db.query.addresses.findFirst({
      where: eq(addresses.submissionId, newSubmission.id),
      orderBy: [desc(addresses.createdAt)]
    })

    const fullAddress = submittedAddress
      ? `${submittedAddress.streetAddress}, ${submittedAddress.addressLocality}, ${submittedAddress.addressRegion} ${submittedAddress.postalCode}`
      : null

    const roofSizeSqFt = submittedAddress?.roofAreaSqFt ?? null
    const roofPrice = submittedAddress?.estimate ?? null

    // 4) recipient emails by role
    const members = await db
      .select({
        role: member.role,
        email: user.email,
        name: user.name
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId))

    const allowedRoles = new Set(roleRecipients)
    const to = Array.from(new Set(
      members
        .filter(m => allowedRoles.has(m.role || ''))
        .map(m => m.email)
        .filter(Boolean)
    ))

    if (to.length === 0) {
      throw new Error('No recipients')
    }

    const html = await renderLeadSubmitted({
      teamName: org.name,
      leadName: newSubmission.name,
      leadEmail: newSubmission.email,
      leadPhone: newSubmission.phone,
      address: fullAddress,
      roofSizeSqFt,
      roofPrice
    })

    await resendInstance.emails.send({
      from: `${runtimeConfig.public.appName} <${runtimeConfig.public.appNotifyEmail}>`,
      to,
      subject: `New lead submitted - ${org.name}`,
      html
    })
  } catch {
    // Do not fail the submission if email fails or is disabled
  }

  // Generate a new toolSessionId for the next flow (like the old app did)
  const newToolSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  return {
    success: true,
    id: newSubmission.id,
    toolSessionId: newToolSessionId
  }
})
