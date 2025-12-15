import type { ZodType } from 'zod'
import type { $ZodDate, $ZodUndefined, $ZodUnion, JSONSchema } from 'zod/v4/core'
import { $ZodRegistry, $ZodType, toJSONSchema } from 'zod/v4/core'
import type { SchemaRegistryMeta } from './registry'
import { getReferenceUri, type JSONSchemaTarget } from './utils'

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
  zodSchema: ZodType,
  registry: $ZodRegistry<SchemaRegistryMeta>,
  io: 'input' | 'output',
  target: JSONSchemaTarget,
) => ReturnType<typeof deleteInvalidProperties> = (zodSchema, registry, io, target) => {
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
  const tempId = '__temp__'
  const tempRegistry = new $ZodRegistry<SchemaRegistryMeta>()
  tempRegistry.add(zodSchema, { id: tempId })

  const {
    schemas: { [tempId]: result },
  } = toJSONSchema(tempRegistry, {
    io,
    target,
    metadata: registry,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    /**
     * The uri option only allows customizing the base path of the `$ref`, and it automatically appends a path to it.
     * As a workaround, we set a placeholder that looks something like this:
     *
     * |       marker          | always added by zod | meta.id |
     * |__SCHEMA__PLACEHOLDER__|      #/$defs/       | User    |
     *
     * @example `__SCHEMA__PLACEHOLDER__#/$defs/User"`
     * @example `__SCHEMA__PLACEHOLDER__#/$defs/Group"`
     *
     * @see jsonSchemaReplaceRef
     * @see https://github.com/colinhacks/zod/issues/4750
     */
    uri: () => 'test',
    override: (ctx) => getOverride(ctx, io),
  })

  return deleteInvalidProperties(result)
}

export const zodRegistryToJson: (
  registry: $ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
  target: JSONSchemaTarget,
) => Record<string, JSONSchema.BaseSchema> = (registry, io, target) => {
  const result = toJSONSchema(registry, {
    io,
    target,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    uri: (id) => getReferenceUri(id),
    override: (ctx) => getOverride(ctx, io),
  }).schemas

  const jsonSchemas: Record<string, JSONSchema.BaseSchema> = {}
  for (const id in result) {
    jsonSchemas[id] = deleteInvalidProperties(result[id])
  }

  return jsonSchemas
}
