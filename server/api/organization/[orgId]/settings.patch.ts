import { eq } from 'drizzle-orm'
import { organization } from '~~/server/db/schema'
import { requireOrgMembership } from '~~/server/utils/organization'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  const { db, membership } = await requireOrgMembership(event, orgId)

  // Only owners and admins can update settings
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Only owners and admins can update settings' })
  }

  const body = await readBody(event)

  // Build update object with only provided fields
  const updateData: Record<string, any> = {}

  if (body.pricePerSq !== undefined) {
    updateData.pricePerSq = Number(body.pricePerSq)
  }
  if (body.domainName !== undefined) {
    updateData.domainName = body.domainName || null
  }
  if (body.googleMapsApiKey !== undefined) {
    updateData.googleMapsApiKey = body.googleMapsApiKey || null
  }
  if (body.googleSolarApiKey !== undefined) {
    updateData.googleSolarApiKey = body.googleSolarApiKey || null
  }
  if (body.timezone !== undefined) {
    updateData.timezone = body.timezone || null
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  const [updated] = await db.update(organization)
    .set(updateData)
    .where(eq(organization.id, orgId))
    .returning()

  return {
    pricePerSq: updated.pricePerSq,
    domainName: updated.domainName,
    googleMapsApiKey: updated.googleMapsApiKey,
    googleSolarApiKey: updated.googleSolarApiKey,
    timezone: updated.timezone
  }
})
