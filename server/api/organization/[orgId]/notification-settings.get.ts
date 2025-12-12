import { eq } from 'drizzle-orm'
import { organization } from '~~/server/db/schema'
import { requireOrgMembership } from '~~/server/utils/organization'

// Default notification settings structure
const defaultSettings = {
  newLeads: {
    enabled: false,
    roles: ['owner', 'admin'] as string[]
  }
}

export type NotificationSettings = typeof defaultSettings

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const { db } = await requireOrgMembership(event, orgId)

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId)
  })

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Parse stored settings or use defaults
  let settings: NotificationSettings = defaultSettings
  if (org.notificationSettings) {
    try {
      const parsed = JSON.parse(org.notificationSettings)
      settings = { ...defaultSettings, ...parsed }
    } catch {
      // Invalid JSON, use defaults
    }
  }

  return settings
})
