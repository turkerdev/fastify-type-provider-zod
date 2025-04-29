import createError from '@fastify/error'
import type { FastifyError } from 'fastify'
import type { z } from 'zod'

export class ResponseSerializationError extends createError<[{ cause: z.core.$ZodError }]>(
  'FST_ERR_RESPONSE_SERIALIZATION',
  "Response doesn't match the schema",
  500,
) {
  cause!: z.core.$ZodError

  constructor(
    public method: string,
    public url: string,
    options: { cause: z.core.$ZodError },
  ) {
    super({ cause: options.cause })

    this.cause = options.cause
  }
}

export function isResponseSerializationError(value: unknown): value is ResponseSerializationError {
  return 'method' in (value as ResponseSerializationError)
}

export const InvalidSchemaError = createError<[string]>(
  'FST_ERR_INVALID_SCHEMA',
  'Invalid schema passed: %s',
  500,
)

const ZodFastifySchemaValidationErrorSymbol = Symbol.for('ZodFastifySchemaValidationError')

export type ZodFastifySchemaValidationError = {
  [ZodFastifySchemaValidationErrorSymbol]: true
  keyword: string
  instancePath: string
  schemaPath: string
  params: {
    issue: z.core.$ZodIssue
  }
  message: string
}

const isZodFastifySchemaValidationError = (
  error: unknown,
): error is ZodFastifySchemaValidationError =>
  typeof error === 'object' &&
  error !== null &&
  ZodFastifySchemaValidationErrorSymbol in error &&
  error[ZodFastifySchemaValidationErrorSymbol] === true

export const hasZodFastifySchemaValidationErrors = (
  error: unknown,
): error is Omit<FastifyError, 'validation'> & { validation: ZodFastifySchemaValidationError[] } =>
  typeof error === 'object' &&
  error !== null &&
  'validation' in error &&
  Array.isArray(error.validation) &&
  error.validation.length > 0 &&
  isZodFastifySchemaValidationError(error.validation[0])

export const createValidationError = (error: z.core.$ZodError): ZodFastifySchemaValidationError[] =>
  error.issues.map((issue) => ({
    [ZodFastifySchemaValidationErrorSymbol]: true,
    keyword: issue.code ?? 'custom',
    instancePath: `/${issue.path.join('/')}`,
    schemaPath: `#/${issue.path.join('/')}/${issue.code}`,
    params: {
      issue,
    },
    message: issue.message,
  }))
