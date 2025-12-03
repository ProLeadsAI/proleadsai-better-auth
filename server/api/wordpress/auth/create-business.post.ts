/**
 * WordPress Plugin Integration - Create Business
 * Creates organization and API key when user enters business name
 */

import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { apiKey, member, organization, user } from '../../../database/schema'
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

  if (!body.userId || !body.businessName) {
    throw createError({ statusCode: 400, message: 'userId and businessName are required' })
  }

  const userId = body.userId
  const businessName = body.businessName.trim()
  const siteUrl = body.siteUrl || ''

  const db = getDB()

  // Verify user exists
  const foundUser = await db.query.user.findFirst({
    where: eq(user.id, userId)
  })

  if (!foundUser) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Check if user already has a WordPress organization
  const userOrgs = await db.query.member.findMany({
    where: eq(member.userId, userId),
    with: { organization: true }
  })

  // Find existing WordPress org
  let userOrg = userOrgs.find((m) => {
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
    // Generate a clean slug from business name
    const baseSlug = businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40)

    // Check if slug exists and add suffix if needed
    let slug = baseSlug
    let suffix = 0
    while (true) {
      const existing = await db.query.organization.findFirst({
        where: eq(organization.slug, slug)
      })
      if (!existing)
        break
      suffix++
      slug = `${baseSlug}-${suffix}`
    }

    const orgId = uuidv7()

    console.log('[WordPress] Creating organization:', { orgId, businessName, slug, userId })

    try {
      await db.insert(organization).values({
        id: orgId,
        name: businessName,
        slug,
        domainName: siteUrl || null,
        createdAt: new Date(),
        metadata: JSON.stringify({ source: 'wordpress' })
      })
      console.log('[WordPress] Organization created successfully')
    } catch (e) {
      console.error('[WordPress] Failed to create organization:', e)
      throw e
    }

    // Add user as owner
    try {
      await db.insert(member).values({
        id: uuidv7(),
        organizationId: orgId,
        userId,
        role: 'owner',
        createdAt: new Date()
      })
      console.log('[WordPress] Member created successfully')
    } catch (e) {
      console.error('[WordPress] Failed to create member:', e)
      throw e
    }

    // Fetch the created org
    userOrg = await db.query.member.findFirst({
      where: eq(member.userId, userId),
      with: { organization: true }
    })
    console.log('[WordPress] Fetched userOrg:', userOrg)
  } else {
    // Update existing org name and slug
    const baseSlug = businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40)

    // Check if new slug is different and available
    let newSlug = baseSlug
    if (userOrg.organization.slug !== baseSlug) {
      let suffix = 0
      while (true) {
        const existing = await db.query.organization.findFirst({
          where: eq(organization.slug, newSlug)
        })
        // Allow if not found or if it's the same org
        if (!existing || existing.id === userOrg.organizationId)
          break
        suffix++
        newSlug = `${baseSlug}-${suffix}`
      }
    } else {
      newSlug = userOrg.organization.slug
    }

    await db.update(organization)
      .set({ name: businessName, slug: newSlug, domainName: siteUrl || null })
      .where(eq(organization.id, userOrg.organizationId))

    userOrg = await db.query.member.findFirst({
      where: eq(member.userId, userId),
      with: { organization: true }
    })
  }

  if (!userOrg) {
    throw createError({ statusCode: 500, message: 'Failed to create organization' })
  }

  const org = userOrg.organization

  // Check if API key already exists for this user
  const existingKey = await db.query.apiKey.findFirst({
    where: eq(apiKey.userId, userId)
  })

  let apiKeyValue: string

  if (existingKey) {
    // Return empty - user already has a key
    apiKeyValue = ''
  } else {
    // Generate new API key with wordpress metadata
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

    apiKeyValue = rawKey
  }

  return {
    success: true,
    apiKey: apiKeyValue,
    team: {
      id: org.id,
      name: businessName,
      slug: org.slug
    }
  }
})
