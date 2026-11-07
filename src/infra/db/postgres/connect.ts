import { createTodoRepositoryPostgres } from '~/modules/todo/repository.postgres'
import { createUserRepositoryPostgres } from '~/modules/users/repository.postgres'
import type { Database } from '../../repositories'
import { createClient } from './client'
import type { PostgresEnv } from './env'

export async function connect(env: PostgresEnv): Promise<Database> {
  const { sql, db } = createClient(env)
  await sql`select 1` // fail fast when the database is unreachable
  return {
    repositories: {
      users: createUserRepositoryPostgres(db),
      todos: createTodoRepositoryPostgres(db),
    },
    close: () => sql.end({ timeout: 5 }),
  }
}
