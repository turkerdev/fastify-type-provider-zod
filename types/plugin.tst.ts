import type { Http2Server } from 'http2'

import type { FastifyPluginAsync, FastifyPluginCallback, RawServerDefault } from 'fastify'
import Fastify from 'fastify'
import fp from 'fastify-plugin'
import { expect } from 'tstyche'
import { z } from 'zod/v4'

import type { FastifyPluginAsyncZod, FastifyPluginCallbackZod } from '../src/core'

// Ensure the defaults of FastifyPluginAsyncZod are the same as FastifyPluginAsync
export const pluginAsyncDefaults: FastifyPluginAsync = async (fastify, options) => {
  const pluginAsyncZodDefaults: FastifyPluginAsyncZod = async (fastifyWithZod, optionsZod) => {
    expect(fastify.server).type.toBe<RawServerDefault>();
    expect(options).type.toBe<typeof optionsZod>();
  };
  fastify.register(pluginAsyncZodDefaults);
};

// Ensure the defaults of FastifyPluginAsyncZod are the same as FastifyPluginCallback
export const pluginCallbackDefaults: FastifyPluginCallback = async (fastify, options) => {
  const pluginCallbackZodDefaults: FastifyPluginAsyncZod = async (fastifyWithZod, optionsZod) => {
    expect(fastify.server).type.toBe<RawServerDefault>();
    expect(options).type.toBe<typeof optionsZod>();
  };

  fastify.register(pluginCallbackZodDefaults);
};

const asyncPlugin: FastifyPluginAsyncZod<{ optionA: string }, Http2Server> = async (
  fastify,
  options,
) => {
  expect(fastify.server).type.toBe<Http2Server>();

  expect(options.optionA).type.toBe<string>();

  fastify.get(
    '/',
    {
      schema: {
        body: z.object({
          x: z.string(),
          y: z.number(),
          z: z.boolean(),
        }),
      },
    },
    (req) => {
      expect(req.body.z).type.toBe<boolean>();
      expect(req.body.y).type.toBe<number>();
      expect(req.body.x).type.toBe<string>();
    },
  );
};

const callbackPlugin: FastifyPluginCallbackZod<{ optionA: string }, Http2Server> = (
  fastify,
  options,
  done,
) => {
  expect(fastify.server).type.toBe<Http2Server>();

  expect(options.optionA).type.toBe<string>();

  fastify.get(
    '/',
    {
      schema: {
        body: z.object({
          x: z.string(),
          y: z.number(),
          z: z.boolean(),
        }),
      },
    },
    (req) => {
      expect(req.body.z).type.toBe<boolean>();
      expect(req.body.y).type.toBe<number>();
      expect(req.body.x).type.toBe<string>();
    },
  );
  done();
};

const fastify = Fastify();

fastify.register(asyncPlugin, { optionA: 'test' });
fastify.register(callbackPlugin, { optionA: 'test' });

const asyncPluginHttpDefault: FastifyPluginAsyncZod<{ optionA: string }> = async (
  fastify,
  options,
) => {
  expect(fastify.server).type.toBe<RawServerDefault>();
  expect(options).type.toBe<typeof options>();
  expect(options).type.toBe<{ optionA: string }>();
};

fp(asyncPlugin);
fp(callbackPlugin);
fp(asyncPluginHttpDefault);
