import type {
    FastifyInstance,
    FastifyLoggerInstance,
    RawReplyDefaultExpression,
    RawRequestDefaultExpression,
    RawServerDefault,
} from 'fastify';
import Fastify from 'fastify';
import { expectAssignable, expectType } from 'tsd';
import { z } from 'zod/v4';

import { serializerCompiler, validatorCompiler } from '../src/core';
import type { ZodTypeProvider } from '../src/core';

const fastify = Fastify().withTypeProvider<ZodTypeProvider>();

type FastifyZodInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyLoggerInstance,
  ZodTypeProvider
>;

expectType<FastifyZodInstance>(fastify.setValidatorCompiler(validatorCompiler));
expectType<FastifyZodInstance>(fastify.setSerializerCompiler(serializerCompiler));
expectAssignable<FastifyZodInstance>(fastify);
expectAssignable<FastifyInstance>(fastify);

fastify.route({
  method: 'GET',
  url: '/',
  // Define your schema
  schema: {
    querystring: z.object({
      name: z.string().min(4),
    }),
    response: {
      200: z.string(),
    },
  },
  handler: (req, res) => {
    expectType<string>(req.query.name);
    res.send('string');
  },
});
