import type { Connection } from 'mongoose'

import { allModels } from './models'

/**
 * Idempotent: creates each collection when missing and makes its indexes match
 * the Mongoose schema (`syncIndexes` also drops indexes removed from the schema).
 */
export async function ensureIndexes(conn: Connection) {
  for (const model of allModels(conn)) {
    await model.createCollection()
    await model.syncIndexes()
  }
}
