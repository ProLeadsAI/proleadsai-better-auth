import { desc, eq } from 'drizzle-orm'
import { leads } from '~~/server/db/schema'
import { requireOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)

  const result = await db.query.leads.findMany({
    where: eq(leads.organizationId, orgId),
    orderBy: [desc(leads.createdAt)],
    with: {
      addresses: true
    }
  })

  return result
})
