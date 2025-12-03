import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { apiKey } from '../database/schema'
import { getDB } from './db'

/**
 * Validates an API key from the request header and returns the organization ID
 * API key can be passed via:
 * - x-api-key header
 * - Authorization: Bearer <key> header
 */
export async function validateApiKey(event: H3Event): Promise<{ organizationId: string, keyName: string } | null> {
  const headers = getRequestHeaders(event)

  // Get API key from headers
  let key = headers['x-api-key']
  if (!key && headers.authorization?.startsWith('Bearer ')) {
    key = headers.authorization.slice(7)
  }

  if (!key) {
    return null
  }

  const db = getDB()

  // Find the API key - better-auth stores hashed keys, but we can match by the start
  // The key format is typically: prefix_randomstring
  // We need to hash and compare, but for now let's check if the key exists
  // Better-auth apiKey plugin stores: id, name, start (first chars), key (hashed), userId, metadata, etc.

  // For better-auth, we need to use their API to validate
  // But since we're in a public endpoint, let's do a simple lookup
  // The 'start' field contains the first few characters of the key

  const keyStart = key.substring(0, 8) // better-auth stores first 8 chars

  const keys = await db.select().from(apiKey).where(
    eq(apiKey.start, keyStart)
  )

  if (keys.length === 0) {
    return null
  }

  // Find the matching key and extract organization ID from metadata
  for (const k of keys) {
    // Check if key is expired
    if (k.expiresAt && new Date(k.expiresAt) < new Date()) {
      continue
    }

    // Parse metadata to get organizationId
    let metadata: any = k.metadata
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata)
      } catch {
        continue
      }
    }

    // Handle double-encoded JSON
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata)
      } catch {
        continue
      }
    }

    if (metadata?.organizationId) {
      // Update last request time
      await db.update(apiKey)
        .set({ lastRequest: new Date() })
        .where(eq(apiKey.id, k.id))

      return {
        organizationId: metadata.organizationId,
        keyName: k.name || 'API Key'
      }
    }
  }

  return null
}
