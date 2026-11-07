import { z } from 'zod'

import { parseDuration } from '~/utils/duration'
import { parseEnv } from '~/utils/parse-env'
import type { RefreshTokenRepository } from './repository'

const duration = z
  .string()
  .regex(/^\d+[smhd]$/, 'use a number and a unit: 30s, 15m, 12h or 30d')

const schema = z.object({
  /** How long a revoked/rotated token is kept (reuse detection needs it). */
  REFRESH_TOKEN_RETENTION: duration.default('1d'),
  /** Period of the in-process cleanup; `0s` turns it off. */
  TOKEN_CLEANUP_INTERVAL: duration.default('1h'),
})

export type CleanupConfig = {
  retentionSeconds: number
  /** 0 = the in-process cleanup is disabled. */
  intervalSeconds: number
}

/** Own env loader so `pnpm tokens:cleanup` does not need the app's secrets. */
export function loadCleanupConfig(
  source: NodeJS.ProcessEnv = process.env
): CleanupConfig {
  const e = parseEnv(schema, source)
  return {
    retentionSeconds: parseDuration(e.REFRESH_TOKEN_RETENTION),
    intervalSeconds: parseDuration(e.TOKEN_CLEANUP_INTERVAL),
  }
}

/**
 * One cleanup pass. Deletes tokens already expired (an expired token is
 * answered with 401 before anything else, so keeping it has no use) and tokens
 * revoked longer than `retentionSeconds` ago. Returns how many were deleted.
 */
export function cleanupRefreshTokens(
  refreshTokens: RefreshTokenRepository,
  retentionSeconds: number,
  now = new Date()
): Promise<number> {
  return refreshTokens.deleteExpired({
    expiredBefore: now,
    revokedBefore: new Date(now.getTime() - retentionSeconds * 1000),
  })
}

type Logger = {
  info: (obj: object, msg: string) => void
  error: (err: unknown, msg: string) => void
}

/**
 * Runs `cleanupRefreshTokens` every `intervalSeconds` inside the process.
 * The timer is `unref`ed (it never keeps the process alive) and passes never
 * overlap or throw. Call `stop()` on shutdown. Returns `undefined` when the
 * interval is 0 (disabled).
 */
export function startRefreshTokenCleanup(opts: {
  refreshTokens: RefreshTokenRepository
  config: CleanupConfig
  log: Logger
}): { stop: () => void } | undefined {
  const { refreshTokens, config, log } = opts
  if (config.intervalSeconds <= 0) return undefined

  let running = false
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      const deleted = await cleanupRefreshTokens(
        refreshTokens,
        config.retentionSeconds
      )
      if (deleted > 0) log.info({ deleted }, 'refresh tokens cleaned up')
    } catch (err) {
      log.error(err, 'refresh token cleanup failed')
    } finally {
      running = false
    }
  }, config.intervalSeconds * 1000)
  timer.unref()

  return { stop: () => clearInterval(timer) }
}
