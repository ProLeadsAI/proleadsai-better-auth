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

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  // Require admin or owner role to update notification settings
  const { db, membership, organization: org } = await requireOrgMembership(event, orgId)

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Only owners and admins can update notification settings' })
  }

  const body = await readBody(event)

  // Parse existing settings or use defaults
  let currentSettings = { ...defaultSettings }
  if (org.notificationSettings) {
    try {
      const parsed = JSON.parse(org.notificationSettings)
      currentSettings = { ...defaultSettings, ...parsed }
    } catch {
      // Invalid JSON, use defaults
    }
  }

  // Merge new settings with existing
  const newSettings = {
    ...currentSettings,
    ...body
  }

  await db.update(organization)
    .set({ notificationSettings: JSON.stringify(newSettings) })
    .where(eq(organization.id, orgId))

  return { success: true, settings: newSettings }
})
