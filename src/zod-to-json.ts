import { z } from 'zod/v4'

const uri = (id: string) => `#/components/schemas/${id}`

export const zodSchemaToJson = (
  schema: z.ZodType,
  registry: z.core.$ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => {
  return z.toJSONSchema(schema as z.ZodType, {
    io,
    unrepresentable: 'any',
    external: {
      registry,
      uri,
      defs: {},
    },
  })
}

export const zodRegistryToJson = (
  registry: z.core.$ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => {
  return z.toJSONSchema(registry, {
    io,
    unrepresentable: 'any',
    uri,
    external: {
      registry,
      uri,
      defs: {},
    },
  }).schemas
}
