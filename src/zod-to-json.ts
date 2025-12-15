import { z } from 'zod/v4'
import type { $ZodDate, $ZodUndefined, $ZodUnion, JSONSchema } from 'zod/v4/core'
import { type $ZodRegistry, $ZodType, toJSONSchema } from 'zod/v4/core'

type JSONSchemaTarget = 'draft-2020-12' | 'openapi-3.0'

const getReferenceUri = (id: string) => {
  return `#/components/schemas/${id}`
}

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

export const getJSONSchemaTarget = (version = '3.0.0'): JSONSchemaTarget => {
  if (version.startsWith('3.0')) {
    return 'openapi-3.0'
  }

  return 'draft-2020-12'
}

export const zodSchemaToJson: (
  zodSchema: $ZodType,
  registry: $ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
  target: JSONSchemaTarget,
) => ReturnType<typeof deleteInvalidProperties> = (zodSchema, registry, io, target) => {
  const schemaRegistryEntry = registry.get(zodSchema)

  /**
   * Checks whether the provided schema is registered in the given registry.
   * If it is present and has an `id`, it can be referenced as component.
   *
   * @see https://github.com/turkerdev/fastify-type-provider-zod/issues/173
   */
  if (schemaRegistryEntry?.id) {
    return { $ref: getReferenceUri(schemaRegistryEntry.id) }
  }

  const result = z.toJSONSchema(zodSchema, {
    metadata: registry,
    io,
    target,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    override: (ctx) => getOverride(ctx, io),
  })

  const jsonSchema = { ...result }
  delete jsonSchema.id

  // Helper to normalize whatever Zod put after the placeholder into just the ID

  return jsonSchema
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
