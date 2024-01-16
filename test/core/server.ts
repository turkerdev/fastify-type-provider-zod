/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-nocheck

import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import mercurius from 'mercurius';
import z from 'zod';

import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from '../../src/index';

const makeServer = async (): Promise<FastifyInstance> => {
  const fastify = Fastify();

  fastify.setValidatorCompiler(validatorCompiler());
  fastify.setSerializerCompiler(serializerCompiler);

  await fastify.register(require('@fastify/swagger'), {
    mode: 'dynamic',
    exposeRoute: true,
    openapi: {
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
  });

  const schema = `
  type Query {
    add(x: Int, y: Int): Int
  }
`;

  const resolvers = {
    Query: {
      add: async (_, { x, y }) => x + y,
    },
  };

  fastify.register(mercurius, {
    schema,
    resolvers,
    ide: true,
  });

  fastify.route({
    method: 'GET',
    url: '/test-valid-serialization',
    schema: {
      querystring: z.object({
        value: z.string(),
      }),
      response: {
        200: z.object({
          toto: z.string().describe('should return ok'),
        }),
      },
    },
    handler: (req, res) => {
      res.send({ toto: 'ok' });
    },
  });

  fastify.route({
    method: 'GET',
    url: '/test-error-serialization',
    schema: {
      querystring: z.object({
        value: z.string(),
      }),
      response: {
        200: z.object({
          toto: z.number().describe('should return ok'),
        }),
      },
    },
    handler: (req, res) => {
      res.send({ toto: 'ok' });
    },
  });

  fastify.route({
    method: 'GET',
    url: '/test-valid-number',
    schema: {
      querystring: z.object({
        value: z.number(),
      }),
      response: {
        200: z.object({
          toto: z.string().describe('should return ok'),
        }),
      },
    },
    handler: (req, res) => {
      res.send({ toto: 'ok' });
    },
  });

  return fastify;
};

export default makeServer;
