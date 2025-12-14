/**
 * WordPress Plugin Integration - Get/Update Organization Settings
 * GET: Fetch current settings
 * POST: Update settings (returns updated values)
 */

import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { apiKey, member, organization, subscription, user } from '~~/server/db/schema'
import { getDB } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
  })

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
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

  // Get the organization from the API key metadata or user membership
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

  // GET: Return current settings
  if (event.method === 'GET') {
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    if (!org) {
      throw createError({ statusCode: 404, message: 'Organization not found' })
    }

    // Get user email from the API key owner
    let email = null
    if (foundKey.userId) {
      const [foundUser] = await db.select().from(user).where(eq(user.id, foundKey.userId)).limit(1)
      if (foundUser) {
        email = foundUser.email
      }
    }

    // Check subscription status
    const [sub] = await db.select().from(subscription).where(eq(subscription.referenceId, orgId)).limit(1)

    // User is Pro if they have an active or trialing subscription
    // The status field from Stripe is the source of truth
    const isPro = sub && (sub.status === 'active' || sub.status === 'trialing')

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      email,
      googleMapsApiKey: org.googleMapsApiKey,
      googleSolarApiKey: org.googleSolarApiKey,
      pricePerSq: org.pricePerSq,
      timezone: org.timezone,
      domainName: org.domainName,
      isPro: !!isPro,
      plan: sub?.plan || 'free',
      subscriptionStatus: sub?.status || null
    }
  }

  // POST: Update settings
  if (event.method === 'POST') {
    const body = await readBody(event)

    const updates: Record<string, any> = {}

    if (body.name !== undefined) {
      updates.name = body.name

      // Update slug too
      const baseSlug = body.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 40)

      let newSlug = baseSlug
      let suffix = 0
      while (true) {
        const existing = await db.query.organization.findFirst({
          where: eq(organization.slug, newSlug)
        })
        if (!existing || existing.id === orgId)
          break
        suffix++
        newSlug = `${baseSlug}-${suffix}`
      }
      updates.slug = newSlug
    }

    if (body.googleMapsApiKey !== undefined) {
      updates.googleMapsApiKey = body.googleMapsApiKey || null
    }

    if (body.googleSolarApiKey !== undefined) {
      updates.googleSolarApiKey = body.googleSolarApiKey || null
    }

    if (body.pricePerSq !== undefined) {
      const parsed = typeof body.pricePerSq === 'number' ? body.pricePerSq : Number.parseInt(body.pricePerSq, 10)
      updates.pricePerSq = Number.isNaN(parsed) ? 750 : parsed
    }

    if (body.timezone !== undefined) {
      updates.timezone = body.timezone || null
    }

    if (body.domainName !== undefined) {
      updates.domainName = body.domainName || null
    }

    if (Object.keys(updates).length === 0) {
      throw createError({ statusCode: 400, message: 'No valid fields to update' })
    }

    const [updated] = await db.update(organization)
      .set(updates)
      .where(eq(organization.id, orgId))
      .returning()

    return {
      success: true,
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      googleMapsApiKey: updated.googleMapsApiKey,
      googleSolarApiKey: updated.googleSolarApiKey,
      pricePerSq: updated.pricePerSq,
      timezone: updated.timezone,
      domainName: updated.domainName
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
