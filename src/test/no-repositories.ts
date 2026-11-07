import type { Repositories } from '~/infra/repositories'

const unusable = (repo: string) =>
  new Proxy(
    {},
    {
      get(_, method) {
        throw new Error(`${repo}.${String(method)} used in a test without a DB`)
      },
    }
  )

/** For HTTP tests that never reach a repository: calling one fails loudly. */
export const noRepositories = {
  users: unusable('users'),
  todos: unusable('todos'),
  refreshTokens: unusable('refreshTokens'),
} as Repositories

/**
 * Like `noRepositories`, but every refresh token is unknown (401 on refresh):
 * lets HTTP tests exercise `/auth/refresh` and `/auth/logout` without a DB.
 */
export const unknownTokens = {
  ...noRepositories,
  refreshTokens: { findByHash: async () => null },
} as unknown as Repositories
