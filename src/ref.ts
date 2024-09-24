import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import type { z } from 'zod';

import { convertZodToJsonSchema } from './zod-to-json';

const createComponentMap = (
  schemas: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject>,
) => {
  const map = new Map<string, string>();

  Object.entries(schemas).forEach(([key, value]) => map.set(JSON.stringify(value), key));

  return map;
};

const createComponentReplacer = (componentMapVK: Map<string, string>, schemasObject: object) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function componentReplacer(this: any, key: string, value: any) {
    if (typeof value !== 'object') return value;

    // Check if the parent is the schemas object, if so, return the value as is. This is where the schemas are defined.
    if (this === schemasObject) return value;

    const stringifiedValue = JSON.stringify(value);
    if (componentMapVK.has(stringifiedValue))
      return { $ref: `#/components/schemas/${componentMapVK.get(stringifiedValue)}` };

    if (value.nullable === true) {
      const nonNullableValue = { ...value };
      delete nonNullableValue.nullable;
      const stringifiedNonNullableValue = JSON.stringify(nonNullableValue);
      if (componentMapVK.has(stringifiedNonNullableValue))
        return {
          anyOf: [
            { $ref: `#/components/schemas/${componentMapVK.get(stringifiedNonNullableValue)}` },
          ],
          nullable: true,
        };
    }

    return value;
  };

export const resolveRefs = (
  openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document>,
  zodSchemas: Record<string, z.ZodTypeAny>,
) => {
  const schemas: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject> = {};
  for (const key in zodSchemas) {
    schemas[key] = convertZodToJsonSchema(zodSchemas[key]);
  }

  const document = {
    ...openapiObject,
    components: {
      ...openapiObject.components,
      schemas: {
        ...openapiObject.components?.schemas,
        ...schemas,
      },
    },
  };

  const componentMapVK = createComponentMap(schemas);
  const componentReplacer = createComponentReplacer(componentMapVK, document.components.schemas);

  // Using the componentReplacer function we deep check if the document has any schemas that are the same as the zod schemas provided
  // When a match is found replace them with a $ref.
  return JSON.parse(JSON.stringify(document, componentReplacer));
};
