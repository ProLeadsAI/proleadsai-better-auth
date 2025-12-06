/**
 * WordPress Plugin Integration - Dashboard Stats
 * Returns organization stats for the WordPress dashboard
 */

import { createHash } from 'node:crypto'
import { and, avg, count, countDistinct, desc, eq, gte, lte } from 'drizzle-orm'
import { addresses, apiKey, contacts, leads, member, organization, submissions, subscription } from '../../database/schema'
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

  // Check subscription status to determine if user is Pro
  const [sub] = await db.select().from(subscription).where(eq(subscription.referenceId, orgId)).limit(1)

  const isActiveOrTrialing = sub && (sub.status === 'active' || sub.status === 'trialing')
  const notExpired = !sub?.periodEnd || new Date(sub.periodEnd) > new Date()
  const inTrial = sub?.trialEnd && new Date(sub.trialEnd) > new Date()
  const isPro = isActiveOrTrialing && (notExpired || inTrial)

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
  const [leadsCount, contactsCount, submissionsCount, addressesCount, avgEstimate, uniqueSessionsCount, recentAddresses, recentSubmissions] = await Promise.all([
    db.select({ count: count() }).from(leads).where(buildDateFilter(leads)),
    db.select({ count: count() }).from(contacts).where(buildDateFilter(contacts)),
    db.select({ count: count() }).from(submissions).where(buildDateFilter(submissions)),
    db.select({ count: count() }).from(addresses).where(buildDateFilter(addresses)),
    db.select({ avg: avg(addresses.estimate) }).from(addresses).where(buildDateFilter(addresses)),
    // Count unique sessions from leads table (each session = unique user)
    db.select({ count: countDistinct(leads.sessionId) }).from(leads).where(buildDateFilter(leads)),
    db.query.addresses.findMany({
      where: buildDateFilter(addresses),
      orderBy: [desc(addresses.createdAt)],
      limit: 10
    }),
    db.query.submissions.findMany({
      where: buildDateFilter(submissions),
      orderBy: [desc(submissions.createdAt)],
      limit: 10,
      with: {
        addresses: true
      }
    })
  ])

  // Generate a short user ID from sessionId (last 4 chars)
  const getShortUserId = (sessionId: string | null) => {
    if (!sessionId)
      return null
    // Extract the random part after the last underscore
    const parts = sessionId.split('_')
    const randomPart = parts[parts.length - 1] || sessionId
    return randomPart.slice(0, 4).toUpperCase()
  }

  // Get sessionId for an address by looking up its lead
  const addressLeadMap = new Map<string, string | null>()
  for (const addr of recentAddresses) {
    if (addr.leadId) {
      const lead = await db.query.leads.findFirst({
        where: eq(leads.id, addr.leadId),
        columns: { sessionId: true }
      })
      addressLeadMap.set(addr.id, lead?.sessionId || null)
    }
  }

  // Build a map of submission address IDs to submission info (for marking searches that converted)
  const submissionAddressMap = new Map<string, { submissionId: string, name: string | null, email: string | null, phone: string | null }>()
  for (const s of recentSubmissions) {
    if (s.addresses) {
      for (const addr of s.addresses) {
        submissionAddressMap.set(addr.id, { submissionId: s.id, name: s.name, email: s.email, phone: s.phone })
      }
    }
  }

  // Build a map of sessionId + address -> submission info (for matching by location)
  const submittedAddressBySession = new Map<string, { submissionId: string, name: string | null, email: string | null, phone: string | null }>()
  for (const s of recentSubmissions) {
    const sessionId = s.sessionId || s.toolSessionId
    if (sessionId && s.addresses) {
      for (const addr of s.addresses) {
        const addressKey = `${sessionId}:${addr.streetAddress}:${addr.addressLocality}`
        submittedAddressBySession.set(addressKey, { submissionId: s.id, name: s.name, email: s.email, phone: s.phone })
      }
    }
  }

  // Combine and sort recent activity - show ALL searches, mark which ones converted to leads
  const recentActivity = [
    // Include ALL addresses (searches), mark if they converted to a submission
    ...recentAddresses
      .map((a) => {
        const sessionId = addressLeadMap.get(a.id) || null

        // Check if this search converted to a submission
        let convertedTo: { submissionId: string, name: string | null, email: string | null, phone: string | null } | null = null

        // First check by direct address ID
        if (a.submissionId || submissionAddressMap.has(a.id)) {
          convertedTo = submissionAddressMap.get(a.id) || { submissionId: a.submissionId!, name: null, email: null, phone: null }
        }
        // Then check by session + address location match
        else if (sessionId) {
          const addressKey = `${sessionId}:${a.streetAddress}:${a.addressLocality}`
          if (submittedAddressBySession.has(addressKey)) {
            convertedTo = submittedAddressBySession.get(addressKey)!
          }
        }

        return {
          id: a.id,
          type: 'search' as const,
          streetAddress: a.streetAddress,
          addressLocality: a.addressLocality,
          addressRegion: a.addressRegion,
          roofAreaSqFt: a.roofAreaSqFt,
          estimate: a.estimate,
          name: convertedTo?.name || null,
          // Only include email/phone for Pro users
          email: isPro ? (convertedTo?.email || null) : null,
          phone: isPro ? (convertedTo?.phone || null) : null,
          // Include leadId for deep linking (from addresses.leadId)
          leadId: a.leadId || null,
          sessionId,
          userId: getShortUserId(sessionId),
          createdAt: a.createdAt,
          convertedToLead: !!convertedTo
        }
      }),
    // Include all submissions (even without linked addresses)
    ...recentSubmissions
      .map((s) => {
        const sessionId = s.sessionId || s.toolSessionId
        const firstAddress = s.addresses?.[0]
        return {
          id: s.id,
          type: 'submission' as const,
          streetAddress: firstAddress?.streetAddress || null,
          addressLocality: firstAddress?.addressLocality || null,
          addressRegion: firstAddress?.addressRegion || null,
          roofAreaSqFt: firstAddress?.roofAreaSqFt || null,
          estimate: firstAddress?.estimate || null,
          name: s.name,
          // Only include email/phone for Pro users
          email: isPro ? s.email : null,
          phone: isPro ? s.phone : null,
          // Include leadId for deep linking (from the first address's leadId)
          leadId: firstAddress?.leadId || null,
          sessionId,
          userId: getShortUserId(sessionId),
          createdAt: s.createdAt,
          convertedToLead: false
        }
      })
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)

  return {
    leads: leadsCount[0]?.count ?? 0,
    contacts: contactsCount[0]?.count ?? 0,
    submissions: submissionsCount[0]?.count ?? 0,
    totalSearches: addressesCount[0]?.count ?? 0,
    uniqueUsers: uniqueSessionsCount[0]?.count ?? 0,
    avgEstimate: Math.round(Number(avgEstimate[0]?.avg) || 0),
    recentSearches: recentActivity
  }
})
