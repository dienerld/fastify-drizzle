export type {{Name}} = {
  id: string
  userId: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export type New{{Name}} = {
  name: string
  description?: string | null
}

export type {{Name}}Patch = Partial<New{{Name}}>

/**
 * Every method is scoped by `userId`: a {{words}} that belongs to someone else is
 * indistinguishable from a missing one (`null` / `false`), so it can never leak.
 */
export interface {{Name}}Repository {
  /** Newest first. */
  list(userId: string): Promise<{{Name}}[]>
  /** Returns `null` when the id is unknown, malformed or not the user's. */
  get(userId: string, id: string): Promise<{{Name}} | null>
  create(userId: string, input: New{{Name}}): Promise<{{Name}}>
  /** Returns `null` when the id is unknown, malformed or not the user's. */
  update(userId: string, id: string, patch: {{Name}}Patch): Promise<{{Name}} | null>
  /** Returns whether something was deleted. */
  delete(userId: string, id: string): Promise<boolean>
}
