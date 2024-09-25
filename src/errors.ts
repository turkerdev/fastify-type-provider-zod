import createError from '@fastify/error';
import type { FastifySchemaValidationError } from 'fastify/types/schema';
import type { ZodError } from 'zod';

export class ResponseSerializationError extends createError<[{ cause: ZodError }]>(
  'FST_ERR_RESPONSE_SERIALIZATION',
  "Response doesn't match the schema",
  500,
) {
  constructor(
    public cause: ZodError,
    public method: string,
    public url: string,
  ) {
    super({ cause });
  }
}

export const InvalidSchemaError = createError<[string]>(
  'FST_ERR_INVALID_SCHEMA',
  'Invalid schema passed: %s',
  500,
);

export const createValidationError = (
  error: ZodError,
  method: string,
  url: string,
): FastifySchemaValidationError[] =>
  error.errors.map((issue) => ({
    keyword: issue.code,
    instancePath: `/${issue.path.join('/')}`,
    schemaPath: `#/${issue.path.join('/')}/${issue.code}`,
    params: {
      issue,
      zodError: error,
      method,
      url,
    },
    message: error.message,
  }));
