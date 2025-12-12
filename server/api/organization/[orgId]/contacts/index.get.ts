import { desc, eq } from 'drizzle-orm'
import { contacts } from '~~/server/db/schema'
import { requirePaidOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const { db } = await requirePaidOrgMembership(event, orgId)

  const result = await db.query.contacts.findMany({
    where: eq(contacts.organizationId, orgId),
    orderBy: [desc(contacts.createdAt)],
    with: {
      addresses: true
    }
  })

  return result
})
