import { z } from 'zod/v4'

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
  // @ts-expect-error
  const result = z.toJSONSchema(zodSchema, {
    io,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
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
  registry: z.core.$ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => Record<string, z.core.JSONSchema.BaseSchema> = (registry, io) => {
  // @ts-expect-error
  const result = z.toJSONSchema(registry, {
    io,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    uri: (id) => getReferenceUri(id, io),
    external: {
      registry,
      uri: (id: string) => getReferenceUri(id, io),
      defs: {},
    },
    override: (ctx) => getOverride(ctx, io),
  }).schemas

  const jsonSchemas: Record<string, z.core.JSONSchema.BaseSchema> = {}

  for (const id in result) {
    jsonSchemas[getSchemaId(id, io)] = deleteInvalidProperties(result[id])
  }

  return jsonSchemas
}
