/**
 * WordPress Plugin Integration - Create Business
 * Creates organization and API key when user enters business name
 */

import { createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { apiKey, member, organization, user } from '~~/server/db/schema'
import { getDB } from '~~/server/utils/db'

/**
 * Find WordPress org using source column
 */
async function findWordPressOrg(db: ReturnType<typeof getDB>, userId: string) {
  const memberships = await db.select().from(member).where(eq(member.userId, userId))
  if (!memberships.length)
    return null

  for (const m of memberships) {
    const [org] = await db.select().from(organization).where(and(eq(organization.id, m.organizationId), eq(organization.source, 'wordpress'))).limit(1)
    if (org)
      return { membership: m, organization: org }
  }
  return null
}

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

  if (!body.userId || !body.businessName) {
    throw createError({ statusCode: 400, message: 'userId and businessName are required' })
  }

  const userId = body.userId
  const businessName = body.businessName.trim()
  const siteUrl = body.siteUrl || ''

  const db = getDB()

  // Validate user
  const [foundUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!foundUser) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Check for existing WordPress org
  let wpOrgResult = await findWordPressOrg(db, userId)
  let userOrg = wpOrgResult
    ? { organizationId: wpOrgResult.organization.id, organization: wpOrgResult.organization }
    : null

  // CREATE NEW ORG
  if (!userOrg) {
    const baseSlug = businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40)

    // Ensure slug uniqueness
    let slug = baseSlug
    let suffix = 0
    while (true) {
      const [existing] = await db.select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, slug))
        .limit(1)
      if (!existing)
        break
      suffix++
      slug = `${baseSlug}-${suffix}`
    }

    const orgId = uuidv7()

    // Create organization
    await db.insert(organization).values({
      id: orgId,
      name: businessName,
      slug,
      domainName: siteUrl || null,
      createdAt: new Date(),
      source: 'wordpress'
    })

    // Add user as owner
    await db.insert(member).values({
      id: uuidv7(),
      organizationId: orgId,
      userId,
      role: 'owner',
      createdAt: new Date()
    })

    // Re-fetch org
    wpOrgResult = await findWordPressOrg(db, userId)
    userOrg = wpOrgResult
      ? { organizationId: wpOrgResult.organization.id, organization: wpOrgResult.organization }
      : null
  }
  // UPDATE EXISTING ORG
  else {
    const current = userOrg.organization

    const baseSlug = businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40)

    let newSlug = baseSlug

    if (current.slug !== baseSlug) {
      let suffix = 0
      while (true) {
        const [existing] = await db.select({ id: organization.id })
          .from(organization)
          .where(eq(organization.slug, newSlug))
          .limit(1)
        if (!existing || existing.id === current.id)
          break
        suffix++
        newSlug = `${baseSlug}-${suffix}`
      }
    }

    await db.update(organization)
      .set({ name: businessName, slug: newSlug, domainName: siteUrl || null })
      .where(eq(organization.id, current.id))

    // Refetch
    const [updated] = await db.select().from(organization).where(eq(organization.id, current.id)).limit(1)
    if (updated) {
      userOrg.organization = updated
    }
  }

  if (!userOrg) {
    throw createError({ statusCode: 500, message: 'Failed to create organization' })
  }

  const org = userOrg.organization

  // Handle API key
  const existingKeys = await db.select().from(apiKey).where(eq(apiKey.userId, userId))

  // Find existing WordPress key
  const wpKey = existingKeys.find((k) => {
    if (!k.metadata)
      return false
    try {
      const meta = typeof k.metadata === 'string' ? JSON.parse(k.metadata) : k.metadata
      return meta.source === 'wordpress'
    } catch { return false }
  })

  if (wpKey) {
    await db.delete(apiKey).where(eq(apiKey.id, wpKey.id))
  }

  // Create new key
  const rawKey = `wp_${randomBytes(24).toString('base64url')}`
  const hashedKey = createHash('sha256').update(rawKey).digest('hex')

  await db.insert(apiKey).values({
    id: uuidv7(),
    name: `WordPress - ${businessName}`,
    start: rawKey.substring(0, 8),
    prefix: 'wp',
    key: hashedKey,
    userId,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: JSON.stringify({
      source: 'wordpress',
      organizationId: org.id,
      domainName: siteUrl
    })
  })

  return {
    success: true,
    apiKey: rawKey,
    team: {
      id: org.id,
      name: businessName,
      slug: org.slug
    }
  }
})
