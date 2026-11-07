import { afterAll } from 'vitest'

import type { Database } from '~/infra/repositories'
import { emptyPostgres } from '~/test/db.postgres'
import { describeRefreshTokenRepositoryContract } from './repository.contract'

const opened: Database[] = []

describeRefreshTokenRepositoryContract(async () => {
  const db = await emptyPostgres()
  opened.push(db)
  return db.repositories
})

afterAll(async () => {
  await Promise.all(opened.map(db => db.close()))
})
