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
import type { ZodAny, ZodTypeAny, z } from 'zod';
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
  output: this['input'] extends ZodTypeAny ? z.infer<this['input']> : unknown;
}

interface Schema extends FastifySchema {
  hide?: boolean;
}

const zodToJsonSchemaOptions = {
  target: 'openApi3',
  $refStrategy: 'none',
} as const;

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

export const createJsonSchemaTransformObject =
  ({ schemas: zodSchemas }: { schemas: Record<string, z.ZodTypeAny> }) =>
  (
    input:
      | { swaggerObject: Partial<OpenAPIV2.Document> }
      | { openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document> },
  ) => {
    if ('swaggerObject' in input) {
      console.warn('This package currently does not support component references for Swagger 2.0');
      return input.swaggerObject;
    }

    const schemas: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject> = {};
    for (const key in zodSchemas)
      schemas[key] = zodToJsonSchema(zodSchemas[key], zodToJsonSchemaOptions);

    const document = {
      ...input.openapiObject,
      components: {
        ...input.openapiObject.components,
        schemas: {
          ...input.openapiObject.components?.schemas,
          ...schemas,
        },
      },
    };

    const componentMapVK = new Map<string, string>();
    Object.entries(schemas).forEach(([key, value]) =>
      componentMapVK.set(JSON.stringify(value), key),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function componentReplacer(this: any, key: string, value: any) {
      if (typeof value !== 'object') return value;

      // Check if the parent is the schemas object, if so, return the value as is
      if (this === document.components.schemas) return value;

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
    }

    return JSON.parse(JSON.stringify(document, componentReplacer));
  };

export const validatorCompiler: FastifySchemaCompiler<ZodAny> =
  ({ schema }) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data): any => {
    try {
      return { value: schema.parse(data) };
    } catch (error) {
      return { error };
    }
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasOwnProperty<T, K extends PropertyKey>(obj: T, prop: K): obj is T & Record<K, any> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function resolveSchema(maybeSchema: ZodAny | { properties: ZodAny }): Pick<ZodAny, 'safeParse'> {
  if (hasOwnProperty(maybeSchema, 'safeParse')) {
    return maybeSchema;
  }
  if (hasOwnProperty(maybeSchema, 'properties')) {
    return maybeSchema.properties;
  }
  throw new Error(`Invalid schema passed: ${JSON.stringify(maybeSchema)}`);
}

export const serializerCompiler: FastifySerializerCompiler<ZodAny | { properties: ZodAny }> =
  ({ schema: maybeSchema, method, url }) =>
  (data) => {
    const schema: Pick<ZodAny, 'safeParse'> = resolveSchema(maybeSchema);

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
