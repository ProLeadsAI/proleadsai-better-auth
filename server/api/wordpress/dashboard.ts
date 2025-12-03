/**
 * WordPress Plugin Integration - Dashboard Stats
 * Returns organization stats for the WordPress dashboard
 */

import { createHash } from 'node:crypto'
import { and, avg, count, desc, eq, gte, lte } from 'drizzle-orm'
import { addresses, apiKey, contacts, leads, member, organization, submissions } from '../../database/schema'
import { getDB } from '../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
  })

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (event.method !== 'GET') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }

  // Get API key from header
  const apiKeyHeader = getHeader(event, 'x-api-key')
  if (!apiKeyHeader) {
    throw createError({ statusCode: 401, message: 'API key required' })
  }

  const db = getDB()

  // Hash the API key to look it up
  const hashedKey = createHash('sha256').update(apiKeyHeader).digest('hex')

  const [foundKey] = await db.select().from(apiKey).where(eq(apiKey.key, hashedKey)).limit(1)

  if (!foundKey || !foundKey.enabled) {
    throw createError({ statusCode: 401, message: 'Invalid API key' })
  }

  // Get the organization from the API key metadata
  let orgId: string | null = null

  if (foundKey.metadata) {
    try {
      const meta = typeof foundKey.metadata === 'string'
        ? JSON.parse(foundKey.metadata)
        : foundKey.metadata
      orgId = meta.organizationId
    } catch {}
  }

  // If no org in metadata, find user's WordPress org using source column
  if (!orgId && foundKey.userId) {
    const memberships = await db.select().from(member).where(eq(member.userId, foundKey.userId))

    for (const m of memberships) {
      const [org] = await db.select().from(organization).where(and(eq(organization.id, m.organizationId), eq(organization.source, 'wordpress'))).limit(1)
      if (org) {
        orgId = org.id
        break
      }
      // Fallback to first org
      if (!orgId) {
        const [firstOrg] = await db.select().from(organization).where(eq(organization.id, m.organizationId)).limit(1)
        if (firstOrg)
          orgId = firstOrg.id
      }
    }
  }

  if (!orgId) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Get date range from query
  const query = getQuery(event)
  const startDate = query.startDate ? new Date(query.startDate as string) : null
  const endDate = query.endDate ? new Date(query.endDate as string) : null

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
