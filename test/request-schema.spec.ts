import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from '../src';
import { serializerCompiler, validatorCompiler } from '../src';

const REQUEST_SCHEMA = z.object({
  name: z.string(),
  readonlyId: z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value;
    }
    return [value];
  }, z.array(z.string().readonly())),
});

const schema = z.object({
  foo: z.boolean(),
  bar: z.number(),
});

const REQUEST_BODY_SCHEMA = z.object({
  name: z.string(),
  readonlyObject: z
    .object({
      id: z.string(),
    })
    .readonly(),
  valueRoArray: schema.array().readonly(),
  valueRo: schema.readonly(),
});

describe('request schema', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.after(() => {
      app
        .withTypeProvider<ZodTypeProvider>()
        .route({
          method: 'GET',
          url: '/',
          schema: {
            querystring: REQUEST_SCHEMA,
          },
          handler: (req, res) => {
            res.send({
              name: req.query.name,
              readonlyId: req.query.readonlyId[0],
            });
          },
        })
        .route({
          method: 'POST',
          url: '/',
          schema: {
            body: REQUEST_BODY_SCHEMA,
          },
          handler: (req, res) => {
            res.send({
              name: req.body.name,
              readonlyId: req.body.readonlyObject.id,
              arrId: req.body.valueRoArray[0].bar,
              objId: req.body.valueRo.bar,
            });
          },
        })
        .route({
          method: 'GET',
          url: '/no-schema',
          schema: undefined,
          handler: (req, res) => {
            res.send({
              status: 'ok',
            });
          },
        });
    });

    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('accepts correct request with query params', async () => {
    const response = await app
      .inject()
      .get('/')
      .query({
        name: 'test',
        readonlyId: ['ro'],
      });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: 'test',
      readonlyId: 'ro',
    });
  });

  it('accepts correct body', async () => {
    const response = await app
      .inject()
      .post('/')
      .body({
        name: 'test',
        readonlyObject: {
          id: 'ro',
        },
        valueRoArray: [
          {
            foo: false,
            bar: 0,
          },
        ],
        valueRo: {
          foo: true,
          bar: 1,
        },
      });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: 'test',
      readonlyId: 'ro',
      arrId: 0,
      objId: 1,
    });
  });

  it('accepts request on route without schema', async () => {
    const response = await app.inject().get('/no-schema');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
    });
  });

  it('returns 400 on validation error', async () => {
    const response = await app.inject().get('/').query({
      readonlyId: 'ro',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchSnapshot();
  });
});
