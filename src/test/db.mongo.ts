import { connect } from '~/infra/db/mongo'
import { createConnection } from '~/infra/db/mongo/client'
import { loadEnv } from '~/infra/db/mongo/env'
import { allModels } from '~/infra/db/mongo/models'

/** Connects to the test database (boot syncs indexes) and empties every collection. */
export async function emptyMongo() {
  const env = loadEnv()
  const database = await connect(env)
  const conn = await createConnection(env)
  try {
    allModels(conn) // registers the models on the connection
    for (const model of Object.values(conn.models)) await model.deleteMany({})
  } finally {
    await conn.close()
  }
  return database
}
