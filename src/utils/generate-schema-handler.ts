import type { ZodArray, ZodObject, ZodRawShape, ZodTypeAny } from 'zod'

import { schemaResponseUnauthorized } from '~/http/middleware/verify-auth'

import { schemaBadRequest, schemaInternalError } from './parse-zod-error'

type GenerateSchemaHandlerOptions = {
  schemaResponseSuccess: ZodObject<ZodRawShape> | ZodArray<ZodTypeAny>
  codeResponseSuccess: number
  description: string
  tags: string[]
  operationId: string
  summary: string
  isPublic?: boolean
}

export const generateResponseSchemaHandler = ({
  codeResponseSuccess,
  schemaResponseSuccess,
  ...restData
}: GenerateSchemaHandlerOptions) => {
  const responseSchema: Record<number, ZodTypeAny | undefined> = {
    [codeResponseSuccess]: schemaResponseSuccess,
    400: schemaBadRequest,
    500: schemaInternalError,
  }

  if (!restData.isPublic) {
    responseSchema[401] = schemaResponseUnauthorized
  }

  return {
    ...restData,
    response: responseSchema,
  }
}
