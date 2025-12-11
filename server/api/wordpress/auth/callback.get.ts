/**
 * WordPress Plugin Integration - Magic Link Callback
 * Handles the magic link verification and returns API key to WordPress
 */

import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { apiKey, member, organization, verification } from '~~/server/db/schema'
import { useServerAuth } from '~~/server/utils/auth'
import { getDB } from '~~/server/utils/db'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || `org-${Date.now()}`
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = query.token as string

  if (!token) {
    throw createError({
      statusCode: 400,
      message: 'Token is required'
    })
  }

  const db = getDB()
  const serverAuth = useServerAuth()

  // Verify the magic link token using Better Auth
  let verifyResult: any
  try {
    verifyResult = await serverAuth.api.magicLinkVerify({
      query: { token }
    })
  } catch (error: any) {
    console.error('Magic link verification failed:', error)
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired magic link'
    })
  }

  // Get the user from the session
  const session = verifyResult?.session
  const verifiedUser = verifyResult?.user || session?.user

  if (!verifiedUser) {
    throw createError({
      statusCode: 400,
      message: 'Failed to verify user'
    })
  }

  // Get WordPress context if stored
  const contextRecord = await db.query.verification.findFirst({
    where: eq(verification.identifier, `wordpress-context:${verifiedUser.email}`)
  })

  let siteUrl = ''
  let name = verifiedUser.name || verifiedUser.email.split('@')[0]

  if (contextRecord) {
    try {
      const context = JSON.parse(contextRecord.value)
      siteUrl = context.siteUrl || ''
      name = context.name || name
    } catch {}
    // Clean up context
    await db.delete(verification).where(eq(verification.id, contextRecord.id))
  }

  // Ensure user has an organization
  const existingMembership = await db.query.member.findFirst({
    where: eq(member.userId, verifiedUser.id),
    with: {
      organization: true
    }
  })

  let orgId: string
  let orgName: string
  let orgSlug: string

  if (existingMembership) {
    orgId = existingMembership.organizationId
    orgName = existingMembership.organization.name
    orgSlug = existingMembership.organization.slug

    // Update domain name if provided
    if (siteUrl && existingMembership.organization.domainName !== siteUrl) {
      await db.update(organization)
        .set({ domainName: siteUrl })
        .where(eq(organization.id, orgId))
    }
  } else {
    // Create organization for user
    let slug = generateSlug(name)

    let slugConflict = await db.query.organization.findFirst({
      where: eq(organization.slug, slug)
    })
    let suffix = 1
    while (slugConflict) {
      slug = `${generateSlug(name)}-${suffix}`
      suffix++
      slugConflict = await db.query.organization.findFirst({
        where: eq(organization.slug, slug)
      })
    }

    orgId = uuidv7()
    orgName = `${name}'s Team`
    orgSlug = slug

    await db.insert(organization).values({
      id: orgId,
      name: orgName,
      slug,
      domainName: siteUrl || null,
      createdAt: new Date(),
      metadata: JSON.stringify({ source: 'wordpress' })
    })

    await db.insert(member).values({
      id: uuidv7(),
      organizationId: orgId,
      userId: verifiedUser.id,
      role: 'owner',
      createdAt: new Date()
    })
  }

  // Generate API key for WordPress
  const rawKey = `wp_${randomBytes(24).toString('base64url')}`
  const hashedKey = createHash('sha256').update(rawKey).digest('hex')
  const keyStart = rawKey.substring(0, 8)

  const apiKeyId = uuidv7()
  const now = new Date()

  await db.insert(apiKey).values({
    id: apiKeyId,
    name: `WordPress - ${orgName}`,
    start: keyStart,
    prefix: 'wp',
    key: hashedKey,
    userId: verifiedUser.id,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    metadata: JSON.stringify({
      source: 'wordpress',
      organizationId: orgId,
      domainName: siteUrl
    })
  })

  // Return HTML page that posts data back to WordPress
  const responseData = {
    success: true,
    apiKey: rawKey,
    user: {
      id: verifiedUser.id,
      email: verifiedUser.email,
      name: verifiedUser.name
    },
    team: {
      id: orgId,
      name: orgName,
      slug: orgSlug
    }
  }

  // Return a page that can communicate with the WordPress plugin
  setResponseHeader(event, 'Content-Type', 'text/html')

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Verification Complete</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f3f4f6;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }
    h1 { color: #10b981; margin-bottom: 1rem; }
    p { color: #6b7280; }
    .success-icon {
      font-size: 48px;
      margin-bottom: 1rem;
    }
    code {
      display: block;
      background: #f3f4f6;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      word-break: break-all;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✓</div>
    <h1>Verification Complete!</h1>
    <p>Your WordPress plugin has been connected successfully.</p>
    <p>You can close this window and return to WordPress.</p>
    <p style="font-size: 12px; color: #9ca3af;">Your API key has been generated. Copy it if needed:</p>
    <code id="apiKey">${rawKey}</code>
    <p style="font-size: 12px; color: #9ca3af;">Team ID: ${orgId}</p>
  </div>
  <script>
    // Try to communicate with opener window (WordPress admin)
    const data = ${JSON.stringify(responseData)};
    if (window.opener) {
      window.opener.postMessage({ type: 'wordpress-auth-success', data }, '*');
    }
    // Also store in localStorage for the plugin to read
    try {
      localStorage.setItem('proleadsai_auth_result', JSON.stringify(data));
    } catch(e) {}
  </script>
</body>
</html>
  `
})
