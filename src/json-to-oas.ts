import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { JSONSchema } from 'zod/v4/core'

type OASVersion = '3.0' | '3.1'

export const getOASVersion = (documentObject: {
  openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document>
}): OASVersion => {
  const openapiVersion = documentObject.openapiObject.openapi || '3.0.3'

  if (openapiVersion.startsWith('3.1')) {
    return '3.1'
  }

  if (openapiVersion.startsWith('3.0')) {
    return '3.0'
  }

  throw new Error('Unsupported OpenAPI document object')
}

export const jsonSchemaToOAS_3_0 = (jsonSchema: JSONSchema.BaseSchema): OpenAPIV3.SchemaObject => {
  const clone: any = { ...jsonSchema }

  if (clone.type === 'null') {
    clone.nullable = true
    delete clone.type
    clone.enum = [null]
  }

  if (Array.isArray(clone.prefixItems)) {
    const tuple = clone.prefixItems as JSONSchema.BaseSchema[]

    clone.minItems ??= tuple.length
    clone.maxItems ??= tuple.length

    clone.items = {
      oneOf: tuple.map(jsonSchemaToOAS_3_0),
    }

    delete clone.prefixItems
  }

  if ('const' in clone && clone.const !== undefined) {
    clone.enum = [clone.const]
    delete clone.const
  }

  if (typeof clone.exclusiveMinimum === 'number') {
    clone.minimum = clone.exclusiveMinimum
    clone.exclusiveMinimum = true
  }
  if (typeof clone.exclusiveMaximum === 'number') {
    clone.maximum = clone.exclusiveMaximum
    clone.exclusiveMaximum = true
  }

  for (const key of [
    '$schema',
    '$id',
    'unevaluatedProperties',
    'dependentSchemas',
    'patternProperties',
    'propertyNames',
    'contentEncoding',
    'contentMediaType',
  ]) {
    delete clone[key]
  }

  const recursive = (v: any): any =>
    Array.isArray(v) ? v.map(jsonSchemaToOAS_3_0) : jsonSchemaToOAS_3_0(v)

  if (clone.properties) {
    for (const [k, v] of Object.entries(clone.properties)) {
      clone.properties![k] = jsonSchemaToOAS_3_0(v as any)
    }
  }

  if (clone.items && !Array.isArray(clone.items)) {
    clone.items = recursive(clone.items)
  }

  for (const key of ['allOf', 'anyOf', 'oneOf', 'not', 'then', 'else', 'if', 'contains']) {
    if (clone[key]) {
      clone[key] = recursive(clone[key])
    }
  }

  return clone as OpenAPIV3.SchemaObject
}

const jsonSchemaToOAS_3_1 = (jsonSchema: JSONSchema.BaseSchema): OpenAPIV3_1.SchemaObject => {
  return jsonSchema as OpenAPIV3_1.SchemaObject
}

export const jsonSchemaToOAS = (
  jsonSchema: JSONSchema.BaseSchema,
  oasVersion: OASVersion,
): OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject => {
  switch (oasVersion) {
    case '3.0':
      return jsonSchemaToOAS_3_0(jsonSchema)
    case '3.1':
      return jsonSchemaToOAS_3_1(jsonSchema)
    default:
      throw new Error(`Unsupported OpenAPI version: ${oasVersion}`)
  }
}
