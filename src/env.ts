import z from 'zod'

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

  // auth
  SESSION_SECRET: z.string().min(32),
  ACCESS_KEY: z.string().min(1),
  JWT_EXPIRATION: z.string().optional(),

  // db
  DATABASE_URL: z.string().url(),

  // legacy: only used by src/cache/cache.ts (removed in phase 3)
  REDIS_URL: z.string().url().optional(),
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
    http: { host: e.HOST, port: e.PORT, cors: e.CORS },
    auth: {
      sessionSecret: e.SESSION_SECRET,
      accessKey: e.ACCESS_KEY,
      jwtExpiration: e.JWT_EXPIRATION,
    },
    db: { url: e.DATABASE_URL },
    redis: { url: e.REDIS_URL },
  }
}

export const env = loadEnv()
