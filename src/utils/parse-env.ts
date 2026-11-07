import type { z } from 'zod'

/** Validates `source` against `schema`; throws one readable error listing all issues. */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env
): z.output<T> {
  const parsed = schema.safeParse(source)
  if (parsed.success) return parsed.data
  const issues = parsed.error.issues
    .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment variables:\n${issues}`)
}
