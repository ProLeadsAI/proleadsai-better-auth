import { addresses, contacts } from '../../../../database/schema'
import { requireOrgMembership } from '../../../../utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)
  const body = await readBody(event)

  // Create contact
  const newContact = await db.insert(contacts).values({
    organizationId: orgId,
    name: body.name || null,
    email: body.email?.toLowerCase().trim() || null,
    phone: body.phone?.replace(/\D/g, '') || null,
    company: body.company || null,
    notes: body.notes || null,
    tags: body.tags || [],
    source: body.source || null,
    metadata: body.metadata || {}
  }).returning()

  const contact = newContact[0]

  // Create address if provided
  if (body.address && body.address.streetAddress) {
    await db.insert(addresses).values({
      organizationId: orgId,
      contactId: contact.id,
      streetAddress: body.address.streetAddress,
      streetAddress2: body.address.streetAddress2 || null,
      postOfficeBoxNumber: body.address.postOfficeBoxNumber || null,
      addressLocality: body.address.addressLocality || '',
      addressRegion: body.address.addressRegion || '',
      postalCode: body.address.postalCode || '',
      addressCountry: body.address.addressCountry || null
    })
  }

  return contact
})
