import { eq } from 'drizzle-orm'
import { organization } from '~~/server/db/schema'
import { requireOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId)
  })

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  return {
    pricePerSq: org.pricePerSq ?? 350,
    domainName: org.domainName ?? '',
    googleMapsApiKey: org.googleMapsApiKey ?? '',
    timezone: org.timezone ?? 'America/New_York'
  }
})
