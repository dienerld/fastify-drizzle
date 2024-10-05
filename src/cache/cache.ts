import IORedis from 'ioredis'
import { env } from '../env'

export class Cache {
  private client: IORedis

  constructor() {
    this.client = new IORedis(env.REDIS_URL)
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key)
    if (!value) {
      return null
    }
    return JSON.parse(value)
  }

  /**
   * Set a value in the cache
   * @param key The key to set
   * @param value The value to set
   * @param ttl The time to live in seconds
   */
  async set(key: string, value: string, ttl?: number): Promise<string> {
    if (ttl) {
      return this.client.setex(key, ttl, value)
    }
    return this.client.set(key, value)
  }
}
