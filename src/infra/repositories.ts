import type { RefreshTokenRepository } from '~/modules/auth/repository'
import type { TodoRepository } from '~/modules/todo/repository'
import type { UserRepository } from '~/modules/users/repository'

/** Every repository the app needs. Each database folder implements all of them. */
export type Repositories = {
  users: UserRepository
  todos: TodoRepository
  refreshTokens: RefreshTokenRepository
}

/** What `connect()` of each database folder returns. */
export type Database = {
  repositories: Repositories
  close: () => Promise<void>
}
