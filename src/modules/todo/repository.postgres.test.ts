import { afterAll } from 'vitest'

import type { Database } from '~/infra/repositories'
import { emptyPostgres } from '~/test/db.postgres'
import { describeTodoRepositoryContract } from './repository.contract'

const opened: Database[] = []

describeTodoRepositoryContract(async () => {
  const db = await emptyPostgres()
  opened.push(db)
  return db.repositories.todos
})

afterAll(async () => {
  await Promise.all(opened.map(db => db.close()))
})
