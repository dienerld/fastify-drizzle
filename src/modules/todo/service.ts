import { fail, ok, type Result } from '~/utils/result'
import type { NewTodo, Todo, TodoPatch, TodoRepository } from './repository'

const notFound = () =>
  fail({ code: 'not_found' as const, message: 'Todo not found' })

export function createTodoService(todos: TodoRepository) {
  return {
    async list(): Promise<Result<Todo[]>> {
      return ok(await todos.list())
    },

    async get(id: string): Promise<Result<Todo>> {
      const todo = await todos.get(id)
      return todo ? ok(todo) : notFound()
    },

    async create(input: NewTodo): Promise<Result<Todo>> {
      return ok(await todos.create(input))
    },

    async update(id: string, patch: TodoPatch): Promise<Result<Todo>> {
      const todo = await todos.update(id, patch)
      return todo ? ok(todo) : notFound()
    },

    async remove(id: string): Promise<Result<null>> {
      return (await todos.delete(id)) ? ok(null) : notFound()
    },
  }
}

export type TodoService = ReturnType<typeof createTodoService>
