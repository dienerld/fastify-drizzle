export type Todo = {
  id: string
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

// Not user-scoped yet: ownership (userId) arrives with the auth module (phase 3).
export interface TodoRepository {
  /** Newest first. */
  list(): Promise<Todo[]>
  /** Returns `null` when the id is unknown or malformed. */
  get(id: string): Promise<Todo | null>
  create(input: NewTodo): Promise<Todo>
  /** Returns `null` when the id is unknown or malformed. */
  update(id: string, patch: TodoPatch): Promise<Todo | null>
  /** Returns whether something was deleted. */
  delete(id: string): Promise<boolean>
}
