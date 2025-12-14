/**
 * WordPress Plugin Integration - Get User's WordPress Organization
 * Returns the user's existing WordPress org if they have one
 */

import { and, eq } from 'drizzle-orm'
import { apiKey, member, organization, user } from '~~/server/db/schema'
import { getDB } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (event.method !== 'GET') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }

  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  const db = getDB()

  // Verify user exists
  const [foundUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!foundUser) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Find user's memberships
  const memberships = await db.select().from(member).where(eq(member.userId, userId))
  if (!memberships.length) {
    return { found: false, organization: null, hasApiKey: false }
  }

  // Find WordPress org using source column
  let wpOrg = null
  for (const m of memberships) {
    const [org] = await db.select().from(organization).where(and(eq(organization.id, m.organizationId), eq(organization.source, 'wordpress'))).limit(1)
    if (org) {
      wpOrg = org
      break
    }
  }

  if (!wpOrg) {
    return { found: false, organization: null, hasApiKey: false }
  }

  // Check API key
  const existingKeys = await db.select().from(apiKey).where(eq(apiKey.userId, userId)).limit(1)

  return {
    found: true,
    organization: {
      id: wpOrg.id,
      name: wpOrg.name,
      slug: wpOrg.slug,
      googleMapsApiKey: wpOrg.googleMapsApiKey,
      googleSolarApiKey: wpOrg.googleSolarApiKey,
      pricePerSq: wpOrg.pricePerSq,
      timezone: wpOrg.timezone
    },
    hasApiKey: existingKeys.length > 0
  }
})
