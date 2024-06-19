import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from '../src';
import { serializerCompiler, validatorCompiler } from '../src';

describe('response schema', () => {
  describe('does not fail on empty response schema (204)', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      app.after(() => {
        app
          .withTypeProvider<ZodTypeProvider>()
          .route({
            method: 'GET',
            url: '/',
            schema: {
              response: {
                204: z.undefined().describe('test'),
              },
            },
            handler: (req, res) => {
              res.status(204).send();
            },
          })
          .route({
            method: 'GET',
            url: '/incorrect',
            schema: {
              response: {
                204: z.undefined().describe('test'),
              },
            },
            handler: (req, res) => {
              res.status(204).send({ id: 1 });
            },
          });
      });
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 204', async () => {
      const response = await app.inject().get('/');

      expect(response.statusCode).toBe(204);
      expect(response.body).toEqual('');
    });

    it('throws on non-empty', async () => {
      const response = await app.inject().get('/incorrect');

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: 'Internal Server Error',
        message: "Response doesn't match the schema",
        statusCode: 500,
      });
    });
  });

  describe('correctly processes response schema (string)', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      const REPLY_SCHEMA = z.string();

      app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

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
            res.send('test');
          },
        });

        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/incorrect',
          schema: {
            response: {
              200: REPLY_SCHEMA,
            },
          },
          handler: (req, res) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            res.send({ name: 'test' } as any);
          },
        });
      });

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 200 on correct response', async () => {
      const response = await app.inject().get('/');

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual('test');
    });

    it('returns 500 on incorrect response', async () => {
      const response = await app.inject().get('/incorrect');

      expect(response.statusCode).toBe(500);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe('correctly processes response schema (object)', () => {
    let app: FastifyInstance;
    beforeEach(async () => {
      const REPLY_SCHEMA = z.object({
        name: z.string(),
      });

      app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

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

        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/incorrect',
          schema: {
            response: {
              200: REPLY_SCHEMA,
            },
          },
          handler: (req, res) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            res.send('test' as any);
          },
        });
      });

      await app.ready();
    });
    afterAll(async () => {
      await app.close();
    });

    it('returns 200 for correct response', async () => {
      const response = await app.inject().get('/');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        name: 'test',
      });
    });

    // FixMe https://github.com/turkerdev/fastify-type-provider-zod/issues/16
    it.skip('returns 500 for incorrect response', async () => {
      const response = await app.inject().get('/incorrect');

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchSnapshot();
    });
  });

  describe('correctly processes different response schemas', () => {
    let app: FastifyInstance;
    beforeEach(async () => {
      const REPLY_SCHEMA = z.object({
        name: z.string(),
      });
      const TEXT_REPLY_SCHEMA = z.string();

      app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      app.after(() => {
        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/',
          schema: {
            response: {
              200: {
                content: {
                  'application/json': {
                    schema: REPLY_SCHEMA,
                  },
                  'text/plain': {
                    schema: TEXT_REPLY_SCHEMA,
                  },
                }
              },
            },
          },
          handler: (req, res) => {
            if(req.headers.accept == 'application/json'){
              res.send({
                name: 'test',
              });
            }else{
              res.send('test');
            }
          },
        });

        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/incorrect',
          schema: {
            response: {
              200: {
                content: {
                  'application/json': {
                    schema: REPLY_SCHEMA,
                  },
                  'text/plain': {
                    schema: TEXT_REPLY_SCHEMA,
                  },
                }
              },
            },
          },
          handler: (req, res) => {
            if(req.headers.accept == 'application/json'){
              res.send('test');
            }else{
              res.send({
                name: 'test',
              });
            }
          },
        });
      });

      await app.ready();
    });
    afterAll(async () => {
      await app.close();
    });

    it('returns 200 for correct response', async () => {
      let response = await app.inject({method: 'get', headers: {accept: 'application/json'}, url: '/' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        name: 'test',
      });

      response = await app.inject({method: 'get', headers: {accept: 'text/plain'}, url: '/' });
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual('test');
    });

    // FixMe https://github.com/turkerdev/fastify-type-provider-zod/issues/16
    it.skip('returns 500 for incorrect response', async () => {
      let response = await app.inject({method: 'get', headers: {accept: 'application/json'}, url: '/incorrect' });
      expect(response.statusCode).toBe(500);

      response = await app.inject({method: 'get', headers: {accept: 'text/plain'}, url: '/incorrect' });
      expect(response.statusCode).toBe(500);
    });
  });
});
