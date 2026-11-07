import { fail, ok, type Result } from '~/utils/result'
import type { NewTodo, Todo, TodoPatch, TodoRepository } from './repository'

const notFound = () =>
  fail({ code: 'not_found' as const, message: 'Todo not found' })

export function createTodoService(todos: TodoRepository) {
  return {
    async list(userId: string): Promise<Result<Todo[]>> {
      return ok(await todos.list(userId))
    },

    async get(userId: string, id: string): Promise<Result<Todo>> {
      const todo = await todos.get(userId, id)
      return todo ? ok(todo) : notFound()
    },

    async create(userId: string, input: NewTodo): Promise<Result<Todo>> {
      return ok(await todos.create(userId, input))
    },

    async update(
      userId: string,
      id: string,
      patch: TodoPatch
    ): Promise<Result<Todo>> {
      const todo = await todos.update(userId, id, patch)
      return todo ? ok(todo) : notFound()
    },

    async remove(userId: string, id: string): Promise<Result<null>> {
      return (await todos.delete(userId, id)) ? ok(null) : notFound()
    },
  }
}

export type TodoService = ReturnType<typeof createTodoService>
