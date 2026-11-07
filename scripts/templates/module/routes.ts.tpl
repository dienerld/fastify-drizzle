import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { routeSchema } from '~/utils/generate-schema-handler'
import { toHttpError } from '~/utils/result'

import type { {{Name}}Repository } from './repository'
import { create{{Name}}Service } from './service'

const {{camel}}Schema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

const createBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
})

const updateBody = createBody.partial()

const idParams = z.object({ id: z.string().min(1) })

const tags = ['{{pluralKebab}}']

export const {{camel}}Routes: FastifyPluginAsyncZod<{
  {{pluralCamel}}: {{Name}}Repository
}> = async (app, { {{pluralCamel}} }) => {
  // Every route of this plugin requires a valid access token and works only
  // on the caller's own {{pluralWords}}. Added as a hook so new routes can't forget it.
  app.addHook('onRequest', app.authenticate)

  const service = create{{Name}}Service({{pluralCamel}})

  app.get(
    '',
    {
      schema: routeSchema({
        operationId: 'list{{PluralPascal}}',
        summary: 'List',
        description: 'List {{pluralWords}}, newest first',
        protected: true,
        tags,
        response: z.array({{camel}}Schema),
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
          operationId: 'get{{Name}}',
          summary: 'Get',
          description: 'Get a {{words}} by id',
          protected: true,
          tags,
          notFound: true,
          response: {{camel}}Schema,
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
          operationId: 'create{{Name}}',
          summary: 'Create',
          description: 'Create a {{words}}',
          status: 201,
          protected: true,
          tags,
          response: {{camel}}Schema,
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
          operationId: 'update{{Name}}',
          summary: 'Update',
          description: 'Partially update a {{words}}',
          protected: true,
          tags,
          notFound: true,
          response: {{camel}}Schema,
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
          operationId: 'delete{{Name}}',
          summary: 'Delete',
          description: 'Delete a {{words}}',
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
