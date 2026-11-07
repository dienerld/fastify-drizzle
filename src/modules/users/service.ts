import { fail, ok, type Result } from '~/utils/result'
import type { NewUser, User, UserRepository } from './repository'

export function createUserService(users: UserRepository) {
  return {
    /** Creates the user, or returns the existing one with the same `externalId`. */
    async createOrGet(
      input: NewUser
    ): Promise<Result<{ user: User; created: boolean }>> {
      const existing = await users.findByExternalId(input.externalId)
      if (existing) return ok({ user: existing, created: false })
      return ok({ user: await users.create(input), created: true })
    },

    /** Finds by external id or internal id. */
    async get(key: string): Promise<Result<User>> {
      const user =
        (await users.findByExternalId(key)) ?? (await users.findById(key))
      if (!user) return fail({ code: 'not_found', message: 'User not found' })
      return ok(user)
    },
  }
}

export type UserService = ReturnType<typeof createUserService>
