import type {
  FastifyInstance,
  FastifyBaseLogger,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault
} from 'fastify';
import Fastify from 'fastify';
import { expect } from 'tstyche';
import { z } from 'zod/v4';

import { serializerCompiler, validatorCompiler } from '../src/core.ts';
import type { ZodTypeProvider } from '../src/core.ts';

const fastify = Fastify().withTypeProvider<ZodTypeProvider>();

type FastifyZodInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

expect(
  fastify.setValidatorCompiler(validatorCompiler)
).type.toBe<FastifyZodInstance>();
expect(
  fastify.setSerializerCompiler(serializerCompiler)
).type.toBe<FastifyZodInstance>();
expect(fastify).type.toBeAssignableTo<FastifyZodInstance>();
expect(fastify).type.toBeAssignableTo<FastifyInstance>();

fastify.route({
  method: 'GET',
  url: '/',
  schema: {
    querystring: z.object({
      name: z.string().min(4)
    }),
    response: {
      200: z.string()
    }
  },
  handler: (req, res) => {
    expect(req.query.name).type.toBe<string>();
    res.send('string');
  }
});
