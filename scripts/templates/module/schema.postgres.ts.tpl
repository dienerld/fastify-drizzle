import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from '~/modules/users/schema.postgres'

export const {{pluralCamel}} = pgTable(
  '{{pluralSnake}}',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  t => [index('{{pluralSnake}}_user_id_created_at_idx').on(t.userId, t.createdAt)]
)

export type {{Name}}Row = typeof {{pluralCamel}}.$inferSelect
