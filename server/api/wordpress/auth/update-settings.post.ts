/**
 * WordPress Plugin Integration - Update Organization Settings
 * Updates Google Maps API key and price per sq ft
 */

import { eq } from 'drizzle-orm'
import { member, organization } from '../../../database/schema'
import { getDB } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })

  if (event.method === 'OPTIONS') {
    return ''
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

  // Find user's WordPress organization (the one with source: 'wordpress' in metadata)
  const userOrgs = await db.query.member.findMany({
    where: eq(member.userId, userId),
    with: { organization: true }
  })

  // Find the WordPress-created org
  const userOrg = userOrgs.find((m) => {
    if (!m.organization?.metadata)
      return false
    try {
      const meta = typeof m.organization.metadata === 'string'
        ? JSON.parse(m.organization.metadata)
        : m.organization.metadata
      return meta.source === 'wordpress'
    } catch {
      return false
    }
  })

  if (!userOrg) {
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
      const existing = await db.query.organization.findFirst({
        where: eq(organization.slug, newSlug)
      })
      if (!existing || existing.id === userOrg.organizationId)
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
    updates.pricePerSq = Number.parseInt(pricePerSq, 10) || 750
  }

  if (timezone !== undefined) {
    updates.timezone = timezone
  }

  if (Object.keys(updates).length > 0) {
    console.log('[WordPress] Updating org', userOrg.organizationId, 'with:', updates)
    await db.update(organization)
      .set(updates)
      .where(eq(organization.id, userOrg.organizationId))
    console.log('[WordPress] Update complete')
  } else {
    console.log('[WordPress] No updates to apply')
  }

  return {
    success: true,
    updated: updates
  }
})
