import { and, eq } from 'drizzle-orm'
import { submissions } from '../../../../database/schema'
import { requireOrgMembership } from '../../../../utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const submissionId = getRouterParam(event, 'id')

  if (!orgId || !submissionId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Submission ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)

  const submission = await db.query.submissions.findFirst({
    where: and(
      eq(submissions.id, submissionId),
      eq(submissions.organizationId, orgId)
    ),
    with: {
      addresses: true
    }
  })

  if (!submission) {
    throw createError({ statusCode: 404, message: 'Submission not found' })
  }

  return submission
})
