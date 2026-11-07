/** Outcome of a service call: either a value or a typed domain error. */
export type Result<T, E = ServiceError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export type ServiceError = {
  code: 'not_found' | 'conflict' | 'unauthorized' | 'forbidden'
  message: string
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

export const fail = <E = ServiceError>(error: E): Result<never, E> => ({
  ok: false,
  error,
})

const STATUS: Record<ServiceError['code'], number> = {
  not_found: 404,
  conflict: 409,
  unauthorized: 401,
  forbidden: 403,
}

/** Maps a service error to an Error with the matching HTTP `statusCode`. */
export function toHttpError(error: ServiceError) {
  return Object.assign(new Error(error.message), {
    statusCode: STATUS[error.code],
  })
}
