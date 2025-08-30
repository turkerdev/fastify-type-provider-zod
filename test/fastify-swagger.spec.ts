import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
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

  it('should allow specification of Zod target for draft-4 compatibility', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    // Use draft-4 target for OpenAPI 3.0.x compatibility
    const transform = createJsonSchemaTransform({
      zodToJsonConfig: { target: 'draft-4' },
    })

    app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'TestApi',
          version: '1.0.0',
        },
      },
      transform,
    })

    // Test schema with nullable field (problematic in draft-2020-12 but should work with draft-4)
    const TEST_SCHEMA = z.object({
      id: z.string(),
      name: z.string().nullable(),
      metadata: z.record(z.string(), z.string()),
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

    const openapiObject = app.swagger()

    // Check that nullable fields are handled properly for draft-4
    const bodySchema =
      // @ts-expect-error - requestBody is not typed
      openapiObject.paths?.['/test']?.post?.requestBody?.content?.['application/json']?.schema

    // Check that the name field has the correct anyOf structure for nullable string
    const nameField = bodySchema?.properties?.name
    expect(nameField.anyOf).toHaveLength(2)

    // Check first anyOf option: type string
    expect(nameField.anyOf[0]).toEqual({ type: 'string' })

    // Check second anyOf option: nullable with null enum
    expect(nameField.anyOf[1]).toEqual({
      nullable: true,
      enum: [null],
    })
  })
})
