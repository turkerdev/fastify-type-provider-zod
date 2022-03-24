import { serializerCompiler, validatorCompiler, ZodTypeProvider } from '../src/index';
import { expectAssignable, expectType } from 'tsd'
import Fastify, { FastifyInstance, FastifyLoggerInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify'
import z from 'zod';

const fastify = Fastify().withTypeProvider<ZodTypeProvider>()

type FastifyZodInstance = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyLoggerInstance, ZodTypeProvider>

expectType<FastifyZodInstance>(fastify.setValidatorCompiler(validatorCompiler));
expectType<FastifyZodInstance>(fastify.setSerializerCompiler(serializerCompiler));
expectAssignable<FastifyZodInstance>(fastify)

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
    expectType<string>(req.query.name)
    res.send('string')
  },
});
