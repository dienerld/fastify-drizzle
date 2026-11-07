import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cleanupRefreshTokens,
  loadCleanupConfig,
  startRefreshTokenCleanup,
} from './cleanup'
import type { RefreshTokenRepository } from './repository'

const repo = (deleteExpired = vi.fn().mockResolvedValue(0)) =>
  ({ deleteExpired }) as unknown as RefreshTokenRepository & {
    deleteExpired: typeof deleteExpired
  }

const log = () => ({ info: vi.fn(), error: vi.fn() })

describe('loadCleanupConfig', () => {
  it('defaults to 1d retention and an hourly pass', () => {
    expect(loadCleanupConfig({})).toEqual({
      retentionSeconds: 86_400,
      intervalSeconds: 3600,
    })
  })

  it('reads durations from the env and rejects bad ones', () => {
    expect(
      loadCleanupConfig({
        REFRESH_TOKEN_RETENTION: '2d',
        TOKEN_CLEANUP_INTERVAL: '0s',
      })
    ).toEqual({ retentionSeconds: 172_800, intervalSeconds: 0 })
    expect(() => loadCleanupConfig({ TOKEN_CLEANUP_INTERVAL: 'soon' })).toThrow(
      /TOKEN_CLEANUP_INTERVAL/
    )
  })
})

describe('cleanupRefreshTokens', () => {
  it('expires now and keeps revoked tokens for the retention period', async () => {
    const r = repo()
    const now = new Date('2026-01-10T00:00:00Z')
    await cleanupRefreshTokens(r, 86_400, now)
    expect(r.deleteExpired).toHaveBeenCalledWith({
      expiredBefore: now,
      revokedBefore: new Date('2026-01-09T00:00:00Z'),
    })
  })
})

describe('startRefreshTokenCleanup', () => {
  afterEach(() => vi.useRealTimers())

  const config = { retentionSeconds: 86_400, intervalSeconds: 60 }

  it('runs every interval until stopped', async () => {
    vi.useFakeTimers()
    const r = repo(vi.fn().mockResolvedValue(3))
    const l = log()
    const job = startRefreshTokenCleanup({ refreshTokens: r, config, log: l })

    await vi.advanceTimersByTimeAsync(60_000)
    expect(r.deleteExpired).toHaveBeenCalledTimes(1)
    expect(l.info).toHaveBeenCalledWith(
      { deleted: 3 },
      'refresh tokens cleaned up'
    )
    await vi.advanceTimersByTimeAsync(60_000)
    expect(r.deleteExpired).toHaveBeenCalledTimes(2)

    job?.stop()
    await vi.advanceTimersByTimeAsync(300_000)
    expect(r.deleteExpired).toHaveBeenCalledTimes(2)
  })

  it('is disabled with a 0 interval', () => {
    const job = startRefreshTokenCleanup({
      refreshTokens: repo(),
      config: { ...config, intervalSeconds: 0 },
      log: log(),
    })
    expect(job).toBeUndefined()
  })

  it('logs a failing pass and keeps going', async () => {
    vi.useFakeTimers()
    const deleteExpired = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(0)
    const l = log()
    const job = startRefreshTokenCleanup({
      refreshTokens: repo(deleteExpired),
      config,
      log: l,
    })
    await vi.advanceTimersByTimeAsync(120_000)
    expect(l.error).toHaveBeenCalledTimes(1)
    expect(deleteExpired).toHaveBeenCalledTimes(2)
    job?.stop()
  })

  it('does not overlap passes', async () => {
    vi.useFakeTimers()
    let release = () => {}
    const deleteExpired = vi.fn(
      () => new Promise<number>(resolve => (release = () => resolve(0)))
    )
    const job = startRefreshTokenCleanup({
      refreshTokens: repo(deleteExpired),
      config,
      log: log(),
    })
    await vi.advanceTimersByTimeAsync(180_000) // 3 ticks, first never ends
    expect(deleteExpired).toHaveBeenCalledTimes(1)
    release()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(deleteExpired).toHaveBeenCalledTimes(2)
    job?.stop()
  })
})
