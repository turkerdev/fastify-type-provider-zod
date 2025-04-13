import type { SwaggerTransform, SwaggerTransformObject } from '@fastify/swagger'
import type {
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifySchema,
  FastifySchemaCompiler,
  FastifyTypeProvider,
  RawServerBase,
  RawServerDefault,
} from 'fastify'
import type { FastifySerializerCompiler } from 'fastify/types/schema'
import { z } from 'zod'

import { InvalidSchemaError, ResponseSerializationError, createValidationError } from './errors'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FreeformRecord = Record<string, any>

const defaultSkipList = [
  '/documentation/',
  '/documentation/initOAuth',
  '/documentation/json',
  '/documentation/uiConfig',
  '/documentation/yaml',
  '/documentation/*',
  '/documentation/static/*',
]

export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this['schema'] extends z.ZodTypeAny ? z.output<this['schema']> : unknown
  serializer: this['schema'] extends z.ZodTypeAny ? z.input<this['schema']> : unknown
}

interface Schema extends FastifySchema {
  hide?: boolean
}

type CreateJsonSchemaTransformOptions = {
  skipList?: readonly string[]
  schemaRegistry?: z.core.$ZodRegistry<{ id?: string | undefined }>
}

export const createJsonSchemaTransform = ({
  skipList = defaultSkipList,
  schemaRegistry = z.globalRegistry,
}: CreateJsonSchemaTransformOptions): SwaggerTransform<Schema> => {
  return ({ schema, url }) => {
    if (!schema) {
      return {
        schema,
        url,
      }
    }

    const { response, headers, querystring, body, params, hide, ...rest } = schema

    const transformed: FreeformRecord = {}

    if (skipList.includes(url) || hide) {
      transformed.hide = true
      return { schema: transformed, url }
    }

    const zodSchemas: FreeformRecord = { headers, querystring, body, params }

    for (const prop in zodSchemas) {
      const zodSchema = zodSchemas[prop]
      if (zodSchema) {
        transformed[prop] = z.toJSONSchema(zodSchema, {
          external: {
            registry: schemaRegistry,
            uri: (id: string) => `#/components/schemas/${id}`,
            defs: {},
          },
        })
      }
    }

    if (response) {
      transformed.response = {}

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const prop in response as any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zodSchema = resolveSchema((response as any)[prop])

        const transformedResponse = z.toJSONSchema(zodSchema, {
          external: {
            registry: schemaRegistry,
            uri: (id: string) => `#/components/schemas/${id}`,
            defs: {},
          },
        })
        transformed.response[prop] = transformedResponse
      }
    }

    for (const prop in rest) {
      const meta = rest[prop as keyof typeof rest]
      if (meta) {
        transformed[prop] = meta
      }
    }

    return { schema: transformed, url }
  }
}

export const jsonSchemaTransform = createJsonSchemaTransform({})

type CreateJsonSchemaTransformObjectOptions = {
  schemaRegistry?: z.core.$ZodRegistry<{ id?: string | undefined }>
}

export const createJsonSchemaTransformObject =
  ({
    schemaRegistry = z.globalRegistry,
  }: CreateJsonSchemaTransformObjectOptions): SwaggerTransformObject =>
  (input) => {
    if ('swaggerObject' in input) {
      console.warn('This package currently does not support component references for Swagger 2.0')
      return input.swaggerObject
    }

    const { schemas } = z.toJSONSchema(schemaRegistry, {
      uri: (id: string) => `#/components/schemas/${id}`,
      external: {
        registry: schemaRegistry,
        uri: (id: string) => `#/components/schemas/${id}`,
        defs: {},
      },
    })

    return {
      ...input.openapiObject,
      components: {
        ...input.openapiObject.components,
        schemas: {
          ...input.openapiObject.components?.schemas,
          ...schemas,
        },
      },
    } as ReturnType<SwaggerTransformObject>
  }

export const jsonSchemaTransformObject = createJsonSchemaTransformObject({})

export const validatorCompiler: FastifySchemaCompiler<z.ZodTypeAny> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data)
    if (result.error) {
      return { error: createValidationError(result.error) as unknown as Error }
    }

    return { value: result.data }
  }

function resolveSchema(maybeSchema: z.ZodTypeAny | { properties: z.ZodTypeAny }): z.ZodTypeAny {
  if ('safeParse' in maybeSchema) {
    return maybeSchema
  }
  if ('properties' in maybeSchema) {
    return maybeSchema.properties
  }
  throw new InvalidSchemaError(JSON.stringify(maybeSchema))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReplacerFunction = (this: any, key: string, value: any) => any

export type ZodSerializerCompilerOptions = {
  replacer?: ReplacerFunction
}

export const createSerializerCompiler =
  (
    options?: ZodSerializerCompilerOptions,
  ): FastifySerializerCompiler<z.ZodTypeAny | { properties: z.ZodTypeAny }> =>
  ({ schema: maybeSchema, method, url }) =>
  (data) => {
    const schema = resolveSchema(maybeSchema)

    const result = schema.safeParse(data)
    if (result.error) {
      throw new ResponseSerializationError(method, url, { cause: result.error })
    }

    return JSON.stringify(result.data, options?.replacer)
  }

export const serializerCompiler = createSerializerCompiler({})

/**
 * FastifyPluginCallbackZod with Zod automatic type inference
 *
 * @example
 * ```typescript
 * import { FastifyPluginCallbackZod } from "fastify-type-provider-zod"
 *
 * const plugin: FastifyPluginCallbackZod = (fastify, options, done) => {
 *   done()
 * }
 * ```
 */
export type FastifyPluginCallbackZod<
  Options extends FastifyPluginOptions = Record<never, never>,
  Server extends RawServerBase = RawServerDefault,
> = FastifyPluginCallback<Options, Server, ZodTypeProvider>

/**
 * FastifyPluginAsyncZod with Zod automatic type inference
 *
 * @example
 * ```typescript
 * import { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
 *
 * const plugin: FastifyPluginAsyncZod = async (fastify, options) => {
 * }
 * ```
 */
export type FastifyPluginAsyncZod<
  Options extends FastifyPluginOptions = Record<never, never>,
  Server extends RawServerBase = RawServerDefault,
> = FastifyPluginAsync<Options, Server, ZodTypeProvider>
