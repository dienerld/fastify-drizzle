import { afterAll } from 'vitest'

import type { Database } from '~/infra/repositories'
import { emptyPostgres } from '~/test/db.postgres'
import { describe{{Name}}RepositoryContract } from './repository.contract'

const opened: Database[] = []

describe{{Name}}RepositoryContract(async () => {
  const db = await emptyPostgres()
  opened.push(db)
  return db.repositories
})

afterAll(async () => {
  await Promise.all(opened.map(db => db.close()))
})
