import { and, eq } from 'drizzle-orm'
import { addresses, leads } from '~~/server/db/schema'
import { requirePaidOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const leadId = getRouterParam(event, 'id')

  if (!orgId || !leadId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Lead ID required' })
  }

  const { db } = await requirePaidOrgMembership(event, orgId)
  const body = await readBody(event)

  // Verify lead exists and belongs to org
  const existing = await db.query.leads.findFirst({
    where: and(
      eq(leads.id, leadId),
      eq(leads.organizationId, orgId)
    ),
    with: { addresses: true }
  })

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Lead not found' })
  }

  // Build update object
  const updateData: Record<string, any> = {}
  if (body.name !== undefined)
    updateData.name = body.name
  if (body.email !== undefined)
    updateData.email = body.email?.toLowerCase().trim() || null
  if (body.phone !== undefined)
    updateData.phone = body.phone?.replace(/\D/g, '') || null
  if (body.labels !== undefined)
    updateData.labels = body.labels
  if (body.metadata !== undefined)
    updateData.metadata = body.metadata

  const updated = await db.update(leads)
    .set(updateData)
    .where(and(
      eq(leads.id, leadId),
      eq(leads.organizationId, orgId)
    ))
    .returning()

  // Handle address update/create
  if (body.address && body.address.streetAddress) {
    const existingAddress = existing.addresses?.[0]

    if (existingAddress) {
      // Update existing address
      await db.update(addresses)
        .set({
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
        .where(eq(addresses.id, existingAddress.id))
    } else {
      // Create new address
      await db.insert(addresses).values({
        organizationId: orgId,
        leadId,
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
  }

  return updated[0]
})
