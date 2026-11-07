import { createRefreshTokenRepositoryMongo } from '~/modules/auth/repository.mongo'
import { createTodoRepositoryMongo } from '~/modules/todo/repository.mongo'
import { createUserRepositoryMongo } from '~/modules/users/repository.mongo'
import type { Database } from '../../repositories'
import { createConnection } from './client'
import { ensureIndexes } from './ensure-indexes'
import type { MongoEnv } from './env'

export async function connect(env: MongoEnv): Promise<Database> {
  const conn = await createConnection(env)
  await ensureIndexes(conn)
  return {
    repositories: {
      users: createUserRepositoryMongo(conn),
      todos: createTodoRepositoryMongo(conn),
      refreshTokens: createRefreshTokenRepositoryMongo(conn),
    },
    close: () => conn.close(),
  }
}
