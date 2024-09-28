import type { FastifySchemaValidationError } from 'fastify/types/schema';
import { expectAssignable } from 'tsd';

import type { ZodFastifySchemaValidationError } from '../src/errors';

expectAssignable<FastifySchemaValidationError>({} as ZodFastifySchemaValidationError);
