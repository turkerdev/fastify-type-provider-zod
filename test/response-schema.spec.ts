import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from '../src/core';
import { createSerializerCompiler, serializerCompiler, validatorCompiler } from '../src/core';
import { ResponseSerializationError } from '../src/errors';

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
              // @ts-expect-error
              res.status(204).send({ id: 1 });
            },
          });
      });
      app.setErrorHandler((err, req, reply) => {
        if (err instanceof ResponseSerializationError) {
          return reply.code(500).send({
            error: 'Internal Server Error',
            message: "Response doesn't match the schema",
            statusCode: 500,
            details: {
              issues: err.cause.issues,
              method: err.method,
              url: err.url,
            },
          });
        }
        throw err;
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
      expect(response.json()).toMatchInlineSnapshot(`
        {
          "details": {
            "issues": [
              {
                "code": "invalid_type",
                "expected": "undefined",
                "message": "Expected undefined, received object",
                "path": [],
                "received": "object",
              },
            ],
            "method": "GET",
            "url": "/incorrect",
          },
          "error": "Internal Server Error",
          "message": "Response doesn't match the schema",
          "statusCode": 500,
        }
      `);
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
      expect(response.body).toMatchInlineSnapshot(
        `"{"statusCode":500,"code":"FST_ERR_RESPONSE_SERIALIZATION","error":"Internal Server Error","message":"Response doesn't match the schema"}"`,
      );
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
      expect(response.json()).toMatchInlineSnapshot();
    });
  });

  describe('correctly replaces date in stringified response', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
      const REPLY_SCHEMA = z.object({
        createdAt: z.date(),
      });

      app = Fastify();
      app.setValidatorCompiler(validatorCompiler);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function replacer(key: any, value: any) {
        if (this[key] instanceof Date) {
          return { _date: this[key].toISOString() };
        }
        return value;
      }

      const serializerCompiler = createSerializerCompiler({ replacer });

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
              createdAt: new Date('2021-01-01T00:00:00Z'),
            });
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
        createdAt: { _date: '2021-01-01T00:00:00.000Z' },
      });
    });
  });
  describe('correctly process response schema and expects the non transformed type', () => {
    let app: FastifyInstance;
    beforeEach(async () => {
      const REPLY_SCHEMA = z.object({
        mySubObject: z
          .object({
            myDate: z.date(),
          })
          .transform(({ myDate }) => ({ myDate: myDate.toISOString() })),
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
              mySubObject: {
                // this is a Date as the input (aka. before transform) is a date
                myDate: new Date('2021-05-12T00:00:00.000Z'),
              },
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
        mySubObject: {
          // this is a string as the output (aka. after transform) is a string
          myDate: '2021-05-12T00:00:00.000Z',
        },
      });
    });

    // FixMe https://github.com/turkerdev/fastify-type-provider-zod/issues/16
    it.skip('returns 500 for incorrect response', async () => {
      const response = await app.inject().get('/incorrect');

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchInlineSnapshot();
    });
  });
});
