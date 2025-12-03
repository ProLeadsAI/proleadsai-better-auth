/**
 * WordPress Plugin Integration - Update Organization Settings
 * Updates Google Maps API key and price per sq ft
 */

import { and, eq } from 'drizzle-orm'
import { member, organization } from '../../../database/schema'
import { getDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }

  const body = await readBody(event)

  if (!body.userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  const userId = body.userId
  const businessName = body.businessName
  const googleMapsApiKey = body.googleMapsApiKey
  const pricePerSq = body.pricePerSq
  const timezone = body.timezone

  console.log('[WordPress] update-settings received:', { userId, businessName, googleMapsApiKey: googleMapsApiKey ? '***' : undefined, pricePerSq, timezone })

  const db = getDB()

  // Find user's WordPress organization using source column
  const memberships = await db.select().from(member).where(eq(member.userId, userId))

  if (!memberships.length) {
    throw createError({ statusCode: 404, message: 'WordPress organization not found' })
  }

  let userOrgId: string | null = null
  for (const m of memberships) {
    const [org] = await db.select().from(organization).where(and(eq(organization.id, m.organizationId), eq(organization.source, 'wordpress'))).limit(1)
    if (org) {
      userOrgId = org.id
      break
    }
  }

  if (!userOrgId) {
    throw createError({ statusCode: 404, message: 'WordPress organization not found' })
  }

  // Build update object
  const updates: Record<string, any> = {}

  if (businessName !== undefined) {
    updates.name = businessName

    // Also update slug
    const baseSlug = businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40)

    // Check if new slug is available (excluding current org)
    let newSlug = baseSlug
    let suffix = 0
    while (true) {
      const existing = await db.select().from(organization).where(eq(organization.slug, newSlug)).limit(1)
      if (!existing.length || existing[0].id === userOrgId)
        break
      suffix++
      newSlug = `${baseSlug}-${suffix}`
    }
    updates.slug = newSlug
  }

  if (googleMapsApiKey !== undefined) {
    updates.googleMapsApiKey = googleMapsApiKey
  }

  if (pricePerSq !== undefined) {
    const parsed = typeof pricePerSq === 'number' ? pricePerSq : Number.parseInt(pricePerSq, 10)
    updates.pricePerSq = Number.isNaN(parsed) ? 750 : parsed
  }

  if (timezone !== undefined) {
    updates.timezone = timezone
  }

  if (Object.keys(updates).length > 0) {
    console.log('[WordPress] Updating org', userOrgId, 'with:', updates)
    await db.update(organization)
      .set(updates)
      .where(eq(organization.id, userOrgId))
    console.log('[WordPress] Update complete')
  } else {
    console.log('[WordPress] No updates to apply')
  }

  return {
    success: true,
    updated: updates
  }
})
