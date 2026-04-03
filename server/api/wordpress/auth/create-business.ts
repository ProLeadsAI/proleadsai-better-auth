/**
 * WordPress Plugin Integration - Create or connect organization
 * Creates a new org or connects the plugin to an existing org and rotates the WordPress API key.
 */

import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { member, organization, user } from '~~/server/db/schema'
import { getDB } from '~~/server/utils/db'
import {
  assertUserCanManageWordPressOrganization,
  assertWordPressOrganizationConnectionAvailable,
  generateUniqueOrganizationSlug,
  normalizeWordPressSiteUrl,
  rotateWordPressApiKey
} from '~~/server/utils/wordpress'

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

  const userId = body.userId as string
  const organizationId = body.organizationId?.trim?.() || ''
  const businessName = body.businessName?.trim?.() || ''
  const siteUrl = normalizeWordPressSiteUrl(body.siteUrl || '')

  const db = getDB()

  const [foundUser] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!foundUser) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  let org = null as typeof organization.$inferSelect | null

  if (organizationId) {
    const membershipRecord = await assertUserCanManageWordPressOrganization(db, userId, organizationId)
    await assertWordPressOrganizationConnectionAvailable(db, organizationId, siteUrl)
    org = membershipRecord.organization
  }
  else {
    if (!businessName) {
      throw createError({ statusCode: 400, message: 'businessName is required' })
    }

    const slug = await generateUniqueOrganizationSlug(db, businessName)
    const orgId = uuidv7()

    await db.insert(organization).values({
      id: orgId,
      name: businessName,
      slug,
      domainName: siteUrl || null,
      createdAt: new Date(),
      source: 'wordpress'
    })

    await db.insert(member).values({
      id: uuidv7(),
      organizationId: orgId,
      userId,
      role: 'owner',
      createdAt: new Date()
    })

    const [createdOrg] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)
    org = createdOrg || null
  }

  if (!org) {
    throw createError({ statusCode: 500, message: 'Failed to create or connect organization' })
  }

  if (siteUrl && org.domainName !== siteUrl) {
    await db.update(organization)
      .set({ domainName: siteUrl })
      .where(eq(organization.id, org.id))

    org = {
      ...org,
      domainName: siteUrl
    }
  }

  const apiKey = await rotateWordPressApiKey(db, userId, org.id, org.name, siteUrl)

  return {
    success: true,
    apiKey,
    team: {
      id: org.id,
      name: org.name,
      slug: org.slug
    }
  }
})
