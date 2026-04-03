/**
 * Server-side only endpoint that fetches ALL organization data
 * Queries database directly - NO HTTP calls, NO Better Auth API calls
 */

import { and, eq, like } from 'drizzle-orm'
import { apiKey as apiKeyTable, organization as organizationTable, subscription as subscriptionTable } from '~~/server/db/schema'
import { getAuthSession } from '~~/server/utils/auth'
import { useDB } from '~~/server/utils/db'
import { normalizeWordPressSiteUrl, parseWordPressApiKeyMetadata } from '~~/server/utils/wordpress'

export default defineEventHandler(async (event) => {
  try {
    const db = await useDB()

    // Use Better Auth's official session retrieval
    // This handles cookie parsing, signature verification, and caching automatically
    const session = await getAuthSession(event)

    if (!session || !session.user) {
      throw createError({
        statusCode: 401,
        message: 'Invalid session'
      })
    }

    console.log('Session found:', { userId: session.user.id, activeOrgId: (session.session as any).activeOrganizationId })

    const activeOrgId = (session.session as any).activeOrganizationId

    if (!activeOrgId) {
      // If no active org, just return user data (e.g. for onboarding)
      return {
        organization: null,
        subscriptions: [],
        needsUpgrade: false,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name
        }
      }
    }

    // Fetch organization with all relations in a single database query
    const org = await db.query.organization.findFirst({
      where: eq(organizationTable.id, activeOrgId),
      with: {
        members: {
          with: {
            user: true
          }
        },
        invitations: true
      }
    })

    if (!org) {
      throw createError({
        statusCode: 404,
        message: 'Organization not found'
      })
    }

    // Verify that the current user is a member of this organization
    const isMember = org.members.some((m: any) => m.userId === session.user.id)
    if (!isMember) {
      console.warn(`User ${session.user.id} attempted to access org ${activeOrgId} without membership`)
      throw createError({
        statusCode: 403,
        message: 'You are not a member of this organization'
      })
    }

    // Fetch subscriptions for this organization
    const subscriptions = await db.query.subscription.findMany({
      where: eq(subscriptionTable.referenceId, activeOrgId)
    })

    // Detect integrations
    const candidateKeys = await db.select().from(apiKeyTable).where(
      and(
        like(apiKeyTable.metadata, `%${activeOrgId}%`),
        like(apiKeyTable.metadata, '%wordpress%')
      )
    )

    let wordpressUrl = normalizeWordPressSiteUrl(org.domainName || '')
    const hasWordPressIntegration = candidateKeys.some((k: any) => {
      const meta = parseWordPressApiKeyMetadata(k.metadata)
      const isMatch = meta?.source === 'wordpress' && meta?.organizationId === activeOrgId
      if (isMatch && !wordpressUrl)
        wordpressUrl = normalizeWordPressSiteUrl(meta?.siteUrl || meta?.domainName || '')
      return isMatch
    })

    if (hasWordPressIntegration && wordpressUrl && wordpressUrl !== (org.domainName || '')) {
      await db.update(organizationTable)
        .set({ domainName: wordpressUrl })
        .where(eq(organizationTable.id, activeOrgId))
      org.domainName = wordpressUrl
    }

    return {
      organization: {
        ...org,
        integrations: {
          wordpress: {
            connected: hasWordPressIntegration,
            url: wordpressUrl || null
          }
        }
      },
      subscriptions: subscriptions || [],
      needsUpgrade: false,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      }
    }
  } catch (error: any) {
    console.error('Error fetching full organization data:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch organization data'
    })
  }
})
