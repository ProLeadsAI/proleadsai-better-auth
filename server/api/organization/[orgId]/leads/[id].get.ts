import { and, eq } from 'drizzle-orm'
import { leads } from '../../../../database/schema'
import { requireOrgMembership } from '../../../../utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const leadId = getRouterParam(event, 'id')

  if (!orgId || !leadId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Lead ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)

  const lead = await db.query.leads.findFirst({
    where: and(
      eq(leads.id, leadId),
      eq(leads.organizationId, orgId)
    ),
    with: {
      addresses: true
    }
  })

  if (!lead) {
    throw createError({ statusCode: 404, message: 'Lead not found' })
  }

  return lead
})
