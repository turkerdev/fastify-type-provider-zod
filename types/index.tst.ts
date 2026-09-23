import type {
    FastifyInstance,
    FastifyLoggerInstance,
    RawReplyDefaultExpression,
    RawRequestDefaultExpression,
    RawServerDefault,
} from 'fastify';
import Fastify from 'fastify';
import { expect } from 'tstyche';
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

expect(fastify.setValidatorCompiler(validatorCompiler)).type.toBe<FastifyZodInstance>();
expect(fastify.setSerializerCompiler(serializerCompiler)).type.toBe<FastifyZodInstance>();
expect(fastify).type.toBeAssignableTo<FastifyZodInstance>();
expect(fastify).type.toBeAssignableTo<FastifyInstance>();

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
    expect(req.query.name).type.toBe<string>();
    res.send('string');
  },
});

fastify.route({
  method: 'GET',
  url: '/content-type',
  schema: {
    response: {
      200: {
        content: {
          'application/json': { schema: z.object({ type: z.literal('first') }) },
          'application/vnd.v1+json': { schema: z.object({ type: z.literal('second') }) },
        },
      },
    },
  },
  handler: (_req, res) => {
    expect<Parameters<typeof res.send>[0]>().type.toBe<
      { type: 'first' } | { type: 'second' }
    >();
  },
});
