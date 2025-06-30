import type { $ZodDate, $ZodRegistry, JSONSchema } from 'zod/v4/core'
import { $ZodType, toJSONSchema } from 'zod/v4/core'

const getSchemaId = (id: string, io: 'input' | 'output') => {
  return io === 'input' ? `${id}Input` : id
}

const getReferenceUri = (id: string, io: 'input' | 'output') => {
  return `#/components/schemas/${getSchemaId(id, io)}`
}

function isZodDate(entity: unknown): entity is $ZodDate {
  return entity instanceof $ZodType && entity._zod.def.type === 'date'
}

const getOverride = (
  ctx: {
    zodSchema: $ZodType
    jsonSchema: JSONSchema.BaseSchema
  },
  io: 'input' | 'output',
) => {
  if (io === 'output') {
    // Allow dates to be represented as strings in output schemas
    if (isZodDate(ctx.zodSchema)) {
      ctx.jsonSchema.type = 'string'
      ctx.jsonSchema.format = 'date-time'
    }
  }
}

const deleteInvalidProperties: (
  schema: JSONSchema.BaseSchema,
) => Omit<JSONSchema.BaseSchema, 'id' | '$schema'> = (schema) => {
  const object = { ...schema }

  delete object.id
  delete object.$schema

  return object
}

export const zodSchemaToJson: (
  zodSchema: $ZodType,
  registry: $ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => ReturnType<typeof deleteInvalidProperties> = (zodSchema, registry, io) => {
  // @ts-expect-error external has been removed from the types of zod
  const result = toJSONSchema(zodSchema, {
    io,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    metadata: registry,
    external: {
      registry,
      uri: (id: string) => getReferenceUri(id, io),
      defs: {},
    },
    override: (ctx) => getOverride(ctx, io),
  })

  const jsonSchema = deleteInvalidProperties(result)

  return jsonSchema
}

export const zodRegistryToJson: (
  registry: $ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => Record<string, JSONSchema.BaseSchema> = (registry, io) => {
  // @ts-expect-error external has been removed from the types of zod
  const result = toJSONSchema(registry, {
    io,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    uri: (id) => getReferenceUri(id, io),
    metadata: registry,
    external: {
      registry,
      uri: (id: string) => getReferenceUri(id, io),
      defs: {},
    },
    override: (ctx) => getOverride(ctx, io),
  }).schemas

  const jsonSchemas: Record<string, JSONSchema.BaseSchema> = {}

  for (const id in result) {
    jsonSchemas[getSchemaId(id, io)] = deleteInvalidProperties(result[id])
  }

  return jsonSchemas
}
