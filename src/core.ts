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
import type { $ZodRegistry, input, output } from 'zod/v4/core'
import { $ZodType, globalRegistry, safeParse } from 'zod/v4/core'
import { createValidationError, InvalidSchemaError, ResponseSerializationError } from './errors'
import { getOASVersion, jsonSchemaToOAS } from './json-to-oas'
import { zodRegistryToJson, zodSchemaToJson } from './zod-to-json'

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
  validator: this['schema'] extends $ZodType ? output<this['schema']> : unknown
  serializer: this['schema'] extends $ZodType ? input<this['schema']> : unknown
}

interface Schema extends FastifySchema {
  hide?: boolean
}

type CreateJsonSchemaTransformOptions = {
  skipList?: readonly string[]
  schemaRegistry?: $ZodRegistry<{ id?: string | undefined }>
}

export const createJsonSchemaTransform = ({
  skipList = defaultSkipList,
  schemaRegistry = globalRegistry,
}: CreateJsonSchemaTransformOptions): SwaggerTransform<Schema> => {
  return (input) => {
    if ('swaggerObject' in input) {
      throw new Error('OpenAPI 2.0 is not supported')
    }

    const { schema, url } = input

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

    const oasVersion = getOASVersion(input)

    for (const prop in zodSchemas) {
      const zodSchema = zodSchemas[prop]
      if (zodSchema) {
        const jsonSchema = zodSchemaToJson(zodSchema, schemaRegistry, 'input')
        const oasSchema = jsonSchemaToOAS(jsonSchema, oasVersion)

        transformed[prop] = oasSchema
      }
    }

    if (response) {
      transformed.response = {}

      for (const prop in response as any) {
        const zodSchema = resolveSchema((response as any)[prop])
        const jsonSchema = zodSchemaToJson(zodSchema, schemaRegistry, 'output')

        // Check is the JSON schema is null then return as it is since fastify-swagger will handle it
        if (jsonSchema.type === 'null') {
          transformed.response[prop] = jsonSchema
          continue
        }

        const oasSchema = jsonSchemaToOAS(jsonSchema, oasVersion)

        transformed.response[prop] = oasSchema
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
  schemaRegistry?: $ZodRegistry<{ id?: string | undefined }>
}

export const createJsonSchemaTransformObject =
  ({
    schemaRegistry = globalRegistry,
  }: CreateJsonSchemaTransformObjectOptions): SwaggerTransformObject =>
  (input) => {
    if ('swaggerObject' in input) {
      throw new Error('OpenAPI 2.0 is not supported')
    }

    const oasVersion = getOASVersion(input)

    const inputSchemas = zodRegistryToJson(schemaRegistry, 'input')
    const outputSchemas = zodRegistryToJson(schemaRegistry, 'output')

    for (const key in outputSchemas) {
      if (inputSchemas[key]) {
        throw new Error(
          `Collision detected for schema "${key}". The is already an input schema with the same name.`,
        )
      }
    }

    const jsonSchemas = {
      ...inputSchemas,
      ...outputSchemas,
    }

    const oasSchemas = Object.fromEntries(
      Object.entries(jsonSchemas).map(([key, value]) => [key, jsonSchemaToOAS(value, oasVersion)]),
    )

    return {
      ...input.openapiObject,
      components: {
        ...input.openapiObject.components,
        schemas: {
          ...input.openapiObject.components?.schemas,
          ...oasSchemas,
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
  ({ schema: maybeSchema, method, url }) =>
  (data) => {
    const schema = resolveSchema(maybeSchema)

    const result = safeParse(schema, data)
    if (result.error) {
      throw new ResponseSerializationError(method, url, { cause: result.error })
    }

    return JSON.stringify(result.data, options?.replacer)
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
