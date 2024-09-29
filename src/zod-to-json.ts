import type { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

const zodToJsonSchemaOptions = {
  target: 'openApi3',
  $refStrategy: 'none',
} as const

export const convertZodToJsonSchema = (zodSchema: z.ZodTypeAny) => {
  return zodToJsonSchema(zodSchema, zodToJsonSchemaOptions)
}
