import { fileURLToPath } from 'node:url'

import { createConnection } from './client'
import { ensureIndexes } from './ensure-indexes'
import { loadEnv } from './env'

// `pnpm db:indexes`: same as what `connect()` does at boot, standalone.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const conn = await createConnection(loadEnv())
  try {
    await ensureIndexes(conn)
    console.log('mongo: collections and indexes in sync')
  } finally {
    await conn.close()
  }
}
