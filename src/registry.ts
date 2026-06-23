import { $ZodRegistry, type $ZodType } from 'zod/v4/core'

/**
 * NOTE: This module reaches into the `_map` and `_idmap` fields of `$ZodRegistry`.
 * Zod does not expose a public way to iterate a registry or to seed a registry with
 * a fallback lookup, so we depend on these internals. All such access is kept in this
 * file so an upgrade that changes the registry representation only has to be fixed here.
 */

export type SchemaRegistryMeta = {
  id?: string | undefined
  [key: string]: unknown
}

export type IORegistries = {
  inputRegistry: $ZodRegistry<SchemaRegistryMeta>
  outputRegistry: $ZodRegistry<SchemaRegistryMeta>
}

const getSchemaId = (id: string, io: 'input' | 'output'): string => {
  return io === 'input' ? `${id}Input` : id
}

// A WeakMap that falls back to another WeakMap when a key is not found, this is to ensure nested metadata is properly resolved
class WeakMapWithFallback extends WeakMap<$ZodType, SchemaRegistryMeta> {
  constructor(private fallback: WeakMap<$ZodType, SchemaRegistryMeta>) {
    super()
  }

  get(key: $ZodType): SchemaRegistryMeta | undefined {
    return super.get(key) ?? this.fallback.get(key)
  }

  has(key: $ZodType): boolean {
    return super.has(key) || this.fallback.has(key)
  }
}

const copyRegistry = (
  baseRegistry: $ZodRegistry<SchemaRegistryMeta>,
  idReplaceFn: (id: string) => string,
): $ZodRegistry<SchemaRegistryMeta> => {
  const copy = new $ZodRegistry<SchemaRegistryMeta>()

  copy._map = new WeakMapWithFallback(baseRegistry._map)

  baseRegistry._idmap.forEach((schema, id) => {
    copy.add(schema, {
      ...baseRegistry._map.get(schema),
      id: idReplaceFn(id),
    })
  })

  return copy
}

export const generateIORegistries = (
  baseRegistry: $ZodRegistry<SchemaRegistryMeta>,
): IORegistries => {
  const inputRegistry = copyRegistry(baseRegistry, (id) => getSchemaId(id, 'input'))
  const outputRegistry = copyRegistry(baseRegistry, (id) => getSchemaId(id, 'output'))

  // Detect colliding schemas (an input id colliding with an output id)
  inputRegistry._idmap.forEach((_, id) => {
    if (outputRegistry._idmap.has(id)) {
      throw new Error(
        `Collision detected for schema "${id}". An input and an output schema resolve to the same component name.`,
      )
    }
  })

  return { inputRegistry, outputRegistry }
}

/**
 * Returns a memoized accessor for the derived input/output registries.
 *
 * The per-route transform runs once for every documented route, but the derived
 * registries only depend on the contents of the base registry. Rebuilding them on
 * every call is wasted work, so we cache the result and only recompute when the
 * number of registered schemas changes (e.g. schemas added before a later
 * `app.swagger()` call).
 */
export const createIORegistriesProvider = (
  baseRegistry: $ZodRegistry<SchemaRegistryMeta>,
): (() => IORegistries) => {
  let cache: { size: number; registries: IORegistries } | undefined

  return () => {
    const size = baseRegistry._idmap.size
    if (!cache || cache.size !== size) {
      cache = { size, registries: generateIORegistries(baseRegistry) }
    }
    return cache.registries
  }
}
