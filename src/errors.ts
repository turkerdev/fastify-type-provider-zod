import createError, { type FastifyErrorConstructor } from '@fastify/error'
import type { FastifyError } from 'fastify'
import type { FastifySchemaValidationError } from 'fastify/types/schema'
import type { $ZodError } from 'zod/v4/core'

export const InvalidSchemaError: FastifyErrorConstructor<
  {
    code: string
  },
  [string]
> = createError<[string]>('FST_ERR_INVALID_SCHEMA', 'Invalid schema passed: %s', 500)

const ZodFastifySchemaValidationErrorSymbol: symbol = Symbol.for('ZodFastifySchemaValidationError')

export type ZodFastifySchemaValidationError = FastifySchemaValidationError & {
  [ZodFastifySchemaValidationErrorSymbol]: true
}

const ResponseSerializationBase: FastifyErrorConstructor<
  {
    code: string
  },
  [
    {
      cause: $ZodError
    },
  ]
> = createError<[{ cause: $ZodError }]>(
  'FST_ERR_RESPONSE_SERIALIZATION',
  "Response doesn't match the schema",
  500,
)

export class ResponseSerializationError extends ResponseSerializationBase {
  cause!: $ZodError

  constructor(
    public method: string,
    public url: string,
    options: { cause: $ZodError },
  ) {
    super({ cause: options.cause })

    this.cause = options.cause
  }
}

export function isResponseSerializationError(value: unknown): value is ResponseSerializationError {
  return 'method' in (value as ResponseSerializationError)
}

function isZodFastifySchemaValidationError(
  error: unknown,
): error is ZodFastifySchemaValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as ZodFastifySchemaValidationError)[ZodFastifySchemaValidationErrorSymbol] === true
  )
}

export function hasZodFastifySchemaValidationErrors(
  error: unknown,
): error is Omit<FastifyError, 'validation'> & { validation: ZodFastifySchemaValidationError[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'validation' in error &&
    Array.isArray(error.validation) &&
    error.validation.length > 0 &&
    isZodFastifySchemaValidationError(error.validation[0])
  )
}

function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const result = {} as Omit<T, K>
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (!keys.includes(key as K)) {
      // @ts-expect-error
      result[key] = obj[key]
    }
  }
  return result
}

export function createValidationError(error: $ZodError): ZodFastifySchemaValidationError[] {
  return error.issues.map((issue) => {
    return {
      [ZodFastifySchemaValidationErrorSymbol]: true,
      keyword: issue.code,
      instancePath: `/${issue.path.join('/')}`,
      schemaPath: `#/${issue.path.join('/')}/${issue.code}`,
      message: issue.message,
      params: {
        ...omit(issue, ['path', 'code', 'message']),
      },
    }
  })
}
