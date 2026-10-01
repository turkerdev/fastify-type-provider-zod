import type { FastifySchemaValidationError } from 'fastify';
import { expect } from 'tstyche';

import { hasZodFastifySchemaValidationErrors, type ZodFastifySchemaValidationError } from '../src/errors';

expect<ZodFastifySchemaValidationError>().type.toBeAssignableTo<FastifySchemaValidationError>();

const error: unknown = {};
if (hasZodFastifySchemaValidationErrors(error)) {
  expect(error.validation[0]).type.toBeAssignableTo<ZodFastifySchemaValidationError>();

  error.validation.forEach((validationError) => {
    expect(validationError).type.toBeAssignableTo<ZodFastifySchemaValidationError>();
  })
}
