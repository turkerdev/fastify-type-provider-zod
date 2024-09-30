import type { FastifySchemaValidationError } from 'fastify/types/schema';
import { expectAssignable } from 'tsd';

import { hasZodFastifySchemaValidationErrors, type ZodFastifySchemaValidationError } from '../src/errors';

expectAssignable<FastifySchemaValidationError>({} as ZodFastifySchemaValidationError);

const error: unknown = {};
if (hasZodFastifySchemaValidationErrors(error)) {
  expectAssignable<ZodFastifySchemaValidationError>(error.validation[0]);

  error.validation.forEach((validationError) => {
    expectAssignable<ZodFastifySchemaValidationError>(validationError);
  })
}