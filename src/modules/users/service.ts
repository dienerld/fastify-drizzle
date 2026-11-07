import { fail, ok, type Result } from '~/utils/result'
import type { User, UserRepository } from './repository'

export function createUserService(users: UserRepository) {
  return {
    /** The authenticated user's own record (never looked up from request input). */
    async me(userId: string): Promise<Result<User>> {
      const user = await users.findById(userId)
      return user
        ? ok(user)
        : fail({ code: 'not_found', message: 'User not found' })
    },
  }
}

export type UserService = ReturnType<typeof createUserService>
