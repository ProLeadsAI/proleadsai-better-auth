import { and, eq } from 'drizzle-orm'
import { addresses, contacts } from '../../../../database/schema'
import { requireOrgMembership } from '../../../../utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const contactId = getRouterParam(event, 'id')

  if (!orgId || !contactId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Contact ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)
  const body = await readBody(event)

  // Verify contact exists and belongs to org
  const existing = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.id, contactId),
      eq(contacts.organizationId, orgId)
    ),
    with: { addresses: true }
  })

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  // Build update object
  const updateData: Record<string, any> = {}
  if (body.name !== undefined)
    updateData.name = body.name || null
  if (body.email !== undefined)
    updateData.email = body.email?.toLowerCase().trim() || null
  if (body.phone !== undefined)
    updateData.phone = body.phone?.replace(/\D/g, '') || null
  if (body.company !== undefined)
    updateData.company = body.company || null
  if (body.notes !== undefined)
    updateData.notes = body.notes || null
  if (body.tags !== undefined)
    updateData.tags = body.tags
  if (body.source !== undefined)
    updateData.source = body.source || null
  if (body.metadata !== undefined)
    updateData.metadata = body.metadata

  const updated = await db.update(contacts)
    .set(updateData)
    .where(and(
      eq(contacts.id, contactId),
      eq(contacts.organizationId, orgId)
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
          addressCountry: body.address.addressCountry || null
        })
        .where(eq(addresses.id, existingAddress.id))
    } else {
      // Create new address
      await db.insert(addresses).values({
        organizationId: orgId,
        contactId,
        streetAddress: body.address.streetAddress,
        streetAddress2: body.address.streetAddress2 || null,
        postOfficeBoxNumber: body.address.postOfficeBoxNumber || null,
        addressLocality: body.address.addressLocality || '',
        addressRegion: body.address.addressRegion || '',
        postalCode: body.address.postalCode || '',
        addressCountry: body.address.addressCountry || null
      })
    }
  }

  return updated[0]
})
