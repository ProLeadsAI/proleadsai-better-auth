import { and, eq } from 'drizzle-orm'
import { member as memberTable } from '~~/server/db/schema'
import { getAuthSession } from '~~/server/utils/auth'
import { getCreditBalance } from '~~/server/utils/credits'
import { useDB } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const organizationId = query.organizationId as string

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

  return getCreditBalance(organizationId)
})
