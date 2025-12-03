/**
 * WordPress Plugin Integration - Regenerate API Key
 * Generates a new API key for a user who lost theirs (e.g., reinstalled plugin)
 */

import { createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { apiKey, member, organization } from '../../../database/schema'
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
  const db = getDB()

  // Find user's WordPress organization using source column
  const memberships = await db.select().from(member).where(eq(member.userId, userId))

  if (!memberships.length) {
    throw createError({ statusCode: 404, message: 'WordPress organization not found' })
  }

  let org = null
  for (const m of memberships) {
    const [o] = await db.select().from(organization).where(and(eq(organization.id, m.organizationId), eq(organization.source, 'wordpress'))).limit(1)
    if (o) {
      org = o
      break
    }
  }

  if (!org) {
    throw createError({ statusCode: 404, message: 'WordPress organization not found' })
  }

  // Delete any existing WordPress API keys for this user
  const existingKeys = await db.query.apiKey.findMany({
    where: eq(apiKey.userId, userId)
  })

  for (const key of existingKeys) {
    if (key.metadata) {
      try {
        const meta = typeof key.metadata === 'string' ? JSON.parse(key.metadata) : key.metadata
        if (meta.source === 'wordpress') {
          console.log('[WordPress] Deleting old API key:', key.id)
          await db.delete(apiKey).where(eq(apiKey.id, key.id))
        }
      } catch {}
    }
  }

  // Generate new API key
  const rawKey = `wp_${randomBytes(24).toString('base64url')}`
  const hashedKey = createHash('sha256').update(rawKey).digest('hex')

  await db.insert(apiKey).values({
    id: uuidv7(),
    name: `WordPress - ${org.name}`,
    start: rawKey.substring(0, 8),
    prefix: 'wp',
    key: hashedKey,
    userId,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: JSON.stringify({
      source: 'wordpress',
      organizationId: org.id
    })
  })

  console.log('[WordPress] Generated new API key for user:', userId)

  return {
    success: true,
    apiKey: rawKey,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug
    }
  }
})
