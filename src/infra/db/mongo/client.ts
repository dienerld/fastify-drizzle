import mongoose, { type Connection } from 'mongoose'

import type { MongoEnv } from './env'

/**
 * Dedicated connection (not the global `mongoose.connect`), so closing and
 * tests stay clean. Indexes/collections are created explicitly by
 * `ensureIndexes`, not lazily by Mongoose.
 */
export async function createConnection(env: MongoEnv): Promise<Connection> {
  return mongoose
    .createConnection(env.uri, {
      dbName: env.dbName,
      autoIndex: false,
      autoCreate: false,
    })
    .asPromise()
}
