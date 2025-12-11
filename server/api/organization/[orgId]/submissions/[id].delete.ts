import { and, eq } from 'drizzle-orm'
import { submissions } from '~~/server/db/schema'
import { requireOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const submissionId = getRouterParam(event, 'id')

  if (!orgId || !submissionId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Submission ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)

  // Verify submission exists and belongs to org
  const existing = await db.query.submissions.findFirst({
    where: and(
      eq(submissions.id, submissionId),
      eq(submissions.organizationId, orgId)
    )
  })

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Submission not found' })
  }

  await db.delete(submissions)
    .where(and(
      eq(submissions.id, submissionId),
      eq(submissions.organizationId, orgId)
    ))

  return { success: true }
})
