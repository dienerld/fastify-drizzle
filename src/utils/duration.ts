const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const

/** `'15m'` -> 900. Accepts `<number><s|m|h|d>` (validated in `env.ts`). */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value)
  if (!match) throw new Error(`Invalid duration: ${value}`)
  return Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS]
}
