import { afterAll } from 'vitest'

import type { Database } from '~/infra/repositories'
import { emptyPostgres } from '~/test/db.postgres'
import { describeUserRepositoryContract } from './repository.contract'

const opened: Database[] = []

describeUserRepositoryContract(async () => {
  const db = await emptyPostgres()
  opened.push(db)
  return db.repositories.users
})

afterAll(async () => {
  await Promise.all(opened.map(db => db.close()))
})
