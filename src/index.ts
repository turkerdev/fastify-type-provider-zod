import type { FastifySchemaCompiler, FastifyTypeProvider, FastifySchema } from 'fastify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import type { z, ZodAny, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface ZodTypeProvider extends FastifyTypeProvider {
  output: this['input'] extends ZodTypeAny ? z.infer<this['input']> : never;
}

export const jsonSchemaTransform = ({ schema, url }: { schema: FastifySchema; url: string }) => {
  const { params, body, querystring, headers, response } = schema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformed: Record<string, any> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (params) transformed.params = zodToJsonSchema(params as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (body) transformed.body = zodToJsonSchema(body as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (querystring) transformed.querystring = zodToJsonSchema(querystring as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (headers) transformed.headers = zodToJsonSchema(headers as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (response) transformed.response = zodToJsonSchema(response as any);

  return { schema: transformed, url };
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

export const serializerCompiler: FastifySerializerCompiler<ZodAny> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data);
    if (result.success) {
      return JSON.stringify(result.data);
    }
    throw Error("Response doesn't match the schema");
  };
