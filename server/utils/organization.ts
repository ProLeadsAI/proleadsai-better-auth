import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { member as memberTable, organization as organizationTable } from '../database/schema'
import { getAuthSession } from './auth'
import { useDB } from './db'

/**
 * Verify that the current user is a member of the specified organization
 * Returns the organization and user session if valid
 */
export async function requireOrgMembership(event: H3Event, orgId: string) {
  const session = await getAuthSession(event)

  if (!session || !session.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  const db = await useDB(event)

  // Verify membership
  const membership = await db.query.member.findFirst({
    where: and(
      eq(memberTable.userId, session.user.id),
      eq(memberTable.organizationId, orgId)
    )
  })

  if (!membership) {
    throw createError({
      statusCode: 403,
      message: 'You are not a member of this organization'
    })
  }

  // Get organization
  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.id, orgId)
  })

  if (!org) {
    throw createError({
      statusCode: 404,
      message: 'Organization not found'
    })
  }

  return {
    session,
    user: session.user,
    organization: org,
    membership,
    db
  }
}
