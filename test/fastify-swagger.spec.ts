import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
import { validate as validate31 } from '@readme/openapi-parser'
import Fastify from 'fastify'
import * as validator from 'oas-validator'
import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'

import type { ZodTypeProvider } from '../src/core'
import {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from '../src/core'

const OPENAPI_ROOT = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'SampleApi',
      description: 'Sample backend service',
      version: '1.0.0',
    },
    servers: [],
  },
}

describe('transformer', () => {
  it('generates types for fastify-swagger correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: jsonSchemaTransform,
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    const LOGIN_SCHEMA = z.object({
      username: z.string().max(32).describe('someDescription'),
      seed: z.number().min(1).max(1000),
      code: z.number().lt(10000),
      password: z.string().max(32),
    })

    const UNAUTHORIZED_SCHEMA = z.object({
      required_role: z.literal('admin').nullable(),
      scopes: z.tuple([z.literal('read'), z.literal('write'), z.null()]),
    })

    app.after(() => {
      app
        .withTypeProvider<ZodTypeProvider>()
        .route({
          method: 'POST',
          url: '/login',
          schema: {
            description: 'login route',
            summary: 'login your account',
            consumes: ['application/json'],
            deprecated: false,
            hide: false,
            tags: ['auth'],
            externalDocs: { url: 'https://google.com', description: 'check google' },
            body: LOGIN_SCHEMA,
            response: {
              200: z.string(),
              401: UNAUTHORIZED_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send('ok')
          },
        })
        .route({
          method: 'POST',
          url: '/no-schema',
          schema: undefined,
          handler: (_req, res) => {
            res.send('ok')
          },
        })
        .route({
          method: 'DELETE',
          url: '/delete',
          schema: {
            description: 'delete route',
            response: {
              204: z.undefined().describe('Empty response'),
            },
          },
          handler: (_req, res) => {
            res.status(204).send()
          },
        })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })

  it('generates types for fastify-swagger with OAS 3.1.0 correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: createJsonSchemaTransform({
        zodToJsonConfig: {
          target: 'draft-2020-12',
        },
      }),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    const LOGIN_SCHEMA = z.object({
      username: z.string().max(32).describe('someDescription'),
      seed: z.number().min(1).max(1000),
      code: z.number().lt(10000),
      password: z.string().max(32),
    })

    const UNAUTHORIZED_SCHEMA = z.object({
      required_role: z.literal('admin').nullable(),
      scopes: z.tuple([z.literal('read'), z.literal('write'), z.null()]),
    })

    app.after(() => {
      app
        .withTypeProvider<ZodTypeProvider>()
        .route({
          method: 'POST',
          url: '/login',
          schema: {
            description: 'login route',
            summary: 'login your account',
            consumes: ['application/json'],
            deprecated: false,
            hide: false,
            tags: ['auth'],
            externalDocs: { url: 'https://google.com', description: 'check google' },
            body: LOGIN_SCHEMA,
            response: {
              200: z.string(),
              401: UNAUTHORIZED_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send('ok')
          },
        })
        .route({
          method: 'POST',
          url: '/no-schema',
          schema: undefined,
          handler: (_req, res) => {
            res.send('ok')
          },
        })
        .route({
          method: 'DELETE',
          url: '/delete',
          schema: {
            description: 'delete route',
            response: {
              204: z.undefined().describe('Empty response'),
            },
          },
          handler: (_req, res) => {
            res.status(204).send()
          },
        })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    const validationResult = await validate31(openApiSpec)
    expect(validationResult.valid).toBe(true)
  })

  it('should fail generating types for fastify-swagger Swagger 2.0 correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    app.register(fastifySwagger, {
      swagger: {
        swagger: '2.0',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
      },
      transform: jsonSchemaTransform,
    })

    const LOGIN_SCHEMA = z.object({
      username: z.string().max(32).describe('someDescription'),
      seed: z.number().min(1).max(1000),
      code: z.number().lt(10000),
      password: z.string().max(32),
    })

    const UNAUTHORIZED_SCHEMA = z.object({
      required_role: z.literal('admin').nullable(),
      scopes: z.tuple([z.literal('read'), z.literal('write'), z.null()]),
    })

    app.after(() => {
      app
        .withTypeProvider<ZodTypeProvider>()
        .route({
          method: 'POST',
          url: '/login',
          schema: {
            description: 'login route',
            summary: 'login your account',
            consumes: ['application/json'],
            deprecated: false,
            hide: false,
            tags: ['auth'],
            externalDocs: { url: 'https://google.com', description: 'check google' },
            body: LOGIN_SCHEMA,
            response: {
              200: z.string(),
              401: UNAUTHORIZED_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send('ok')
          },
        })
        .route({
          method: 'POST',
          url: '/no-schema',
          schema: undefined,
          handler: (_req, res) => {
            res.send('ok')
          },
        })
        .route({
          method: 'DELETE',
          url: '/delete',
          schema: {
            description: 'delete route',
            response: {
              204: z.undefined().describe('Empty response'),
            },
          },
          handler: (_req, res) => {
            res.status(204).send()
          },
        })
    })

    await app.ready()

    expect(() => app.swagger()).toThrowError('OpenAPI 2.0 is not supported')
  })

  it('should not generate ref', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: jsonSchemaTransform,
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    const TOKEN_SCHEMA = z.string().length(12)

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          body: z.object({
            access_token: TOKEN_SCHEMA,
            refresh_token: TOKEN_SCHEMA,
            metadata: z.record(z.string(), z.string()),
            age: z.optional(z.nullable(z.coerce.number())),
          }),
        },
        handler: (_req, res) => {
          res.send('ok')
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    await validator.validate(openApiSpec, {})
    expect(openApiSpec).toMatchSnapshot()
  })

  it('should generate ref correctly using z.registry', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    const TOKEN_SCHEMA = z.string().length(12)

    const schemaRegistry = z.registry<{ id: string }>()

    schemaRegistry.add(TOKEN_SCHEMA, {
      id: 'Token',
    })

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry }),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          body: z.object({
            access_token: TOKEN_SCHEMA,
            refresh_token: TOKEN_SCHEMA,
          }),
        },
        handler: (_req, res) => {
          res.send('ok')
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    await validator.validate(openApiSpec, {})
    expect(openApiSpec).toMatchSnapshot()
  })

  it('should generate ref correctly using global registry', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    const TOKEN_SCHEMA = z.string().length(12)

    z.globalRegistry.add(TOKEN_SCHEMA, {
      id: 'Token',
      description: 'Token description',
    })

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: jsonSchemaTransform,
      transformObject: jsonSchemaTransformObject,
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          body: z.object({
            access_token: TOKEN_SCHEMA,
            refresh_token: TOKEN_SCHEMA,
          }),
        },
        handler: (_req, res) => {
          res.send('ok')
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    z.globalRegistry.remove(TOKEN_SCHEMA)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })

  it('should generate nested and circular refs correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    const GROUP_SCHEMA = z.object({
      id: z.string(),
      get subgroups() {
        return z.array(GROUP_SCHEMA)
      },
    })

    const USER_SCHEMA = z.object({
      id: z.string(),
      groups: z.array(GROUP_SCHEMA),
    })

    const schemaRegistry = z.registry<{ id: string }>()

    schemaRegistry.add(GROUP_SCHEMA, {
      id: 'Group',
    })
    schemaRegistry.add(USER_SCHEMA, {
      id: 'User',
    })

    app.register(fastifySwagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry }),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          response: {
            200: z.object({
              groups: z.array(GROUP_SCHEMA),
              user: USER_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            groups: [],
            user: {
              id: '1',
              groups: [],
            },
          })
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })

  it('should generate nullable arrays correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    const USER_SCHEMA = z.object({
      id: z.string(),
      values: z.array(z.string()).nullable(),
    })

    app.register(fastifySwagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({}),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          response: {
            200: z.object({
              user: USER_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            user: {
              id: '1',
              values: null,
            },
          })
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })

  it('should handle records within records', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    const USER_SCHEMA = z.object({
      id: z.string(),
      files: z.record(z.string(), z.record(z.string(), z.string())),
    })

    app.register(fastifySwagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({}),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          response: {
            200: z.object({
              user: USER_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            user: {
              id: '1',
              values: null,
            },
          })
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })

  it('should generate input and output schemas correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    const schemaRegistry = z.registry<{ id: string }>()

    const ID_SCHEMA = z.string().default('1')

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry }),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/',
        schema: {
          querystring: z.object({
            id: ID_SCHEMA,
          }),
          response: {
            200: z.object({
              id: ID_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            id: undefined,
          })
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })

  it('should generate referenced input and output schemas correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    const schemaRegistry = z.registry<{ id: string }>()

    const USER_SCHEMA = z.object({
      id: z.string().default('1'),
      createdAt: z.date(),
    })

    schemaRegistry.add(USER_SCHEMA, {
      id: 'User',
    })

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry }),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/',
        schema: {
          body: z.object({
            user: USER_SCHEMA,
          }),
          response: {
            200: z.object({
              user: USER_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            user: {
              id: undefined,
              createdAt: new Date(0),
            },
          })
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })

  it('should generate referenced input and output schemas correctly when referencing a registered schema', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    const schemaRegistry = z.registry<{ id: string }>()

    const USER_SCHEMA = z.object({
      id: z.string().default('1'),
      createdAt: z.date(),
    })

    schemaRegistry.add(USER_SCHEMA, { id: 'User' })

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry }),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/',
        schema: {
          body: USER_SCHEMA,
          response: { 200: USER_SCHEMA },
        },
        handler: (_, res) => {
          res.send({
            id: undefined,
            createdAt: new Date(0),
          })
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })

  it('should allow specification of Zod target to handle OpenAPI 3.1', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    // draft-2020-12 is aligned with OpenAPI 3.1.0
    const transform = createJsonSchemaTransform({
      zodToJsonConfig: { target: 'draft-2020-12' },
    })

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'TestApi',
          version: '1.0.0',
        },
      },
      transform,
    })

    const TEST_SCHEMA = z.object({
      id: z.string(),
      name: z.string().nullable(),
      metadata: z.record(z.string(), z.string()),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

    app.after(() => {
      app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/test',
        schema: {
          body: TEST_SCHEMA,
          response: {
            200: z.object({
              success: z.boolean(),
              data: TEST_SCHEMA.nullable(),
            }),
          },
        },
        handler: (_req, res) => {
          res.send({ success: true, data: null })
        },
      })
    })

    await app.ready()

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    const validationResult = await validate31(openApiSpec)
    expect(validationResult.valid).toBe(true)

    await expect(() =>
      validator.validate(openApiSpec, {}),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AssertionError: Must be an OpenAPI 3.0.x document]`,
    )
  })

  it('should generate docs for fastify-swagger with multiple response content correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    const schemaRegistry = z.registry<{ id: string }>()

    const USER_SCHEMA = z.object({
      id: z.string().default('1'),
      createdAt: z.date(),
    })

    schemaRegistry.add(USER_SCHEMA, { id: 'User' })

    // Examples from Fastify Validation-and-Serialization docs
    const DEFAULT_REPLY_SCHEMA = z.object({
      name: z.string(),
    })

    schemaRegistry.add(USER_SCHEMA, { id: 'Default' })

    const V1_REPLY_SCHEMA = z.object({
      name: z.string(),
      version: z.literal(1),
    })

    schemaRegistry.add(USER_SCHEMA, { id: 'V1' })

    const V2_REPLY_SCHEMA = z.object({
      name: z.string(),
      version: z.literal(2),
    })

    schemaRegistry.add(USER_SCHEMA, { id: 'V2' })

    // Example from original change request: https://github.com/turkerdev/fastify-type-provider-zod/pull/89
    const TEXT_REPLY_SCHEMA = z.string()

    schemaRegistry.add(USER_SCHEMA, { id: 'Text' })

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry }),
    })

    app.register(fastifySwaggerUI, {
      routePrefix: '/documentation',
    })

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
        method: 'POST',
        url: '/',
        schema: {
          body: USER_SCHEMA,
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

    const openApiSpecResponse = await app.inject().get('/documentation/json')
    const openApiSpec = JSON.parse(openApiSpecResponse.body)

    expect(openApiSpec).toMatchSnapshot()
    await validator.validate(openApiSpec, {})
  })
})
