import { and, desc, eq, lt } from 'drizzle-orm'
import { creditActivity, member as memberTable } from '~~/server/db/schema'
import { getAuthSession } from '~~/server/utils/auth'
import { useDB } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const organizationId = query.organizationId as string
  const limit = Math.min(Number(query.limit) || 50, 100)
  const cursor = query.cursor as string | undefined

  if (!organizationId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing organizationId' })
  }

  const db = await useDB()

  // Verify membership
  const memberRecord = await db.query.member.findFirst({
    where: and(
      eq(memberTable.organizationId, organizationId),
      eq(memberTable.userId, session.user.id)
    )
  })

  if (!memberRecord) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Build query conditions
  const conditions = [eq(creditActivity.organizationId, organizationId)]

  // Cursor-based pagination: fetch items older than the cursor timestamp
  if (cursor) {
    conditions.push(lt(creditActivity.createdAt, new Date(cursor)))
  }

  const activities = await db.query.creditActivity.findMany({
    where: and(...conditions),
    orderBy: [desc(creditActivity.createdAt)],
    limit: limit + 1
  })

  const hasMore = activities.length > limit
  const items = hasMore ? activities.slice(0, limit) : activities

  return {
    items: items.map(a => ({
      id: a.id,
      action: a.action,
      creditsCost: a.creditsCost,
      description: a.description,
      metadata: a.metadata,
      createdAt: a.createdAt
    })),
    hasMore,
    nextCursor: hasMore && items.length > 0
      ? items[items.length - 1]!.createdAt.toISOString()
      : null
  }
})
