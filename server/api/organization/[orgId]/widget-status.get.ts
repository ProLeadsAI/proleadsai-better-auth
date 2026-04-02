import { eq } from 'drizzle-orm'
import { organization as organizationTable } from '~~/server/db/schema'
import { getCreditBalance } from '~~/server/utils/credits'
import { useDB } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  })

  if (getMethod(event) === 'OPTIONS') {
    return null
  }

  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const db = await useDB(event)
  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.id, orgId)
  })

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  const balance = await getCreditBalance(orgId)
  const widgetEnabled = balance.remaining === null || balance.remaining > 0

  return {
    widgetEnabled,
    reason: widgetEnabled ? 'available' : 'out_of_credits',
    message: widgetEnabled ? null : 'This widget is currently unavailable because this organization has no credits remaining.',
    remaining: balance.remaining,
    limit: balance.limit,
    plan: balance.plan,
    periodEnd: balance.periodEnd
  }
})
