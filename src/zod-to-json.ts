import type { z } from 'zod'
import { type Options, zodToJsonSchema } from 'zod-to-json-schema'

export type ZodToJsonSchemaOptions = Partial<Omit<Options<'openApi3'>, 'target' | '$refStrategy'>>

const zodToJsonSchemaOptions = {
  target: 'openApi3',
  $refStrategy: 'none',
} satisfies Partial<Options<'openApi3'>>

export const convertZodToJsonSchema = (
  zodSchema: z.ZodTypeAny,
  options?: ZodToJsonSchemaOptions,
) => {
  return zodToJsonSchema(zodSchema, { ...options, ...zodToJsonSchemaOptions })
}
