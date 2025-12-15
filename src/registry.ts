import { $ZodRegistry, type $ZodType } from 'zod/v4/core'

export type SchemaRegistryMeta = {
  id?: string | undefined
  [key: string]: unknown
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
  inputRegistry: $ZodRegistry<SchemaRegistryMeta>,
  idReplaceFn: (id: string) => string,
): $ZodRegistry<SchemaRegistryMeta> => {
  const outputRegistry = new $ZodRegistry<SchemaRegistryMeta>()

  outputRegistry._map = new WeakMapWithFallback(inputRegistry._map)

  inputRegistry._idmap.forEach((schema, id) => {
    outputRegistry.add(schema, {
      ...inputRegistry._map.get(schema),
      id: idReplaceFn(id),
    })
  })

  return outputRegistry
}

export const generateIORegistries = (
  baseRegistry: $ZodRegistry<SchemaRegistryMeta>,
): {
  inputRegistry: $ZodRegistry<SchemaRegistryMeta>
  outputRegistry: $ZodRegistry<SchemaRegistryMeta>
} => {
  const inputRegistry = copyRegistry(baseRegistry, (id) => getSchemaId(id, 'input'))
  const outputRegistry = copyRegistry(baseRegistry, (id) => getSchemaId(id, 'output'))

  // Detect colliding schemas
  inputRegistry._idmap.forEach((_, id) => {
    if (outputRegistry._idmap.has(id)) {
      throw new Error(
        `Collision detected for schema "${id}". There is already an input schema with the same name.`,
      )
    }
  })

  return { inputRegistry, outputRegistry }
}
