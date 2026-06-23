import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

type SwaggerObject = {
  swaggerObject: Partial<OpenAPIV2.Document>
}

type OpenAPIObject = {
  openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document>
}

export const assertIsOpenAPIObject: (
  obj: SwaggerObject | OpenAPIObject,
) => asserts obj is OpenAPIObject = (obj) => {
  if ('swaggerObject' in obj) {
    throw new Error('This package currently does not support component references for Swagger 2.0')
  }
}

export type JSONSchemaTarget = 'draft-2020-12' | 'openapi-3.0'

export const getReferenceUri = (input: string): string => {
  const id = input.replace(/^#\/(?:\$defs|definitions|components\/schemas)\//, '')

  if (id === '') {
    throw new Error(
      'Unable to build a component reference for an unnamed schema. ' +
        'Recursive or self-referential schemas used inline must be registered with an `id` so they can be referenced as components.',
    )
  }

  return `#/components/schemas/${id}`
}

export const getJSONSchemaTarget = (version = '3.0.0'): JSONSchemaTarget => {
  if (version.startsWith('3.0')) {
    return 'openapi-3.0'
  }

  return 'draft-2020-12'
}
