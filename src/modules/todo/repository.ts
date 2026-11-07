export type Todo = {
  id: string
  userId: string
  title: string
  description: string | null
  completed: boolean
  createdAt: Date
  updatedAt: Date
}

export type NewTodo = {
  title: string
  description?: string | null
  completed?: boolean
}

export type TodoPatch = Partial<NewTodo>

/**
 * Every method is scoped by `userId`: a todo that belongs to someone else is
 * indistinguishable from a missing one (`null` / `false`), so it can never leak.
 */
export interface TodoRepository {
  /** Newest first. */
  list(userId: string): Promise<Todo[]>
  /** Returns `null` when the id is unknown, malformed or not the user's. */
  get(userId: string, id: string): Promise<Todo | null>
  create(userId: string, input: NewTodo): Promise<Todo>
  /** Returns `null` when the id is unknown, malformed or not the user's. */
  update(userId: string, id: string, patch: TodoPatch): Promise<Todo | null>
  /** Returns whether something was deleted. */
  delete(userId: string, id: string): Promise<boolean>
}
