import type { getDB } from '~~/server/utils/db'
import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { apiKey, member } from '~~/server/db/schema'

type Database = ReturnType<typeof getDB>

interface WordPressApiKeyMetadata {
  source?: string
  organizationId?: string
  siteUrl?: string
  domainName?: string
}

export function normalizeWordPressSiteUrl(input?: string | null) {
  if (!input)
    return ''

  try {
    const url = new URL(input)
    const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
    return `${url.origin.toLowerCase()}${pathname}`
  }
  catch {
    return input.trim().replace(/\/+$/, '').toLowerCase()
  }
}

export function parseWordPressApiKeyMetadata(metadata: unknown): WordPressApiKeyMetadata | null {
  if (!metadata)
    return null

  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    if (!parsed || typeof parsed !== 'object')
      return null
    return parsed as WordPressApiKeyMetadata
  }
  catch {
    return null
  }
}

export async function generateUniqueOrganizationSlug(db: Database, name: string, excludeOrgId?: string) {
  const fallbackSlug = `org-${Date.now()}`
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40) || fallbackSlug

  let slug = baseSlug
  let suffix = 0

  while (true) {
    const [existing] = await db.query.organization.findMany({
      where: (organization, { eq }) => eq(organization.slug, slug),
      limit: 1
    })

    if (!existing || existing.id === excludeOrgId)
      return slug

    suffix++
    slug = `${baseSlug}-${suffix}`
  }
}

export async function getWordPressConnectionMap(db: Database, organizationIds: string[]) {
  const ids = new Set(organizationIds)
  const keys = await db.select().from(apiKey)
  const connectionMap = new Map<string, { siteUrl: string, keyId: string }>()

  for (const key of keys) {
    if (!key.enabled)
      continue

    const metadata = parseWordPressApiKeyMetadata(key.metadata)
    if (!metadata || metadata.source !== 'wordpress' || !metadata.organizationId || !ids.has(metadata.organizationId))
      continue

    if (!connectionMap.has(metadata.organizationId)) {
      connectionMap.set(metadata.organizationId, {
        siteUrl: normalizeWordPressSiteUrl(metadata.siteUrl || metadata.domainName || ''),
        keyId: key.id
      })
    }
  }

  return connectionMap
}

export async function getUserConnectableWordPressOrganizations(db: Database, userId: string, siteUrl?: string) {
  const normalizedSiteUrl = normalizeWordPressSiteUrl(siteUrl)
  const memberships = await db.query.member.findMany({
    where: eq(member.userId, userId),
    with: { organization: true }
  })

  const eligibleMemberships = memberships.filter(m => ['owner', 'admin'].includes(m.role))
  const organizationIds = eligibleMemberships.map(m => m.organizationId)
  const connectionMap = await getWordPressConnectionMap(db, organizationIds)

  return eligibleMemberships.map((membership) => {
    const org = membership.organization
    const connection = connectionMap.get(org.id)
    const connectedSiteUrl = connection?.siteUrl || ''
    const isConnectedToCurrentSite = !!connectedSiteUrl && connectedSiteUrl === normalizedSiteUrl
    const canConnect = !connection || isConnectedToCurrentSite

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: membership.role,
      pricePerSq: org.pricePerSq ?? 350,
      timezone: org.timezone ?? 'America/New_York',
      isConnectedToWordPress: !!connection,
      isConnectedToCurrentSite,
      connectedSiteUrl,
      canConnect
    }
  })
}

export async function assertUserCanManageWordPressOrganization(db: Database, userId: string, organizationId: string) {
  const membershipRecord = await db.query.member.findFirst({
    where: (membership, { and, eq }) => and(
      eq(membership.userId, userId),
      eq(membership.organizationId, organizationId)
    ),
    with: { organization: true }
  })

  if (!membershipRecord) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  if (!['owner', 'admin'].includes(membershipRecord.role)) {
    throw createError({ statusCode: 403, message: 'Only owners and admins can connect WordPress' })
  }

  return membershipRecord
}

export async function assertWordPressOrganizationConnectionAvailable(db: Database, organizationId: string, siteUrl?: string) {
  const normalizedSiteUrl = normalizeWordPressSiteUrl(siteUrl)
  const connectionMap = await getWordPressConnectionMap(db, [organizationId])
  const existingConnection = connectionMap.get(organizationId)

  if (existingConnection && existingConnection.siteUrl && existingConnection.siteUrl !== normalizedSiteUrl) {
    throw createError({
      statusCode: 409,
      message: `This organization is already connected to another WordPress site (${existingConnection.siteUrl}).`
    })
  }

  return existingConnection
}

export async function rotateWordPressApiKey(db: Database, userId: string, organizationId: string, organizationName: string, siteUrl?: string) {
  const normalizedSiteUrl = normalizeWordPressSiteUrl(siteUrl)
  const existingKeys = await db.select().from(apiKey)

  for (const key of existingKeys) {
    const metadata = parseWordPressApiKeyMetadata(key.metadata)
    if (metadata?.source === 'wordpress' && metadata.organizationId === organizationId) {
      await db.delete(apiKey).where(eq(apiKey.id, key.id))
    }
  }

  const rawKey = `wp_${randomBytes(24).toString('base64url')}`
  const hashedKey = createHash('sha256').update(rawKey).digest('hex')

  await db.insert(apiKey).values({
    id: uuidv7(),
    name: `WordPress - ${organizationName}`,
    start: rawKey.substring(0, 8),
    prefix: 'wp',
    key: hashedKey,
    userId,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: JSON.stringify({
      source: 'wordpress',
      organizationId,
      siteUrl: normalizedSiteUrl,
      domainName: normalizedSiteUrl
    })
  })

  return rawKey
}
