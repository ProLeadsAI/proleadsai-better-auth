/**
 * WordPress Plugin Integration - Get User's connectable organizations
 * Returns organizations that can be connected to this WordPress site.
 */

import { eq } from 'drizzle-orm'
import { user } from '~~/server/db/schema'
import { getDB } from '~~/server/utils/db'
import { getUserConnectableWordPressOrganizations, normalizeWordPressSiteUrl } from '~~/server/utils/wordpress'

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
  const siteUrl = normalizeWordPressSiteUrl(query.siteUrl as string || '')

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  const db = getDB()

  // Verify user exists
  const [foundUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!foundUser) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const organizations = await getUserConnectableWordPressOrganizations(db, userId, siteUrl)
  const autoConnectOrganization = organizations.find(org => org.isConnectedToCurrentSite)
    || (organizations.filter(org => org.canConnect).length === 1
      ? organizations.find(org => org.canConnect) || null
      : null)

  const connectableOrganizations = organizations.filter(org => org.canConnect)

  return {
    found: connectableOrganizations.length > 0,
    siteUrl,
    organizations: connectableOrganizations,
    autoConnectOrganization,
    requiresSelection: !autoConnectOrganization && connectableOrganizations.length > 1
  }
})
