/**
 * WordPress Plugin Integration - Update Organization Settings
 */

import { eq } from 'drizzle-orm'
import { member, organization } from '~~/server/db/schema'
import { getDB } from '~~/server/utils/db'
import { assertUserCanManageWordPressOrganization, normalizeWordPressSiteUrl, syncWordPressApiKeySiteUrl } from '~~/server/utils/wordpress'

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
  const organizationId = body.organizationId || body.teamId
  const businessName = body.businessName
  const googleMapsApiKey = body.googleMapsApiKey
  const googleSolarApiKey = body.googleSolarApiKey
  const pricePerSq = body.pricePerSq
  const timezone = body.timezone
  const siteUrl = normalizeWordPressSiteUrl(body.siteUrl || body.domainName || '')

  const db = getDB()

  let userOrgId = organizationId as string | null
  if (userOrgId) {
    await assertUserCanManageWordPressOrganization(db, userId, userOrgId)
  }
  else {
    const memberships = await db.query.member.findMany({
      where: eq(member.userId, userId),
      with: { organization: true }
    })

    const manageableMembership = memberships.find(m => ['owner', 'admin'].includes(m.role))
    if (!manageableMembership) {
      throw createError({ statusCode: 404, message: 'Organization not found' })
    }
    userOrgId = manageableMembership.organizationId
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

  if (googleSolarApiKey !== undefined) {
    updates.googleSolarApiKey = googleSolarApiKey
  }

  if (pricePerSq !== undefined) {
    const parsed = typeof pricePerSq === 'number' ? pricePerSq : Number.parseInt(pricePerSq, 10)
    updates.pricePerSq = Number.isNaN(parsed) ? 750 : parsed
  }

  if (timezone !== undefined) {
    updates.timezone = timezone
  }

  if (siteUrl) {
    updates.domainName = siteUrl
  }

  if (Object.keys(updates).length > 0) {
    await db.update(organization)
      .set(updates)
      .where(eq(organization.id, userOrgId))
  }

  if (siteUrl)
    await syncWordPressApiKeySiteUrl(db, userOrgId, siteUrl)

  return {
    success: true,
    updated: updates
  }
})
