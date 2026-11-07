import { z } from 'zod'

import { parseDuration } from '~/utils/duration'

const duration = z
  .string()
  .regex(/^\d+[smhd]$/, 'use a number and a unit: 30s, 15m, 12h or 30d')

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // http
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3333),
  CORS: z
    .string()
    .default('*')
    .transform(value => value.split(',').map(origin => origin.trim())),
  // Behind a proxy/load balancer: `true`, a hop count (`1`) or IPs/CIDRs.
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value): boolean | number | string => {
      if (value === 'true') return true
      if (value === 'false') return false
      return /^\d+$/.test(value) ? Number(value) : value
    }),

  // rate limit (per IP; /auth/* has its own, stricter budget)
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_WINDOW: duration.default('1m'),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_AUTH_WINDOW: duration.default('1m'),

  // auth
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: duration.default('15m'),
  REFRESH_TOKEN_TTL: duration.default('30d'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  ALLOWED_EMAILS: z
    .string()
    .optional()
    .transform(value =>
      (value ?? '')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean)
    ),
})

function loadEnv() {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    console.error(`Invalid environment variables:\n${issues}`)
    process.exit(1)
  }

  const e = parsed.data
  return {
    nodeEnv: e.NODE_ENV,
    http: {
      host: e.HOST,
      port: e.PORT,
      cors: e.CORS,
      trustProxy: e.TRUST_PROXY,
      rateLimit: {
        max: e.RATE_LIMIT_MAX,
        windowMs: parseDuration(e.RATE_LIMIT_WINDOW) * 1000,
        authMax: e.RATE_LIMIT_AUTH_MAX,
        authWindowMs: parseDuration(e.RATE_LIMIT_AUTH_WINDOW) * 1000,
      },
    },
    auth: {
      jwtSecret: e.JWT_SECRET,
      accessTokenTtlSeconds: parseDuration(e.ACCESS_TOKEN_TTL),
      refreshTokenTtlSeconds: parseDuration(e.REFRESH_TOKEN_TTL),
      googleClientId: e.GOOGLE_CLIENT_ID,
      /** Empty means "everyone with a verified Google account". */
      allowedEmails: e.ALLOWED_EMAILS,
    },
  }
}

export const env = loadEnv()
