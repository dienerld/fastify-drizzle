import z from 'zod'

const envSchema = z.object({
  HOST: z.string(),
  PORT: z.coerce.number().int().min(0).max(65535),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string(),
  REDIS_URL: z.string().url(),
  CORS: z.string().transform(cors => cors.split(',').map(cors => cors.trim())),
  ACCESS_KEY: z.string(),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  JWT_EXPIRATION: z.string().optional(),
})

export const env = envSchema.parse(process.env)
