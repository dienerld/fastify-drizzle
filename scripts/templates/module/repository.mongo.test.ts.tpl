import { afterAll } from 'vitest'

import type { Database } from '~/infra/repositories'
import { emptyMongo } from '~/test/db.mongo'
import { describe{{Name}}RepositoryContract } from './repository.contract'

const opened: Database[] = []

describe{{Name}}RepositoryContract(async () => {
  const db = await emptyMongo()
  opened.push(db)
  return db.repositories
})

afterAll(async () => {
  await Promise.all(opened.map(db => db.close()))
})
