import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { routeSchema } from '~/utils/generate-schema-handler'
import { toHttpError } from '~/utils/result'

import type { TodoRepository } from './repository'
import { createTodoService } from './service'

const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  completed: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

const createBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  completed: z.boolean().optional(),
})

const updateBody = createBody.partial()

const idParams = z.object({ id: z.string().min(1) })

const tags = ['todos']

export const todoRoutes: FastifyPluginAsyncZod<{
  todos: TodoRepository
}> = async (app, { todos }) => {
  // Every route of this plugin requires a valid access token and works only
  // on the caller's own todos. Added as a hook so new routes can't forget it.
  app.addHook('onRequest', app.authenticate)

  const service = createTodoService(todos)

  app.get(
    '',
    {
      schema: routeSchema({
        operationId: 'listTodos',
        summary: 'List',
        description: 'List todos, newest first',
        protected: true,
        tags,
        response: z.array(todoSchema),
      }),
    },
    async request => {
      const result = await service.list(request.user.id)
      if (!result.ok) throw toHttpError(result.error)
      return result.value
    }
  )

  app.get(
    '/:id',
    {
      schema: {
        params: idParams,
        ...routeSchema({
          operationId: 'getTodo',
          summary: 'Get',
          description: 'Get a todo by id',
          protected: true,
          tags,
          notFound: true,
          response: todoSchema,
        }),
      },
    },
    async request => {
      const result = await service.get(request.user.id, request.params.id)
      if (!result.ok) throw toHttpError(result.error)
      return result.value
    }
  )

  app.post(
    '',
    {
      schema: {
        body: createBody,
        ...routeSchema({
          operationId: 'createTodo',
          summary: 'Create',
          description: 'Create a todo',
          status: 201,
          protected: true,
          tags,
          response: todoSchema,
        }),
      },
    },
    async (request, reply) => {
      const result = await service.create(request.user.id, request.body)
      if (!result.ok) throw toHttpError(result.error)
      return reply.status(201).send(result.value)
    }
  )

  app.patch(
    '/:id',
    {
      schema: {
        params: idParams,
        body: updateBody,
        ...routeSchema({
          operationId: 'updateTodo',
          summary: 'Update',
          description: 'Partially update a todo',
          protected: true,
          tags,
          notFound: true,
          response: todoSchema,
        }),
      },
    },
    async request => {
      const result = await service.update(
        request.user.id,
        request.params.id,
        request.body
      )
      if (!result.ok) throw toHttpError(result.error)
      return result.value
    }
  )

  app.delete(
    '/:id',
    {
      schema: {
        params: idParams,
        ...routeSchema({
          operationId: 'deleteTodo',
          summary: 'Delete',
          description: 'Delete a todo',
          status: 204,
          protected: true,
          tags,
          notFound: true,
          response: z.null(),
        }),
      },
    },
    async (request, reply) => {
      const result = await service.remove(request.user.id, request.params.id)
      if (!result.ok) throw toHttpError(result.error)
      return reply.status(204).send(null)
    }
  )
}
