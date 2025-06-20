import type { z } from 'zod/v4'
import { JSONSchemaGenerator, toJSONSchema } from 'zod/v4/core'

const getSchemaId = (id: string, io: 'input' | 'output') => {
  return io === 'input' ? `${id}Input` : id
}

const getReferenceUri = (id: string, io: 'input' | 'output') => {
  return `#/components/schemas/${getSchemaId(id, io)}`
}

function isZodDate(entity: unknown): entity is z.ZodDate {
  // @ts-expect-error this is expected
  return entity.constructor.name === 'ZodDate'
}

const getOverride = (
  ctx: {
    zodSchema: z.core.$ZodType
    jsonSchema: z.core.JSONSchema.BaseSchema
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
  schema: z.core.JSONSchema.BaseSchema,
) => Omit<z.core.JSONSchema.BaseSchema, 'id' | '$schema'> = (schema) => {
  const object = { ...schema }

  delete object.id
  delete object.$schema

  return object
}

export const zodSchemaToJson: (
  zodSchema: z.ZodType,
  registry: z.core.$ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => ReturnType<typeof deleteInvalidProperties> = (zodSchema, registry, io) => {
  const jsonSchemaGenerator = new JSONSchemaGenerator({
    metadata: registry,
    unrepresentable: 'any',
    override: (ctx) => getOverride(ctx, io),
    io,
  })

  jsonSchemaGenerator.process(zodSchema)

  const result = jsonSchemaGenerator.emit(zodSchema, {
    cycles: 'ref',
    reused: 'inline',
    external: {
      registry,
      uri: (id) => getReferenceUri(id, io),
      defs: {},
    },
  })

  const jsonSchema = deleteInvalidProperties(result)

  return jsonSchema
}

export const zodRegistryToJson: (
  registry: z.core.$ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => Record<string, z.core.JSONSchema.BaseSchema> = (registry, io) => {
  const result = toJSONSchema(registry, {
    io,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    uri: (id) => getReferenceUri(id, io),
    override: (ctx) => getOverride(ctx, io),
  }).schemas

  const jsonSchemas: Record<string, z.core.JSONSchema.BaseSchema> = {}

  for (const id in result) {
    jsonSchemas[getSchemaId(id, io)] = deleteInvalidProperties(result[id])
  }

  return jsonSchemas
}
