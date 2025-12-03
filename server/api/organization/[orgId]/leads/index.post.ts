import { addresses, leads } from '../../../../database/schema'
import { requireOrgMembership } from '../../../../utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const { db, user } = await requireOrgMembership(event, orgId)
  const body = await readBody(event)

  // Validate: at least name, email, or phone required
  if (!body.name && !body.email && !body.phone) {
    throw createError({ statusCode: 400, message: 'At least Name, Email, or Phone is required' })
  }

  const newLead = await db.insert(leads).values({
    organizationId: orgId,
    userId: user.id,
    sessionId: body.sessionId || `manual_${Date.now()}`,
    toolSessionId: body.toolSessionId || null,
    name: body.name || 'Unnamed Lead',
    email: body.email?.toLowerCase().trim() || null,
    phone: body.phone?.replace(/\D/g, '') || null,
    labels: body.labels || [],
    metadata: body.metadata || {}
  }).returning()

  const lead = newLead[0]

  // Create address if provided
  if (body.address && body.address.streetAddress) {
    await db.insert(addresses).values({
      organizationId: orgId,
      leadId: lead.id,
      streetAddress: body.address.streetAddress,
      streetAddress2: body.address.streetAddress2 || null,
      postOfficeBoxNumber: body.address.postOfficeBoxNumber || null,
      addressLocality: body.address.addressLocality || '',
      addressRegion: body.address.addressRegion || '',
      postalCode: body.address.postalCode || '',
      addressCountry: body.address.addressCountry || null,
      latitude: body.address.latitude || null,
      longitude: body.address.longitude || null
    })
  }

  return lead
})
