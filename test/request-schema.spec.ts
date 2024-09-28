import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from '../src/core';
import { serializerCompiler, validatorCompiler } from '../src/core';

describe('response schema', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    const REQUEST_SCHEMA = z.object({
      name: z.string(),
    });

    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.after(() => {
      app
        .withTypeProvider<ZodTypeProvider>()
        .route({
          method: 'POST',
          url: '/',
          schema: {
            body: REQUEST_SCHEMA,
          },
          handler: (req, res) => {
            res.send({
              name: req.body.name,
            });
          },
        })
        .route({
          method: 'GET',
          url: '/',
          schema: {
            querystring: REQUEST_SCHEMA,
          },
          handler: (req, res) => {
            res.send({
              name: req.query.name,
            });
          },
        })
        .route({
          method: 'GET',
          url: '/no-schema',
          schema: undefined,
          handler: (req, res) => {
            res.send({
              status: 'ok',
            });
          },
        });
    });

    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('accepts correct request', async () => {
    const response = await app.inject().get('/').query({
      name: 'test',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: 'test',
    });
  });

  it('accepts request on route without schema', async () => {
    const response = await app.inject().get('/no-schema');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
    });
  });

  it('returns 400 on querystring validation error', async () => {
    const response = await app.inject().get('/');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchInlineSnapshot(`
      {
        "code": "FST_ERR_VALIDATION",
        "error": "Bad Request",
        "message": "querystring/name [
        {
          "code": "invalid_type",
          "expected": "string",
          "received": "undefined",
          "path": [
            "name"
          ],
          "message": "Required"
        }
      ]",
        "statusCode": 400,
      }
    `);
  });

  it('returns 400 on body validation error', async () => {
    const response = await app.inject().post('/').body({
      surname: 'dummy',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchInlineSnapshot(`
      {
        "code": "FST_ERR_VALIDATION",
        "error": "Bad Request",
        "message": "body/name [
        {
          "code": "invalid_type",
          "expected": "string",
          "received": "undefined",
          "path": [
            "name"
          ],
          "message": "Required"
        }
      ]",
        "statusCode": 400,
      }
    `);
  });

  it('returns 400 on empty body validation error', async () => {
    const response = await app.inject().post('/');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchInlineSnapshot(`
      {
        "code": "FST_ERR_VALIDATION",
        "error": "Bad Request",
        "message": "body/ [
        {
          "code": "invalid_type",
          "expected": "object",
          "received": "null",
          "path": [],
          "message": "Expected object, received null"
        }
      ]",
        "statusCode": 400,
      }
    `);
  });
});
