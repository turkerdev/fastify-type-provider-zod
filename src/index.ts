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
import type { ZodAny, ZodTypeAny, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformSchema(responseElement: any) {
  const schema = resolveSchema(responseElement);
  return zodToJsonSchema(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema as any,
    zodToJsonSchemaOptions,
  );
}

/**
 * Takes a 'content' response element that defines different response schemas for different
 * response content types and returns a new version of that content element with the schemas
 * converted from zod schemas to json schemas.
 *
 * @param responseElementContent a 'content' element, nested under a response code, that defines different schemas for
 * the different content types that the endpoint can return. For example:
 * <pre>
 * {
 *   'application/json': { schema: some-zod-schema },
 *   'text/csv': { schema: some-zod-schema }
 * }
 * </pre>
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformMultipleSchemas: any = (responseElementContent: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any = {};
  for (const property in responseElementContent) {
    content[property] = { ...responseElementContent[property], schema: transformSchema(responseElementContent[property].schema) };
  }
  return content;
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
      for (const responseCode in response as any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseElement = (response as any)[responseCode];
        if (responseElement.content) {
          transformed.response[responseCode] = { ...responseElement, content: transformMultipleSchemas(responseElement.content) };
        } else {
          transformed.response[responseCode] = transformSchema(responseElement);
        }
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

export class ResponseValidationError extends Error {
  public details: FreeformRecord;

  constructor(validationResult: FreeformRecord) {
    super("Response doesn't match the schema");
    this.name = 'ResponseValidationError';
    this.details = validationResult.error;
  }
}

export const serializerCompiler: FastifySerializerCompiler<ZodAny | { properties: ZodAny }> =
  ({ schema: maybeSchema }) =>
  (data) => {
    const schema: Pick<ZodAny, 'safeParse'> = resolveSchema(maybeSchema);

    const result = schema.safeParse(data);
    if (result.success) {
      return JSON.stringify(result.data);
    }

    throw new ResponseValidationError(result);
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
