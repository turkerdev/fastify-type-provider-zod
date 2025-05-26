import { z } from 'zod/v4'

const getSchemaId = (id: string, io: 'input' | 'output') => {
  return io === 'input' ? `${id}Input` : id
}

const getReferenceUri = (id: string, io: 'input' | 'output') => {
  return `#/components/schemas/${getSchemaId(id, io)}`
}

const deleteInvalidProperties = (schema: z.core.JSONSchema.BaseSchema) => {
  const object = { ...schema }

  delete object.id
  delete object.$schema

  return object
}

export const zodSchemaToJson = (
  zodSchema: z.ZodType,
  registry: z.core.$ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => {
  const result = z.toJSONSchema(zodSchema, {
    io,
    unrepresentable: 'any',
    external: {
      registry,
      uri: (id) => getReferenceUri(id, io),
      defs: {},
    },
  })

  const jsonSchema = deleteInvalidProperties(result)

  return jsonSchema
}

export const zodRegistryToJson = (
  registry: z.core.$ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => {
  const result = z.toJSONSchema(registry, {
    io,
    unrepresentable: 'any',
    uri: (id) => getReferenceUri(id, io),
    external: {
      registry,
      uri: (id) => getReferenceUri(id, io),
      defs: {},
    },
  }).schemas

  const jsonSchemas: Record<string, z.core.JSONSchema.BaseSchema> = {}

  for (const id in result) {
    jsonSchemas[getSchemaId(id, io)] = deleteInvalidProperties(result[id])
  }

  return jsonSchemas
}
