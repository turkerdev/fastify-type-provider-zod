import type { $ZodDate, $ZodUndefined, $ZodUnion, JSONSchema } from 'zod/v4/core'
import { $ZodRegistry, $ZodType, toJSONSchema } from 'zod/v4/core'

const getSchemaId = (id: string, io: 'input' | 'output') => {
  return io === 'input' ? `${id}Input` : id
}

const getReferenceUri = (id: string, io: 'input' | 'output') => {
  return `#/components/schemas/${getSchemaId(id, io)}`
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

export const zodSchemaToJson: (
  zodSchema: $ZodType,
  registry: $ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => JSONSchema.BaseSchema = (zodSchema, registry, io) => {
  const schemaRegistryEntry = registry.get(zodSchema)

  /**
   * Checks whether the provided schema is registered in the given registry.
   * If it is present and has an `id`, it can be referenced as component.
   *
   * @see https://github.com/turkerdev/fastify-type-provider-zod/issues/173
   */
  if (schemaRegistryEntry?.id) {
    return {
      $ref: getReferenceUri(schemaRegistryEntry.id, io),
    }
  }

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
    target: 'draft-2020-12',
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

  const jsonSchema = { ...result }
  delete jsonSchema.id

  /**
   * Replace the previous generated placeholders with the final `$ref` value
   */
  const jsonSchemaReplaceRef = JSON.stringify(jsonSchema).replaceAll(
    /"__SCHEMA__PLACEHOLDER__#\/\$defs\/(.+?)"/g,
    (_, id) => `"${getReferenceUri(id, io)}"`,
  )

  return JSON.parse(jsonSchemaReplaceRef) as typeof result
}

export const zodRegistryToJson: (
  registry: $ZodRegistry<{ id?: string }>,
  io: 'input' | 'output',
) => Record<string, JSONSchema.BaseSchema> = (registry, io) => {
  const result = toJSONSchema(registry, {
    target: 'draft-2020-12',
    io,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    uri: (id) => getReferenceUri(id, io),
    override: (ctx) => getOverride(ctx, io),
  }).schemas

  const jsonSchemas: Record<string, JSONSchema.BaseSchema> = {}
  for (const id in result) {
    const jsonSchema = { ...result[id] }

    delete jsonSchema.id

    jsonSchemas[getSchemaId(id, io)] = jsonSchema
  }

  return jsonSchemas
}
