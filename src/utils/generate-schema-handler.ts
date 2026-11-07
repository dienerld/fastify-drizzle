import type { ZodType } from 'zod'

import { errorResponseSchema } from './error-handler'

type RouteDocs = {
  response: ZodType
  status?: number
  description: string
  tags?: string[]
  operationId: string
  summary: string
  /** Adds the 401 response when the route requires auth. */
  protected?: boolean
  /** Adds the 404 response when the route can miss a resource. */
  notFound?: boolean
}

/** Builds the route `schema` docs/response map, always including the standard error shape. */
export const routeSchema = ({
  response,
  status = 200,
  protected: isProtected,
  notFound,
  ...docs
}: RouteDocs) => ({
  ...docs,
  // OpenAPI: documents the bearer scheme registered in `app.ts`
  ...(isProtected ? { security: [{ bearerAuth: [] }] } : {}),
  response: {
    [status]: response,
    400: errorResponseSchema,
    ...(isProtected ? { 401: errorResponseSchema } : {}),
    ...(notFound ? { 404: errorResponseSchema } : {}),
    500: errorResponseSchema,
  },
})
