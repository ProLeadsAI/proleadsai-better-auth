import { desc, eq } from 'drizzle-orm'
import { contacts } from '../../../../database/schema'
import { requireOrgMembership } from '../../../../utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)

  const result = await db.query.contacts.findMany({
    where: eq(contacts.organizationId, orgId),
    orderBy: [desc(contacts.createdAt)],
    with: {
      addresses: true
    }
  })

  return result
})
