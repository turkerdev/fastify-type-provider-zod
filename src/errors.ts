import createError from '@fastify/error';
import type { FastifyError } from 'fastify';
import type { FastifySchemaValidationError } from 'fastify/types/schema';
import type { ZodError, ZodIssue, ZodIssueCode } from 'zod';

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

export class ZodFastifySchemaValidationError implements FastifySchemaValidationError {
  public name = 'ZodFastifySchemaValidationError';

  constructor(
    public message: string,
    public keyword: ZodIssueCode,
    public instancePath: string,
    public schemaPath: string,
    public params: {
      issue: ZodIssue;
      zodError: ZodError;
    },
  ) {}
}

const isZodFastifySchemaValidationError = (
  error: unknown,
): error is ZodFastifySchemaValidationError =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  error.name === 'ZodFastifySchemaValidationError';

export const hasZodFastifySchemaValidationErrors = (
  error: unknown,
): error is FastifyError & { validation: ZodFastifySchemaValidationError[] } =>
  typeof error === 'object' &&
  error !== null &&
  'validation' in error &&
  Array.isArray(error.validation) &&
  error.validation.length > 0 &&
  isZodFastifySchemaValidationError(error.validation[0]);

export const createValidationError = (error: ZodError) =>
  error.errors.map(
    (issue) =>
      new ZodFastifySchemaValidationError(
        issue.message,
        issue.code,
        `/${issue.path.join('/')}`,
        `#/${issue.path.join('/')}/${issue.code}`,
        { issue, zodError: error },
      ),
  );
