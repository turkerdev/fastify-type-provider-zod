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

import { createValidationError, InvalidSchemaError, ResponseSerializationError } from './errors';
import { resolveRefs } from './ref';
import { convertZodToJsonSchema } from './zod-to-json';

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
  output: this['input'] extends z.ZodTypeAny ? z.infer<this['input']> : unknown;
}

interface Schema extends FastifySchema {
  hide?: boolean;
}

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
        transformed[prop] = convertZodToJsonSchema(zodSchema);
      }
    }

    if (response) {
      transformed.response = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const prop in response as any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schema = resolveSchema((response as any)[prop]);

        const transformedResponse = convertZodToJsonSchema(schema);
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
  ({ schemas }: { schemas: Record<string, z.ZodTypeAny> }) =>
  (
    input:
      | { swaggerObject: Partial<OpenAPIV2.Document> }
      | { openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document> },
  ) => {
    if ('swaggerObject' in input) {
      console.warn('This package currently does not support component references for Swagger 2.0');
      return input.swaggerObject;
    }

    return resolveRefs(input.openapiObject, schemas);
  };

export const validatorCompiler: FastifySchemaCompiler<z.ZodTypeAny> =
  ({ schema, method, url }) =>
  (data) => {
    const result = schema.safeParse(data);
    if (result.error) {
      return { error: createValidationError(result.error, method, url) as unknown as Error };
    }

    return { value: result.data };
  };

function resolveSchema(maybeSchema: z.ZodTypeAny | { properties: z.ZodTypeAny }): z.ZodTypeAny {
  if ('safeParse' in maybeSchema) {
    return maybeSchema;
  }
  if ('properties' in maybeSchema) {
    return maybeSchema.properties;
  }
  throw new InvalidSchemaError(JSON.stringify(maybeSchema));
}

export const serializerCompiler: FastifySerializerCompiler<
  z.ZodTypeAny | { properties: z.ZodTypeAny }
> =
  ({ schema: maybeSchema, method, url }) =>
  (data) => {
    const schema = resolveSchema(maybeSchema);

    const result = schema.safeParse(data);
    if (result.error) {
      throw new ResponseSerializationError(result.error, method, url);
    }

    return JSON.stringify(result.data);
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
