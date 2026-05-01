import Fastify from 'fastify'
import fp from 'fastify-plugin'
import { expect } from 'tstyche'
import { z } from 'zod/v4'
import type { Http2Server } from 'node:http2';
import type { FastifyPluginAsync, FastifyPluginCallback } from 'fastify';
import type { FastifyPluginAsyncZod, FastifyPluginCallbackZod } from '../src/core.ts'
import type { Server } from 'node:http'

// Ensure the defaults of FastifyPluginAsyncZod are the same as FastifyPluginAsync
export const pluginAsyncDefaults: FastifyPluginAsync = async (fastify, options) => {
  const pluginAsyncZodDefaults: FastifyPluginAsyncZod = async (fastifyWithZod, optionsZod) => {
    expect(fastifyWithZod.server).type.toBe(fastify.server);
    expect(optionsZod).type.toBe(options);
  };
  fastify.register(pluginAsyncZodDefaults);
};

// Ensure the defaults of FastifyPluginAsyncZod are the same as FastifyPluginCallback
export const pluginCallbackDefaults: FastifyPluginCallback = async (fastify, options) => {
  const pluginCallbackZodDefaults: FastifyPluginAsyncZod = async (fastifyWithZod, optionsZod) => {
    expect(fastifyWithZod.server).type.toBe(fastify.server);
    expect(optionsZod).type.toBe(options);
  };

  fastify.register(pluginCallbackZodDefaults);
};

const asyncPlugin: FastifyPluginAsyncZod<{ optionA: string }, Http2Server> = async (
  fastify,
  options,
) => {
  expect(fastify.server).type.toBe<Http2Server>();
  expect(options).type.toBe<{ optionA: string }>();

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
  expect(options).type.toBe<{ optionA: string }>();

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
  expect(fastify.server).type.toBe<Server>();
  expect(options).type.toBe<{ optionA: string }>();
};

fp(asyncPlugin);
fp(callbackPlugin);
fp(asyncPluginHttpDefault);
