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

describe('transformer', () => {
  it('generates types for fastify-swagger correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    app.register(fastifySwagger, {
      openapi: {
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
      seed: z.number().min(1),
      password: z.string().max(32),
    })

    const UNAUTHORIZED_SCHEMA = z.object({
      required_role: z.literal('admin'),
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

  it('should not generate ref', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    app.register(fastifySwagger, {
      openapi: {
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
      openapi: {
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

  it('should generate input and output schemas correctly', async () => {
    const app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    const schemaRegistry = z.registry<{ id: string }>()

    const ID_SCHEMA = z.string().default('1')

    app.register(fastifySwagger, {
      openapi: {
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
})
