import type { HubKV } from '@nuxthub/core'

declare global {
  const hubKV: () => HubKV
}

declare module 'hub:kv' {
  export const kv: HubKV
}

export {}
