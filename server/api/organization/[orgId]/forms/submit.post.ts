import { and, eq } from 'drizzle-orm'
import { addresses, leads, organization as organizationTable, submissions } from '../../../../database/schema'
import { validateApiKey } from '../../../../utils/apiKeyAuth'
import { useDB } from '../../../../utils/db'

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

  // Determine source - use body.source, or 'wordpress' if API key used, or 'web' as default
  const source = body.source || (apiKeyAuth ? 'wordpress' : 'web')

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
        eq(leads.sessionId, body.toolSessionId),
        eq(leads.organizationId, orgId)
      )
    })

    if (lead) {
      // Update all addresses from that lead to also link to this submission
      await db.update(addresses)
        .set({ submissionId: newSubmission.id })
        .where(eq(addresses.leadId, lead.id))

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
      source,
      roofAreaSqFt: body.address.roofAreaSqFt || null,
      pricePerSquare: body.address.pricePerSquare || null,
      estimate: body.address.estimate || null,
      predominantPitchType: body.address.predominantPitchType || null,
      roofOutlinePoints: body.address.roofOutlinePoints || null
    })
  }

  // TODO: Send email notifications to org members

  return {
    success: true,
    id: newSubmission.id
  }
})
