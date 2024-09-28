import createError from '@fastify/error';
import type { FastifyError } from 'fastify';
import type { ZodError, ZodIssue, ZodIssueCode } from 'zod';

export class ResponseSerializationError extends createError<[{ cause: ZodError }]>(
  'FST_ERR_RESPONSE_SERIALIZATION',
  "Response doesn't match the schema",
  500,
) {
  constructor(
    public method: string,
    public url: string,
    options: { cause: ZodError },
  ) {
    super({ cause: options.cause });
  }
}

export const InvalidSchemaError = createError<[string]>(
  'FST_ERR_INVALID_SCHEMA',
  'Invalid schema passed: %s',
  500,
);

export type ZodFastifySchemaValidationError = {
  name: 'ZodFastifySchemaValidationError';
  keyword: ZodIssueCode;
  instancePath: string;
  schemaPath: string;
  params: {
    issue: ZodIssue;
    zodError: ZodError;
  };
  message: string;
};

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

export const createValidationError = (error: ZodError): ZodFastifySchemaValidationError[] =>
  error.errors.map((issue) => ({
    name: 'ZodFastifySchemaValidationError',
    keyword: issue.code,
    instancePath: `/${issue.path.join('/')}`,
    schemaPath: `#/${issue.path.join('/')}/${issue.code}`,
    params: {
      issue,
      zodError: error,
    },
    message: issue.message,
  }));
