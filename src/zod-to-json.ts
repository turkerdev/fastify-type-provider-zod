import type {
  $ZodDate,
  $ZodUndefined,
  $ZodUnion,
  JSONSchema,
  RegistryToJSONSchemaParams,
} from 'zod/v4/core'
import { $ZodRegistry, $ZodType, toJSONSchema } from 'zod/v4/core'
import type { SchemaRegistryMeta } from './registry'
import { getReferenceUri } from './utils'

const SCHEMA_REGISTRY_ID_PLACEHOLDER = '__SCHEMA__ID__PLACEHOLDER__'
const SCHEMA_URI_PLACEHOLDER = '__SCHEMA__PLACEHOLDER__'

function isZodDate(entity: unknown): entity is $ZodDate {
  return entity instanceof $ZodType && entity._zod.def.type === 'date'
}

function isZodUnion(entity: unknown): entity is $ZodUnion {
  return entity instanceof $ZodType && entity._zod.def.type === 'union'
}

function isZodUndefined(entity: unknown): entity is $ZodUndefined {
  return entity instanceof $ZodType && entity._zod.def.type === 'undefined'
}

const getOverride = (
  ctx: {
    zodSchema: $ZodType
    jsonSchema: JSONSchema.BaseSchema
  },
  io: 'input' | 'output',
) => {
  if (isZodUnion(ctx.zodSchema)) {
    // Filter unrepresentable types in unions
    // TODO: Should be fixed upstream and not merged in this plugin.
    // Remove when passed: https://github.com/colinhacks/zod/pull/5013
    ctx.jsonSchema.anyOf = ctx.jsonSchema.anyOf?.filter((schema) => Object.keys(schema).length > 0)
  }

  if (isZodDate(ctx.zodSchema)) {
    // Allow dates to be represented as strings in output schemas
    if (io === 'output') {
      ctx.jsonSchema.type = 'string'
      ctx.jsonSchema.format = 'date-time'
    }
  }

  if (isZodUndefined(ctx.zodSchema)) {
    // Allow undefined to be represented as null in output schemas
    if (io === 'output') {
      ctx.jsonSchema.type = 'null'
    }
  }
}

export type ZodToJsonConfig = {} & Omit<
  RegistryToJSONSchemaParams,
  'io' | 'metadata' | 'cycles' | 'reused' | 'uri'
>

const deleteInvalidProperties: (
  schema: JSONSchema.BaseSchema,
) => Omit<JSONSchema.BaseSchema, 'id' | '$schema'> = (schema) => {
  const object = { ...schema }

  delete object.id
  delete object.$schema

  // ToDo added in newer zod
  delete object.$id

  return object
}

export const zodSchemaToJson: (
  zodSchema: $ZodType,
  registry: $ZodRegistry<SchemaRegistryMeta>,
  io: 'input' | 'output',
  config: ZodToJsonConfig,
) => ReturnType<typeof deleteInvalidProperties> = (zodSchema, registry, io, config) => {
  /**
   * Checks whether the provided schema is registered in the given registry.
   * If it is present and has an `id`, it can be referenced as component.
   *
   * @see https://github.com/turkerdev/fastify-type-provider-zod/issues/173
   */
  const schemaRegistryEntry = registry.get(zodSchema)
  if (schemaRegistryEntry?.id) {
    return { $ref: getReferenceUri(schemaRegistryEntry.id) }
  }

  /**
   * Unfortunately, at the time of writing, there is no way to generate a schema with `$ref`
   * using `toJSONSchema` and a zod schema.
   *
   * As a workaround, we create a zod registry containing only the specific schema we want to convert.
   *
   * @see https://github.com/colinhacks/zod/issues/4281
   */
  const tempRegistry = new $ZodRegistry<SchemaRegistryMeta>()
  tempRegistry.add(zodSchema, { id: SCHEMA_REGISTRY_ID_PLACEHOLDER })

  const {
    schemas: { [SCHEMA_REGISTRY_ID_PLACEHOLDER]: result },
  } = toJSONSchema(tempRegistry, {
    ...config,
    io,
    target: config.target,
    metadata: registry,
    unrepresentable: config.unrepresentable ?? 'any',
    cycles: 'ref',
    reused: 'inline',
    /**
     * The uri option only allows customizing the base path of the `$ref`, and it automatically appends a path to it.
     * As a workaround, we set a placeholder that looks something like this.
     * @see jsonSchemaReplaceRef
     * @see https://github.com/colinhacks/zod/issues/4750
     */
    uri: () => SCHEMA_URI_PLACEHOLDER,
    override: config.override ?? ((ctx) => getOverride(ctx, io)),
  })

  const jsonSchema = deleteInvalidProperties(result)

  /**
   * Replace the previous generated placeholders with the final `$ref` value
   */
  return JSON.parse(JSON.stringify(jsonSchema), (__key, value) => {
    if (typeof value === 'string' && value.startsWith(SCHEMA_URI_PLACEHOLDER)) {
      return getReferenceUri(value.slice(SCHEMA_URI_PLACEHOLDER.length))
    }
    return value
  }) as typeof result
}

export const zodRegistryToJson: (
  registry: $ZodRegistry<SchemaRegistryMeta>,
  io: 'input' | 'output',
  config: ZodToJsonConfig,
) => Record<string, JSONSchema.BaseSchema> = (registry, io, config) => {
  const result = toJSONSchema(registry, {
    ...config,
    io,
    target: config.target,
    metadata: registry,
    unrepresentable: config.unrepresentable ?? 'any',
    cycles: 'ref',
    reused: 'inline',
    uri: (id) => getReferenceUri(id),
    override: config.override ?? ((ctx) => getOverride(ctx, io)),
  }).schemas

  const jsonSchemas: Record<string, JSONSchema.BaseSchema> = {}
  for (const id in result) {
    jsonSchemas[id] = deleteInvalidProperties(result[id])
  }

  return jsonSchemas
}
