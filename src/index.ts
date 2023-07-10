import Ajv from 'ajv';
import type { FastifySchema, FastifySchemaCompiler, FastifyTypeProvider } from 'fastify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import type { z, ZodAny, ZodError, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { fromZodError } from 'zod-validation-error';

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
  output: this['input'] extends ZodTypeAny ? z.infer<this['input']> : never;
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
      if (zodSchema && zodSchema.safeParse) {
        transformed[prop] = zodToJsonSchema(zodSchema, zodToJsonSchemaOptions);
      }
    }

    if (response) {
      transformed.response = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const prop in response as any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schema = resolveSchema((response as any)[prop]);
        //@ts-ignore
        if (schema && schema.safeParse) {
          const transformedResponse = zodToJsonSchema(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            schema as any,
            zodToJsonSchemaOptions,
          );
          transformed.response[prop] = transformedResponse;
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

const ajv = new Ajv({
  removeAdditional: 'all',
  useDefaults: true,
  coerceTypes: 'array',
});

//@ts-ignore
export const validatorCompiler: FastifySchemaCompiler<ZodAny> = ({ schema }) => {
  //@ts-ignore
  if (schema.safeParse) {
    return (data) => {
      try {
        schema.parse(data);
        return { value: data };
      } catch (e) {
        const validationError = fromZodError(e as ZodError);
        return { error: validationError };
      }
    };
  }

  return ajv.compile(schema);
};

export class ResponseValidationError extends Error {
  public details: FreeformRecord;

  constructor(validationResult: FreeformRecord) {
    super("Response doesn't match the schema");
    this.name = 'ResponseValidationError';
    this.details = validationResult.error;
  }
}
export const serializerCompiler: FastifySerializerCompiler<ZodAny | { properties: ZodAny }> = ({
  schema: maybeSchema,
}) => {
  const schema: Pick<ZodAny, 'safeParse'> = resolveSchema(maybeSchema);

  if (schema.safeParse) {
    return (data) => {
      const result = schema.safeParse(data);
      if (result.success) {
        return JSON.stringify(result.data);
      }

      throw new ResponseValidationError(result);
    };
  }

  return (data) => JSON.stringify(data);
};
