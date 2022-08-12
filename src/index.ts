import type { FastifySchema, FastifySchemaCompiler, FastifyTypeProvider } from 'fastify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import type { z, ZodAny, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

const zodToJsonSchemaOptions = {
  target: 'openApi3',
} as const;

export const createJsonSchemaTransform = ({ skipList }: { skipList: readonly string[] }) => {
  return ({ schema, url }: { schema: FastifySchema; url: string }) => {
    const { params, body, querystring, headers, response } = schema;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformed: Record<string, any> = {};

    if (skipList.includes(url)) {
      transformed.hide = true;
      return { schema: transformed, url };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (params) transformed.params = zodToJsonSchema(params as any, zodToJsonSchemaOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (body) transformed.body = zodToJsonSchema(body as any, zodToJsonSchemaOptions);
    if (querystring)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformed.querystring = zodToJsonSchema(querystring as any, zodToJsonSchemaOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (headers) transformed.headers = zodToJsonSchema(headers as any, zodToJsonSchemaOptions);

    if (response) {
      transformed.response = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const prop in response as any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedResponse = zodToJsonSchema(response[prop] as any, zodToJsonSchemaOptions);
        transformed.response[prop] = transformedResponse;
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

export const serializerCompiler: FastifySerializerCompiler<ZodAny> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data);
    if (result.success) {
      return JSON.stringify(result.data);
    }
    throw Error("Response doesn't match the schema");
  };
