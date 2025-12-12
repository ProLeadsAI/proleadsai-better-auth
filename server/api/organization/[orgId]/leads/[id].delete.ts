import { and, eq } from 'drizzle-orm'
import { leads } from '~~/server/db/schema'
import { requirePaidOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const leadId = getRouterParam(event, 'id')

  if (!orgId || !leadId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Lead ID required' })
  }

  const { db } = await requirePaidOrgMembership(event, orgId)

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

  // Delete lead
  await db.delete(leads).where(and(
    eq(leads.id, leadId),
    eq(leads.organizationId, orgId)
  ))

  return { success: true }
})
