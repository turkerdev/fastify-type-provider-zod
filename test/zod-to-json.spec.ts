import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { zodRegistryToJson, zodSchemaToJson } from '../src/zod-to-json'

describe('zod-to-json', () => {
  it('composes custom overrides with built-in output normalization for inline schemas', () => {
    const CREATED_AT = z.date()

    const jsonSchema = zodSchemaToJson(
      z.object({
        createdAt: CREATED_AT,
      }),
      z.registry(),
      'output',
      {
        target: 'openapi-3.0',
        override: (ctx) => {
          if (ctx.zodSchema === CREATED_AT) {
            ctx.jsonSchema.description = 'custom override'
          }
        },
      },
    )

    expect(jsonSchema).toMatchObject({
      properties: {
        createdAt: {
          description: 'custom override',
          format: 'date-time',
          type: 'string',
        },
      },
    })
  })

  it('composes custom overrides with built-in output normalization for registered schemas', () => {
    const CREATED_AT = z.date()
    const USER_SCHEMA = z.object({
      createdAt: CREATED_AT,
    })
    const registry = z.registry<{ id: string }>()

    registry.add(USER_SCHEMA, { id: 'User' })

    const jsonSchemas = zodRegistryToJson(registry, 'output', {
      target: 'openapi-3.0',
      override: (ctx) => {
        if (ctx.zodSchema === CREATED_AT) {
          ctx.jsonSchema.description = 'custom override'
        }
      },
    })

    expect(jsonSchemas.User).toMatchObject({
      properties: {
        createdAt: {
          description: 'custom override',
          format: 'date-time',
          type: 'string',
        },
      },
    })
  })
})
