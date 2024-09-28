import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from '../src/core';
import { serializerCompiler, validatorCompiler } from '../src/core';
import { hasZodFastifySchemaValidationErrors } from '../src/errors';

describe('response schema with custom error handler', () => {
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
    app.setErrorHandler((err, req, reply) => {
      if (hasZodFastifySchemaValidationErrors(err)) {
        return reply.code(400).send({
          error: 'Response Validation Error',
          message: "Request doesn't match the schema",
          statusCode: 400,
          details: {
            issues: err.validation,
            method: req.method,
            url: req.url,
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

  it('returns 400 and custom error on body validation error', async () => {
    const response = await app.inject().post('/').body({
      surname: 'dummy',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchInlineSnapshot(`
      {
        "details": {
          "issues": [
            {
              "instancePath": "/name",
              "keyword": "invalid_type",
              "message": "Required",
              "name": "ZodFastifySchemaValidationError",
              "params": {
                "issue": {
                  "code": "invalid_type",
                  "expected": "string",
                  "message": "Required",
                  "path": [
                    "name",
                  ],
                  "received": "undefined",
                },
                "zodError": {
                  "issues": [
                    {
                      "code": "invalid_type",
                      "expected": "string",
                      "message": "Required",
                      "path": [
                        "name",
                      ],
                      "received": "undefined",
                    },
                  ],
                  "name": "ZodError",
                },
              },
              "schemaPath": "#/name/invalid_type",
            },
          ],
          "method": "POST",
          "url": "/",
        },
        "error": "Response Validation Error",
        "message": "Request doesn't match the schema",
        "statusCode": 400,
      }
    `);
  });
});
