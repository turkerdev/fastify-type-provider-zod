/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';
import type { FastifyInstance } from 'fastify';

import makeServer from './core/server';

let server: FastifyInstance;

describe('Fastify Type Provider Zod', () => {
  describe('Validation', () => {
    it('should be able to tell that validation is required', async () => {
      server = await makeServer();

      const response = await server.inject({
        method: 'GET',
        url: '/test-valid-serialization',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation error: Required at "value"',
      });
    });

    it('should be able to tell that validation need to have a number', async () => {
      server = await makeServer();

      const response = await server.inject({
        method: 'GET',
        url: '/test-valid-number?value=foo',
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation error: Expected number, received string at "value"',
      });
    });
  });

  describe('Serialization', () => {
    it('should return the result', async () => {
      server = await makeServer();

      const response = await server.inject({
        method: 'GET',
        url: '/test-valid-serialization?value=test',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should tell that response is not valid', async () => {
      server = await makeServer();

      const response = await server.inject({
        method: 'GET',
        url: '/test-error-serialization?value=test',
      });
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toMatchObject({
        error: 'Internal Server Error',
        message: "Response doesn't match the schema",
        statusCode: 500,
      });
    });
  });

  describe('Mercurius', () => {
    it('should be able to consult /graphql', async () => {
      server = await makeServer();

      const response = await server.inject({
        method: 'GET',
        url: '/graphql',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toMatchObject({
        data: null,
        errors: [
          {
            message: 'Unknown query',
          },
        ],
      });
    });
  });

  describe('@fastify/swagger', () => {
    it('should be able to return a json', async () => {
      server = await makeServer();

      const response = await server.inject({
        method: 'GET',
        url: '/documentation/json',
      });
      expect(response.statusCode).toBe(200);
    });
  });
});
