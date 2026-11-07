import type { Connection } from 'mongoose'

import { todoModel } from '~/modules/todo/schema.mongo'
import { userModel } from '~/modules/users/schema.mongo'

// Aggregates every module model so boot/`db:indexes` can sync them all.
export const allModels = (conn: Connection) => [
  userModel(conn),
  todoModel(conn),
]
