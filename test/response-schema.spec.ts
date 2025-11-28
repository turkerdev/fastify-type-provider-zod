import type { FastifyInstance, InjectOptions } from 'fastify'
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import type { ZodTypeProvider } from '../src/core'
import { createSerializerCompiler, serializerCompiler, validatorCompiler } from '../src/core'
import { isResponseSerializationError } from '../src/errors'

describe('response schema', () => {
  describe('does not fail on empty response schema (204)', () => {
    let app: FastifyInstance
    beforeAll(async () => {
      app = Fastify()
      app.setValidatorCompiler(validatorCompiler)
      app.setSerializerCompiler(serializerCompiler)

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
            handler: (_req, res) => {
              res.status(204).send()
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
            handler: (_req, res) => {
              // @ts-expect-error
              res.status(204).send({ id: 1 })
            },
          })
      })
      app.setErrorHandler((err, _req, reply) => {
        if (isResponseSerializationError(err)) {
          return reply.code(500).send({
            error: 'Internal Server Error',
            message: "Response doesn't match the schema",
            statusCode: 500,
            details: {
              issues: err.cause.issues,
              method: err.method,
              url: err.url,
            },
          })
        }
        throw err
      })
      await app.ready()
    })

    afterAll(async () => {
      await app.close()
    })

    it('returns 204', async () => {
      const response = await app.inject().get('/')

      expect(response.statusCode).toBe(204)
      expect(response.body).toEqual('')
    })

    it('throws on non-empty', async () => {
      const response = await app.inject().get('/incorrect')

      expect(response.statusCode).toBe(500)
      expect(response.json()).toMatchInlineSnapshot(`
        {
          "details": {
            "issues": [
              {
                "code": "invalid_type",
                "expected": "undefined",
                "message": "Invalid input: expected undefined, received object",
                "path": [],
              },
            ],
            "method": "GET",
            "url": "/incorrect",
          },
          "error": "Internal Server Error",
          "message": "Response doesn't match the schema",
          "statusCode": 500,
        }
      `)
    })
  })

  describe('correctly processes response schema (string)', () => {
    let app: FastifyInstance
    beforeAll(async () => {
      const REPLY_SCHEMA = z.string()

      app = Fastify()
      app.setValidatorCompiler(validatorCompiler)
      app.setSerializerCompiler(serializerCompiler)

      app.after(() => {
        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/',
          schema: {
            response: {
              200: REPLY_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send('test')
          },
        })

        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/incorrect',
          schema: {
            response: {
              200: REPLY_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send({ name: 'test' } as any)
          },
        })
      })

      await app.ready()
    })

    afterAll(async () => {
      await app.close()
    })

    it('returns 200 on correct response', async () => {
      const response = await app.inject().get('/')

      expect(response.statusCode).toBe(200)
      expect(response.body).toEqual('test')
    })

    it('returns 500 on incorrect response', async () => {
      const response = await app.inject().get('/incorrect')

      expect(response.statusCode).toBe(500)
      expect(response.body).toMatchInlineSnapshot(
        `"{"statusCode":500,"code":"FST_ERR_RESPONSE_SERIALIZATION","error":"Internal Server Error","message":"Response doesn't match the schema"}"`,
      )
    })
  })

  describe('correctly processes response schema (object)', () => {
    let app: FastifyInstance
    beforeEach(async () => {
      const REPLY_SCHEMA = z.object({
        name: z.string(),
      })

      app = Fastify()
      app.setValidatorCompiler(validatorCompiler)
      app.setSerializerCompiler(serializerCompiler)

      app.after(() => {
        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/',
          schema: {
            response: {
              200: REPLY_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send({
              name: 'test',
            })
          },
        })

        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/incorrect',
          schema: {
            response: {
              200: REPLY_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send('test' as any)
          },
        })
      })

      await app.ready()
    })
    afterAll(async () => {
      await app.close()
    })

    it('returns 200 for correct response', async () => {
      const response = await app.inject().get('/')

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        name: 'test',
      })
    })

    // FixMe https://github.com/turkerdev/fastify-type-provider-zod/issues/16
    it.skip('returns 500 for incorrect response', async () => {
      const response = await app.inject().get('/incorrect')

      expect(response.statusCode).toBe(500)
      expect(response.json()).toMatchInlineSnapshot()
    })
  })

  describe('correctly processes response schema (multiple content-types)', () => {
    let app: FastifyInstance
    beforeEach(async () => {
      /* Examples from Fastify Validation-and-Serialization docs */
      const DEFAULT_REPLY_SCHEMA = z.object({
        name: z.string(),
      })
      const V1_REPLY_SCHEMA = z.object({
        name: z.string(),
        version: z.literal(1),
      })
      const V2_REPLY_SCHEMA = z.object({
        name: z.string(),
        version: z.literal(2),
      })
      /* Example from original change request: https://github.com/turkerdev/fastify-type-provider-zod/pull/89 */
      const TEXT_REPLY_SCHEMA = z.string()

      app = Fastify()
      app.setValidatorCompiler(validatorCompiler)
      app.setSerializerCompiler(serializerCompiler)

      const handler = (req: any, res: any) => {
        const defaultReply: z.infer<typeof DEFAULT_REPLY_SCHEMA> = {
          name: 'test',
        }
        const v1Reply: z.infer<typeof V1_REPLY_SCHEMA> = {
          name: 'test',
          version: 1,
        }
        const v2Reply: z.infer<typeof V2_REPLY_SCHEMA> = {
          name: 'test',
          version: 2,
        }
        const textReply: z.infer<typeof TEXT_REPLY_SCHEMA> = 'test'

        if (req.headers.accept === '*/*') {
          res.header('Content-Type', 'application/json')
        } else {
          res.header('Content-Type', req.headers.accept)
        }

        switch (req.headers.accept) {
          case 'application/vnd.v1+json':
            return res.send(v1Reply)
          case 'application/vnd.v2+json':
            return res.send(v2Reply)
          case 'text/plain':
            return res.send(textReply)
          default:
            return res.send(defaultReply)
        }
      }

      app.after(() => {
        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/',
          schema: {
            response: {
              200: {
                content: {
                  'application/json': {
                    schema: DEFAULT_REPLY_SCHEMA,
                  },
                  'application/vnd.v1+json': {
                    schema: V1_REPLY_SCHEMA,
                  },
                  'application/vnd.v2+json': {
                    schema: V2_REPLY_SCHEMA,
                  },
                  'text/plain': {
                    schema: TEXT_REPLY_SCHEMA,
                  },
                  '*/*': {
                    schema: DEFAULT_REPLY_SCHEMA,
                  },
                },
              },
            },
          },
          handler,
        })

        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/incorrect',
          schema: {
            response: {
              200: {
                content: {
                  'application/json': {
                    schema: DEFAULT_REPLY_SCHEMA,
                  },
                  'application/vnd.v1+json': {
                    schema: V1_REPLY_SCHEMA,
                  },
                  'application/vnd.v2+json': {
                    schema: V2_REPLY_SCHEMA,
                  },
                  'text/plain': {
                    schema: TEXT_REPLY_SCHEMA,
                  },
                  '*/*': {
                    schema: DEFAULT_REPLY_SCHEMA,
                  },
                },
              },
            },
          },
          handler,
        })
      })

      await app.ready()
    })
    afterAll(async () => {
      await app.close()
    })

    const tests: { parseResponse: (response: any) => any; req: InjectOptions; res: any }[] = [
      {
        parseResponse: (response: any) => response.json(),
        req: {
          headers: {
            accept: 'application/json',
          },
          method: 'GET',
          url: '/',
        },
        res: {
          name: 'test',
        },
      },
      {
        parseResponse: (response: any) => response.json(),
        req: {
          headers: {
            accept: 'application/vnd.v1+json',
          },
          method: 'GET',
          url: '/',
        },
        res: {
          name: 'test',
          version: 1,
        },
      },
      {
        parseResponse: (response: any) => response.json(),
        req: {
          headers: {
            accept: 'application/vnd.v2+json',
          },
          method: 'GET',
          url: '/',
        },
        res: {
          name: 'test',
          version: 2,
        },
      },
      {
        parseResponse: (response: any) => response.json(),
        req: {
          headers: {
            accept: '*/*',
          },
          method: 'GET',
          url: '/',
        },
        res: {
          name: 'test',
        },
      },
      {
        parseResponse: (response: any) => response.body,
        req: {
          headers: {
            accept: 'text/plain',
          },
          method: 'GET',
          url: '/',
        },
        res: 'test',
      },
    ]

    it.each(tests)('returns 200 for correct response', async ({ parseResponse, req, res }) => {
      const response = await app.inject(req)

      expect(response.statusCode).toBe(200)
      expect(parseResponse(response)).toStrictEqual(res)
    })

    // FixMe https://github.com/turkerdev/fastify-type-provider-zod/issues/16
    it.skip.each(tests)('returns 500 for incorrect response', async () => {
      const response = await app.inject().get('/incorrect')

      expect(response.statusCode).toBe(500)
      expect(response.json()).toMatchInlineSnapshot()
    })
  })

  describe('correctly replaces date in stringified response', () => {
    let app: FastifyInstance
    beforeAll(async () => {
      const REPLY_SCHEMA = z.object({
        createdAt: z.date(),
      })

      app = Fastify()
      app.setValidatorCompiler(validatorCompiler)

      function replacer(key: any, value: any) {
        if (this[key] instanceof Date) {
          return { _date: this[key].toISOString() }
        }
        return value
      }

      const serializerCompiler = createSerializerCompiler({ replacer })

      app.setSerializerCompiler(serializerCompiler)

      app.after(() => {
        app.withTypeProvider<ZodTypeProvider>().route({
          method: 'GET',
          url: '/',
          schema: {
            response: {
              200: REPLY_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send({
              createdAt: new Date('2021-01-01T00:00:00Z'),
            })
          },
        })
      })

      await app.ready()
    })

    afterAll(async () => {
      await app.close()
    })

    it('returns 200 for correct response', async () => {
      const response = await app.inject().get('/')

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        createdAt: { _date: '2021-01-01T00:00:00.000Z' },
      })
    })
  })
})
