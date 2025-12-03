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

  // Verify lead exists and belongs to org
  const existing = await db.query.leads.findFirst({
    where: and(
      eq(leads.id, leadId),
      eq(leads.organizationId, orgId)
    )
  })

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Lead not found' })
  }

  await db.delete(leads)
    .where(and(
      eq(leads.id, leadId),
      eq(leads.organizationId, orgId)
    ))

  return { success: true }
})
