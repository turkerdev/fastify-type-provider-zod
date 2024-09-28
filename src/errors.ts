import createError from '@fastify/error';
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

export interface ZodFastifySchemaValidationError {
  keyword: ZodIssueCode;
  instancePath: string;
  schemaPath: string;
  params: {
    issue: ZodIssue;
    zodError: ZodError;
    method: string;
    url: string;
  };
  message: string;
}

export const createValidationError = (
  error: ZodError,
  method: string,
  url: string,
): ZodFastifySchemaValidationError[] =>
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
    message: issue.message,
  }));
