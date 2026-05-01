import type { FastifySchemaValidationError } from 'fastify/types/schema.d.ts';
import { expect } from 'tstyche';
import {
  hasZodFastifySchemaValidationErrors,
  type ZodFastifySchemaValidationError
} from '../src/errors.ts';

expect<ZodFastifySchemaValidationError>().type.toBeAssignableTo<FastifySchemaValidationError>()

const error: unknown = {};

if (hasZodFastifySchemaValidationErrors(error)) {
  expect(error.validation).type.toBe<ZodFastifySchemaValidationError[]>();
}
