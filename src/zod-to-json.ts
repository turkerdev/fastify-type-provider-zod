import type { z } from 'zod/v4'
import { $ZodRegistry, toJSONSchema } from 'zod/v4/core'

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
  /**
   * Unfortunately, at the time of writing, there is no way to generate a schema with `$ref`
   * using `toJSONSchema` and a zod schema.
   *
   * As a workaround, we create a zod registry containing only the specific schema we want to convert.
   *
   * @see https://github.com/colinhacks/zod/issues/4281
   */
  const tempID = 'GEN'
  const tempRegistry = new $ZodRegistry<{ id?: string }>()
  tempRegistry.add(zodSchema, { id: tempID })

  const {
    schemas: { [tempID]: result },
  } = toJSONSchema(tempRegistry, {
    metadata: registry,
    io,
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
    uri: () => `__SCHEMA__PLACEHOLDER__`,

    override: (ctx) => getOverride(ctx, io),
  })

  const jsonSchema = deleteInvalidProperties(result)

  /**
   * Replace the previous generated placeholders with the final `$ref` value
   */
  const jsonSchemaReplaceRef = JSON.stringify(jsonSchema).replaceAll(
    /"__SCHEMA__PLACEHOLDER__\#\/\$defs\/(.+?)"/g,
    (_, id) => `"${getReferenceUri(id, io)}"`,
  )

  return JSON.parse(jsonSchemaReplaceRef)
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
