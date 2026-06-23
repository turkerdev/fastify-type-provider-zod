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

/**
 * Identity keywords that zod stamps on the root of a generated schema. They are not
 * meaningful in the emitted document (we reference schemas through `$ref`), so they are
 * removed for every target.
 */
const IDENTITY_KEYWORDS = ['id', '$id', '$schema']

/**
 * Keywords that zod's `openapi-3.0` target can still emit (e.g. `contentEncoding` for
 * `z.base64()`) but that are not part of the OpenAPI 3.0 schema subset. OpenAPI 3.1 /
 * JSON Schema 2020-12 (`draft-2020-12`) does allow them, so they are only removed for 3.0.
 */
const OAS_3_0_INVALID_KEYWORDS = [
  'unevaluatedProperties',
  'dependentSchemas',
  'patternProperties',
  'propertyNames',
  'contentEncoding',
  'contentMediaType',
]

const getRemoveKeys = (target: RegistryToJSONSchemaParams['target']): Set<string> => {
  return new Set(
    target === 'openapi-3.0'
      ? [...IDENTITY_KEYWORDS, ...OAS_3_0_INVALID_KEYWORDS]
      : IDENTITY_KEYWORDS,
  )
}

// Keywords whose value is a single subschema.
const SINGLE_SCHEMA_KEYWORDS = ['items', 'additionalProperties', 'not']
// Keywords whose value is an array of subschemas.
const SCHEMA_LIST_KEYWORDS = ['allOf', 'anyOf', 'oneOf']

/**
 * Removes `removeKeys` from a generated JSON schema, recursing only into positions that
 * actually hold subschemas (`properties` values, `items`, `additionalProperties`,
 * `allOf`/`anyOf`/`oneOf`, `not`). It deliberately does not walk by key name everywhere:
 * a user property called `id` lives as a key inside `properties` and must be preserved,
 * while the `id` keyword on a schema object must be dropped.
 */
const sanitizeSchema = (value: unknown, removeKeys: Set<string>): any => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSchema(entry, removeKeys))
  }
  if (value === null || typeof value !== 'object') {
    return value
  }

  const result: Record<string, any> = {}
  for (const [key, child] of Object.entries(value)) {
    if (removeKeys.has(key)) {
      continue
    }

    if (key === 'properties' && child !== null && typeof child === 'object') {
      result[key] = Object.fromEntries(
        Object.entries(child).map(([name, schema]) => [name, sanitizeSchema(schema, removeKeys)]),
      )
    } else if (SINGLE_SCHEMA_KEYWORDS.includes(key)) {
      result[key] =
        child !== null && typeof child === 'object' ? sanitizeSchema(child, removeKeys) : child
    } else if (SCHEMA_LIST_KEYWORDS.includes(key)) {
      result[key] = Array.isArray(child)
        ? child.map((entry) => sanitizeSchema(entry, removeKeys))
        : child
    } else {
      result[key] = child
    }
  }

  return result
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

export type ZodToJsonConfig = Omit<
  RegistryToJSONSchemaParams,
  'io' | 'metadata' | 'cycles' | 'reused' | 'uri'
>

export const zodSchemaToJson: (
  zodSchema: $ZodType,
  registry: $ZodRegistry<SchemaRegistryMeta>,
  io: 'input' | 'output',
  config: ZodToJsonConfig,
) => JSONSchema.BaseSchema = (zodSchema, registry, io, config) => {
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
    metadata: registry,
    unrepresentable: config.unrepresentable ?? 'any',
    cycles: 'ref',
    reused: 'inline',
    /**
     * The uri option only allows customizing the base path of the `$ref`, and it automatically appends a path to it.
     * As a workaround, we set a placeholder that looks something like this.
     * @see https://github.com/colinhacks/zod/issues/4750
     */
    uri: () => SCHEMA_URI_PLACEHOLDER,
    override: config.override ?? ((ctx) => getOverride(ctx, io)),
  })

  /**
   * Remove identity/target-incompatible keywords first. This also drops the root `$id`
   * that zod sets to the uri placeholder, so the ref replacement below only ever sees the
   * placeholders that stand for real component references.
   */
  const sanitized = sanitizeSchema(result, getRemoveKeys(config.target))

  /**
   * Replace the placeholder `$ref` values with the final component reference.
   */
  return JSON.parse(JSON.stringify(sanitized), (_key, value) =>
    typeof value === 'string' && value.startsWith(SCHEMA_URI_PLACEHOLDER)
      ? getReferenceUri(value.slice(SCHEMA_URI_PLACEHOLDER.length))
      : value,
  ) as JSONSchema.BaseSchema
}

export const zodRegistryToJson: (
  registry: $ZodRegistry<SchemaRegistryMeta>,
  io: 'input' | 'output',
  config: ZodToJsonConfig,
) => Record<string, JSONSchema.BaseSchema> = (registry, io, config) => {
  const result = toJSONSchema(registry, {
    ...config,
    io,
    metadata: registry,
    unrepresentable: config.unrepresentable ?? 'any',
    cycles: 'ref',
    reused: 'inline',
    uri: (id) => getReferenceUri(id),
    override: config.override ?? ((ctx) => getOverride(ctx, io)),
  }).schemas

  const removeKeys = getRemoveKeys(config.target)

  const jsonSchemas: Record<string, JSONSchema.BaseSchema> = {}
  for (const id in result) {
    jsonSchemas[id] = sanitizeSchema(result[id], removeKeys)
  }

  return jsonSchemas
}
