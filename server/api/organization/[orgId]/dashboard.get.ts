import { and, avg, count, desc, eq, gte, lte } from 'drizzle-orm'
import { addresses, contacts, leads, submissions } from '~~/server/db/schema'
import { requireOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const query = getQuery(event)
  const startDate = query.startDate ? new Date(query.startDate as string) : null
  const endDate = query.endDate ? new Date(query.endDate as string) : null

  const { db } = await requireOrgMembership(event, orgId)

  // Build date filter conditions
  const buildDateFilter = (table: any) => {
    const conditions = [eq(table.organizationId, orgId)]
    if (startDate)
      conditions.push(gte(table.createdAt, startDate))
    if (endDate)
      conditions.push(lte(table.createdAt, endDate))
    return and(...conditions)
  }

  // Get counts in parallel
  const [leadsCount, contactsCount, submissionsCount, addressesCount, avgEstimate, recentAddresses] = await Promise.all([
    db.select({ count: count() }).from(leads).where(buildDateFilter(leads)),
    db.select({ count: count() }).from(contacts).where(buildDateFilter(contacts)),
    db.select({ count: count() }).from(submissions).where(buildDateFilter(submissions)),
    db.select({ count: count() }).from(addresses).where(buildDateFilter(addresses)),
    db.select({ avg: avg(addresses.estimate) }).from(addresses).where(buildDateFilter(addresses)),
    db.query.addresses.findMany({
      where: buildDateFilter(addresses),
      orderBy: [desc(addresses.createdAt)],
      limit: 5
    })
  ])

  return {
    leads: leadsCount[0]?.count ?? 0,
    contacts: contactsCount[0]?.count ?? 0,
    submissions: submissionsCount[0]?.count ?? 0,
    totalSearches: addressesCount[0]?.count ?? 0,
    avgEstimate: Math.round(Number(avgEstimate[0]?.avg) || 0),
    recentSearches: recentAddresses.map(a => ({
      id: a.id,
      streetAddress: a.streetAddress,
      addressLocality: a.addressLocality,
      addressRegion: a.addressRegion,
      roofAreaSqFt: a.roofAreaSqFt,
      estimate: a.estimate,
      createdAt: a.createdAt
    }))
  }
})
