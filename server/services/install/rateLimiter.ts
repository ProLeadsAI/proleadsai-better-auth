import { cacheClient } from '~~/server/utils/drivers'

export class InstallEmailRateLimiter {
  constructor(private readonly windowSeconds: number) {}

  private getKey(userId: string) {
    return `install_email_rate_limit:${userId}`
  }

  async checkAndLock(userId: string) {
    const key = this.getKey(userId)
    const existing = await cacheClient.get(key)

    if (existing) {
      return {
        allowed: false,
        retryAfterSeconds: this.windowSeconds
      }
    }

    await cacheClient.set(key, Date.now().toString(), this.windowSeconds)

    return {
      allowed: true,
      retryAfterSeconds: 0
    }
  }
}
