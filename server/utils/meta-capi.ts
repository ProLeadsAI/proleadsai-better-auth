import crypto from 'node:crypto'

const sha256 = (value?: string) =>
  value ? crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex') : undefined

export async function sendMetaCompleteRegistration(params: {
  pixelId: string
  accessToken: string
  eventId: string
  eventSourceUrl: string
  email?: string
  phone?: string
  externalId?: string
  clientIpAddress?: string
  clientUserAgent?: string
  fbp?: string
  fbc?: string
  testEventCode?: string
}) {
  const body = {
    data: [
      {
        event_name: 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: params.eventId,
        event_source_url: params.eventSourceUrl,
        user_data: {
          em: params.email ? [sha256(params.email)] : undefined,
          ph: params.phone ? [sha256(params.phone)] : undefined,
          external_id: params.externalId ? [sha256(params.externalId)] : undefined,
          client_ip_address: params.clientIpAddress,
          client_user_agent: params.clientUserAgent,
          fbp: params.fbp,
          fbc: params.fbc
        },
        custom_data: {
          content_name: 'account_confirmation',
          status: 'confirmed'
        }
      }
    ],
    test_event_code: params.testEventCode || undefined
  }

  return await $fetch(`https://graph.facebook.com/v23.0/${params.pixelId}/events`, {
    method: 'POST',
    query: {
      access_token: params.accessToken
    },
    body
  })
}
