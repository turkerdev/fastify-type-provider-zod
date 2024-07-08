import type {
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifySchema,
  FastifySchemaCompiler,
  FastifyTypeProvider,
  RawServerBase,
  RawServerDefault,
} from 'fastify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { ResponseValidationError } from './ResponseValidationError';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FreeformRecord = Record<string, any>;

const defaultSkipList = [
  '/documentation/',
  '/documentation/initOAuth',
  '/documentation/json',
  '/documentation/uiConfig',
  '/documentation/yaml',
  '/documentation/*',
  '/documentation/static/*',
];

export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this['schema'] extends z.ZodTypeAny ? z.output<this['schema']> : unknown;
  serializer: this['schema'] extends z.ZodTypeAny ? z.input<this['schema']> : unknown;
}

interface Schema extends FastifySchema {
  hide?: boolean;
}

const zodToJsonSchemaOptions = {
  target: 'openApi3',
  $refStrategy: 'none',
} as const;

export const jsonSchemaTransformSchemas = (inputSchemas: Record<string, z.ZodTypeAny>) => {
  const schemas: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject> = {};
  for (const key in inputSchemas)
    schemas[key] = zodToJsonSchema(inputSchemas[key], zodToJsonSchemaOptions);

  return schemas;
};

export const createJsonSchemaTransform = ({ skipList }: { skipList: readonly string[] }) => {
  return ({ schema, url }: { schema: Schema; url: string }) => {
    if (!schema) {
      return {
        schema,
        url,
      };
    }

    const { response, headers, querystring, body, params, hide, ...rest } = schema;

    const transformed: FreeformRecord = {};

    if (skipList.includes(url) || hide) {
      transformed.hide = true;
      return { schema: transformed, url };
    }

    const zodSchemas: FreeformRecord = { headers, querystring, body, params };

    for (const prop in zodSchemas) {
      const zodSchema = zodSchemas[prop];
      if (zodSchema) {
        transformed[prop] = zodToJsonSchema(zodSchema, zodToJsonSchemaOptions);
      }
    }

    if (response) {
      transformed.response = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const prop in response as any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schema = resolveSchema((response as any)[prop]);

        const transformedResponse = zodToJsonSchema(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          schema as any,
          zodToJsonSchemaOptions,
        );
        transformed.response[prop] = transformedResponse;
      }
    }

    for (const prop in rest) {
      const meta = rest[prop as keyof typeof rest];
      if (meta) {
        transformed[prop] = meta;
      }
    }

    return { schema: transformed, url };
  };
};

export const jsonSchemaTransform = createJsonSchemaTransform({
  skipList: defaultSkipList,
});

export const jsonSchemaTransformObject = (
  input:
    | { swaggerObject: Partial<OpenAPIV2.Document> }
    | { openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document> },
) => {
  if ('swaggerObject' in input) {
    console.warn('This package currently does not support component references for Swagger 2.0');
    return input.swaggerObject;
  }

  const componentMapVK = new Map<string, string>();
  Object.entries(input.openapiObject.components?.schemas ?? {}).forEach(([key, value]) =>
    componentMapVK.set(JSON.stringify(value), key),
  );

  const RANDOM_COMPONENT_KEY_PREFIX = Math.random().toString(36).substring(2);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const componentReplacer = (key: string, value: any) => {
    if (typeof value !== 'object') return value;

    if (key.startsWith(RANDOM_COMPONENT_KEY_PREFIX)) return value;

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

  const document = {
    ...input.openapiObject,
    components: {
      ...input.openapiObject.components,
      schemas: Object.fromEntries(
        [...componentMapVK].map(([value, key]) => [
          RANDOM_COMPONENT_KEY_PREFIX + key,
          JSON.parse(value),
        ]),
      ),
    },
  };
  const stringified = JSON.stringify(document, componentReplacer).replace(
    new RegExp(RANDOM_COMPONENT_KEY_PREFIX, 'g'),
    '',
  );
  const parsed = JSON.parse(stringified);

  return parsed;
};

export const validatorCompiler: FastifySchemaCompiler<z.ZodAny> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { value: result.data };
    } else {
      return { error: result.error };
    }
  };

const resolveSchema = (
  maybeSchema: z.ZodAny | { properties: z.ZodAny },
): Pick<z.ZodAny, 'safeParse'> => {
  if ('safeParse' in maybeSchema) {
    return maybeSchema;
  }
  if ('properties' in maybeSchema) {
    return maybeSchema.properties;
  }
  throw new Error(`Invalid schema passed: ${JSON.stringify(maybeSchema)}`);
};

export const serializerCompiler: FastifySerializerCompiler<z.ZodAny | { properties: z.ZodAny }> =
  ({ schema: maybeSchema, method, url }) =>
  (data) => {
    const schema: Pick<z.ZodAny, 'safeParse'> = resolveSchema(maybeSchema);

    const result = schema.safeParse(data);
    if (result.success) {
      return JSON.stringify(result.data);
    }

    throw new ResponseValidationError(result, method, url);
  };

/**
 * FastifyPluginCallbackZod with Zod automatic type inference
 *
 * @example
 * ```typescript
 * import { FastifyPluginCallbackZod } from "fastify-type-provider-zod"
 *
 * const plugin: FastifyPluginCallbackZod = (fastify, options, done) => {
 *   done()
 * }
 * ```
 */
export type FastifyPluginCallbackZod<
  Options extends FastifyPluginOptions = Record<never, never>,
  Server extends RawServerBase = RawServerDefault,
> = FastifyPluginCallback<Options, Server, ZodTypeProvider>;

/**
 * FastifyPluginAsyncZod with Zod automatic type inference
 *
 * @example
 * ```typescript
 * import { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
 *
 * const plugin: FastifyPluginAsyncZod = async (fastify, options) => {
 * }
 * ```
 */
export type FastifyPluginAsyncZod<
  Options extends FastifyPluginOptions = Record<never, never>,
  Server extends RawServerBase = RawServerDefault,
> = FastifyPluginAsync<Options, Server, ZodTypeProvider>;
