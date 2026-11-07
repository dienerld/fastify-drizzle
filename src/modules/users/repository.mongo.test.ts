import { afterAll } from 'vitest'

import type { Database } from '~/infra/repositories'
import { emptyMongo } from '~/test/db.mongo'
import { describeUserRepositoryContract } from './repository.contract'

const opened: Database[] = []

describeUserRepositoryContract(async () => {
  const db = await emptyMongo()
  opened.push(db)
  return db.repositories.users
})

afterAll(async () => {
  await Promise.all(opened.map(db => db.close()))
})
