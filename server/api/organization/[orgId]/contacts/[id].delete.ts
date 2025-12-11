import { and, eq } from 'drizzle-orm'
import { contacts } from '~~/server/db/schema'
import { requireOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const contactId = getRouterParam(event, 'id')

  if (!orgId || !contactId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Contact ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)

  // Verify contact exists and belongs to org
  const existing = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.id, contactId),
      eq(contacts.organizationId, orgId)
    )
  })

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  await db.delete(contacts)
    .where(and(
      eq(contacts.id, contactId),
      eq(contacts.organizationId, orgId)
    ))

  return { success: true }
})
