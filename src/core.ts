import type { SwaggerTransform, SwaggerTransformObject } from '@fastify/swagger'
import type {
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifySchema,
  FastifySchemaCompiler,
  FastifySerializerCompiler,
  FastifyTypeProvider,
  RawServerBase,
  RawServerDefault,
} from 'fastify'
import type { $ZodRegistry, output } from 'zod/v4/core'
import { $ZodType, globalRegistry, safeEncode, safeParse } from 'zod/v4/core'
import { createValidationError, InvalidSchemaError, ResponseSerializationError } from './errors'
import {
  createIORegistriesProvider,
  generateIORegistries,
  type SchemaRegistryMeta,
} from './registry'
import { assertIsOpenAPIObject, getJSONSchemaTarget } from './utils'
import { type ZodToJsonConfig, zodRegistryToJson, zodSchemaToJson } from './zod-to-json'

type FreeformRecord = Record<string, any>

type ContentTypeResponse = {
  description?: string
  content: Record<string, { schema: $ZodType }>
}

const isContentTypeResponse = (maybeSchema: unknown): maybeSchema is ContentTypeResponse => {
  return (
    typeof maybeSchema === 'object' &&
    maybeSchema !== null &&
    'content' in maybeSchema &&
    typeof maybeSchema.content === 'object' &&
    maybeSchema.content !== null
  )
}

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
  validator: this['schema'] extends $ZodType ? output<this['schema']> : unknown
  serializer: this['schema'] extends $ZodType ? output<this['schema']> : unknown
}

interface Schema extends FastifySchema {
  hide?: boolean
}

type CreateJsonSchemaTransformOptions = {
  skipList?: readonly string[]
  schemaRegistry?: $ZodRegistry<SchemaRegistryMeta>
  zodToJsonConfig?: ZodToJsonConfig
}

export const createJsonSchemaTransform = ({
  skipList = defaultSkipList,
  schemaRegistry = globalRegistry,
  zodToJsonConfig = {},
}: CreateJsonSchemaTransformOptions): SwaggerTransform<Schema> => {
  const getIORegistries = createIORegistriesProvider(schemaRegistry)

  return (document) => {
    assertIsOpenAPIObject(document)

    const { schema, url } = document

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

    const target = getJSONSchemaTarget(document.openapiObject.openapi)
    const config = {
      target,
      ...zodToJsonConfig,
    }

    const { inputRegistry, outputRegistry } = getIORegistries()

    const zodSchemas: FreeformRecord = { headers, querystring, body, params }

    for (const prop in zodSchemas) {
      const zodSchema = zodSchemas[prop]
      if (zodSchema) {
        transformed[prop] = zodSchemaToJson(zodSchema, inputRegistry, 'input', config)
      }
    }

    if (response) {
      transformed.response = {}

      for (const prop in response) {
        const responseSchema = (response as any)[prop]

        if (isContentTypeResponse(responseSchema)) {
          const responseObj: FreeformRecord = {}

          if (responseSchema.description) {
            responseObj.description = responseSchema.description
          }

          responseObj.content = {}

          for (const [contentType, { schema: maybeSchema }] of Object.entries(
            responseSchema.content,
          )) {
            const zodSchema = resolveSchema(maybeSchema)
            responseObj.content[contentType] = {
              schema: zodSchemaToJson(zodSchema, outputRegistry, 'output', config),
            }
          }

          transformed.response[prop] = responseObj
          continue
        }

        const zodSchema = resolveSchema(responseSchema)
        transformed.response[prop] = zodSchemaToJson(zodSchema, outputRegistry, 'output', config)
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

export const jsonSchemaTransform: SwaggerTransform<Schema> = createJsonSchemaTransform({})

type CreateJsonSchemaTransformObjectOptions = {
  schemaRegistry?: $ZodRegistry<SchemaRegistryMeta>
  zodToJsonConfig?: ZodToJsonConfig
}

export const createJsonSchemaTransformObject =
  ({
    schemaRegistry = globalRegistry,
    zodToJsonConfig = {},
  }: CreateJsonSchemaTransformObjectOptions): SwaggerTransformObject =>
  (document) => {
    assertIsOpenAPIObject(document)

    const target = getJSONSchemaTarget(document.openapiObject.openapi)
    const config = {
      target,
      ...zodToJsonConfig,
    }

    const { inputRegistry, outputRegistry } = generateIORegistries(schemaRegistry)
    const inputSchemas = zodRegistryToJson(inputRegistry, 'input', config)
    const outputSchemas = zodRegistryToJson(outputRegistry, 'output', config)

    return {
      ...document.openapiObject,
      components: {
        ...document.openapiObject.components,
        schemas: {
          ...document.openapiObject.components?.schemas,
          ...inputSchemas,
          ...outputSchemas,
        },
      },
    } as ReturnType<SwaggerTransformObject>
  }

export const jsonSchemaTransformObject: SwaggerTransformObject = createJsonSchemaTransformObject({})

export const validatorCompiler: FastifySchemaCompiler<$ZodType> =
  ({ schema }) =>
  (data) => {
    const result = safeParse(schema, data)
    if (result.error) {
      return { error: createValidationError(result.error) as unknown as Error }
    }

    return { value: result.data }
  }

function resolveSchema(maybeSchema: $ZodType | { properties: $ZodType }): $ZodType {
  if (maybeSchema instanceof $ZodType) {
    return maybeSchema
  }
  if ('properties' in maybeSchema && maybeSchema.properties instanceof $ZodType) {
    return maybeSchema.properties
  }
  throw new InvalidSchemaError(JSON.stringify(maybeSchema))
}

type ReplacerFunction = (this: any, key: string, value: any) => any

export type ZodSerializerCompilerOptions = {
  replacer?: ReplacerFunction
}

export const createSerializerCompiler =
  (
    options?: ZodSerializerCompilerOptions,
  ): FastifySerializerCompiler<$ZodType | { properties: $ZodType }> =>
  ({ schema: maybeSchema, method, url }) => {
    const schema = resolveSchema(maybeSchema)
    return (data) => {
      const result = safeEncode(schema, data)
      if (result.error) {
        throw new ResponseSerializationError(method, url, {
          cause: result.error,
        })
      }

      return JSON.stringify(result.data, options?.replacer)
    }
  }

export const serializerCompiler: ReturnType<typeof createSerializerCompiler> =
  createSerializerCompiler({})

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
