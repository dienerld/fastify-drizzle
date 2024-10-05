import z from 'zod'

const envSchema = z.object({
  HOST: z.string(),
  PORT: z.coerce.number().int().min(0).max(65535),
  DATABASE_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string(),
  SESSION_SECRET: z.string(),
  REDIS_URL: z.string().url(),
  CORS: z.string().transform(cors => cors.split(',').map(cors => cors.trim())),
})

export const env = envSchema.parse(process.env)
