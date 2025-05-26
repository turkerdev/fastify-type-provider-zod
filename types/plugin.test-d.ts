import type { Http2Server } from 'http2'

import type { FastifyPluginAsync, FastifyPluginCallback } from 'fastify'
import Fastify from 'fastify'
import fp from 'fastify-plugin'
import { expectType } from 'tsd'
import { z } from 'zod/v4'

import type { FastifyPluginAsyncZod, FastifyPluginCallbackZod } from '../src/core'

// Ensure the defaults of FastifyPluginAsyncZod are the same as FastifyPluginAsync
export const pluginAsyncDefaults: FastifyPluginAsync = async (fastify, options) => {
  const pluginAsyncZodDefaults: FastifyPluginAsyncZod = async (fastifyWithZod, optionsZod) => {
    expectType<(typeof fastifyWithZod)['server']>(fastify.server);
    expectType<typeof optionsZod>(options);
  };
  fastify.register(pluginAsyncZodDefaults);
};

// Ensure the defaults of FastifyPluginAsyncZod are the same as FastifyPluginCallback
export const pluginCallbackDefaults: FastifyPluginCallback = async (fastify, options) => {
  const pluginCallbackZodDefaults: FastifyPluginAsyncZod = async (fastifyWithZod, optionsZod) => {
    expectType<(typeof fastifyWithZod)['server']>(fastify.server);
    expectType<typeof optionsZod>(options);
  };

  fastify.register(pluginCallbackZodDefaults);
};

const asyncPlugin: FastifyPluginAsyncZod<{ optionA: string }, Http2Server> = async (
  fastify,
  options,
) => {
  expectType<Http2Server>(fastify.server);

  expectType<string>(options.optionA);

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
      expectType<boolean>(req.body.z);
      expectType<number>(req.body.y);
      expectType<string>(req.body.x);
    },
  );
};

const callbackPlugin: FastifyPluginCallbackZod<{ optionA: string }, Http2Server> = (
  fastify,
  options,
  done,
) => {
  expectType<Http2Server>(fastify.server);

  expectType<string>(options.optionA);

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
      expectType<boolean>(req.body.z);
      expectType<number>(req.body.y);
      expectType<string>(req.body.x);
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
  expectType<(typeof fastify)['server']>(fastify.server);
  expectType<typeof options>(options);
  expectType<{ optionA: string }>(options);
};

fp(asyncPlugin);
fp(callbackPlugin);
fp(asyncPluginHttpDefault);
