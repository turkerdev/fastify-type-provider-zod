import fastifySwagger from '@fastify/swagger';
import Fastify from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from '../src';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from '../src';

describe('transformer', () => {
  it('generates types for fastify-swagger correctly', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.register(fastifySwagger, {
      exposeRoute: true,
      openapi: {
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: jsonSchemaTransform,
    });

    const LOGIN_SCHEMA = z.object({
      username: z.string().max(32).describe('someDescription'),
      password: z.string().max(32),
    });

    const UNAUTHORIZED_SCHEMA = z.object({
      required_role: z.literal('admin'),
    });

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          body: LOGIN_SCHEMA,
          response: {
            200: z.string(),
            401: UNAUTHORIZED_SCHEMA,
          },
        },
        handler: (req, res) => {
          res.send('ok');
        },
      });
    });

    await app.ready();

    const openApiSpecResponse = await app.inject().get('/documentation/json');
    const openApiSpec = JSON.parse(openApiSpecResponse.body);

    expect(openApiSpec).toMatchSnapshot();
  });
});
