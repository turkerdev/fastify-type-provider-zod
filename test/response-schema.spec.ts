import Fastify from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from '../src';
import { serializerCompiler, validatorCompiler } from '../src';

describe('response schema', () => {
  it('correctly processes response schema', async () => {
    const REPLY_SCHEMA = z.object({
      name: z.string(),
    });

    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler((err, req, reply) => {
      reply.status(500).send('error');
    });

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/',
        schema: {
          response: {
            200: REPLY_SCHEMA,
          },
        },
        handler: (req, res) => {
          res.send({
            name: 'test',
          });
        },
      });
    });

    await app.ready();

    const response = await app.inject().get('/');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: 'test',
    });
  });
});
