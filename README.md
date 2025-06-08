# Fastify Type Provider Zod

[![NPM Version](https://img.shields.io/npm/v/fastify-type-provider-zod.svg)](https://npmjs.org/package/fastify-type-provider-zod)
[![NPM Downloads](https://img.shields.io/npm/dm/fastify-type-provider-zod.svg)](https://npmjs.org/package/fastify-type-provider-zod)
[![Build Status](https://github.com//turkerdev/fastify-type-provider-zod/workflows/CI/badge.svg)](https://github.com//turkerdev/fastify-type-provider-zod/actions)

## Zod compatibility

| fastify-type-provider-zod | zod  |
|---------------------------|------|
| <=4.x                     | v3   |
| >=5.x                     | v4   |

## How to use?

```js
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

const app = Fastify()

// Add schema validator and serializer
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  // Define your schema
  schema: {
    querystring: z.object({
      name: z.string().min(4),
    }),
    response: {
      200: z.string(),
    },
  },
  handler: (req, res) => {
    res.send(req.query.name);
  },
});

app.listen({ port: 4949 });
```

You can also pass options to the `serializerCompiler` function:

```ts
type ZodSerializerCompilerOptions = {
  replacer?: ReplacerFunction;
};
```

```js
import Fastify from 'fastify';
import { createSerializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const app = Fastify();

const replacer = function (key, value) {
  if (this[key] instanceof Date) {
    return { _date: value.toISOString() };
  }
  return value;
};

// Create a custom serializer compiler
const customSerializerCompiler = createSerializerCompiler({ replacer });

// Add schema validator and serializer
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(customSerializerCompiler);

// ...

app.listen({ port: 4949 });
```

## How to use together with @fastify/swagger

```ts
import fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { z } from 'zod/v4';

import {
  jsonSchemaTransform,
  createJsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';

const app = fastify();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'SampleApi',
      description: 'Sample backend service',
      version: '1.0.0',
    },
    servers: [],
  },
  transform: jsonSchemaTransform,

  // You can also create transform with custom skiplist of endpoints that should not be included in the specification:
  //
  // transform: createJsonSchemaTransform({
  //   skipList: [ '/documentation/static/*' ]
  // })
});

app.register(fastifySwaggerUI, {
  routePrefix: '/documentation',
});

const LOGIN_SCHEMA = z.object({
  username: z.string().max(32).describe('Some description for username'),
  password: z.string().max(32),
});

app.after(() => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'POST',
    url: '/login',
    schema: { body: LOGIN_SCHEMA },
    handler: (req, res) => {
      res.send('ok');
    },
  });
});

async function run() {
  await app.ready();

  await app.listen({
    port: 4949,
  });

  console.log(`Documentation running at http://localhost:4949/documentation`);
}

run();
```

## Customizing error responses

You can add custom handling of request and response validation errors to your fastify error handler like this:

```ts
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

fastifyApp.setErrorHandler((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
        return reply.code(400).send({
            error: 'Response Validation Error',
            message: "Request doesn't match the schema",
            statusCode: 400,
            details: {
                issues: err.validation,
                method: req.method,
                url: req.url,
            },
        })
    }

    if (isResponseSerializationError(err)) {
        return reply.code(500).send({
            error: 'Internal Server Error',
            message: "Response doesn't match the schema",
            statusCode: 500,
            details: {
                issues: err.cause.issues,
                method: err.method,
                url: err.url,
            },
        })
    }
    
    // the rest of the error handler
})
```

## How to create refs to the schemas?

When provided, this package will automatically create refs using the `jsonSchemaTransformObject` function. You register the schemas with the global Zod registry and assign them an `id`. `fastifySwagger` will then create an OpenAPI document that references the schemas.

The following example creates a ref to the `User` schema and will include the `User` schema in the OpenAPI document.

```ts
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import fastify from 'fastify';
import { z } from 'zod/v4';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  jsonSchemaTransformObject,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

const USER_SCHEMA = z.object({
  id: z.number().int().positive(),
  name: z.string().describe('The name of the user'),
});

z.globalRegistry.add(USER_SCHEMA, { id: 'User' })

const app = fastify();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'SampleApi',
      description: 'Sample backend service',
      version: '1.0.0',
    },
    servers: [],
  },
  transform: jsonSchemaTransform,
  transformObject: jsonSchemaTransformObject,
});

app.register(fastifySwaggerUI, {
  routePrefix: '/documentation',
});

app.after(() => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'GET',
    url: '/users',
    schema: {
      response: {
        200: USER_SCHEMA.array(),
      },
    },
    handler: (req, res) => {
      res.send([]);
    },
  });
});

async function run() {
  await app.ready();

  await app.listen({
    port: 4949,
  });

  console.log(`Documentation running at http://localhost:4949/documentation`);
}

run();
```

## How to create a plugin?

```ts
import { z } from 'zod/v4';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

const plugin: FastifyPluginAsyncZod = async function (fastify, _opts) {
  fastify.route({
    method: 'GET',
    url: '/',
    // Define your schema
    schema: {
      querystring: z.object({
        name: z.string().min(4),
      }),
      response: {
        200: z.string(),
      },
    },
    handler: (req, res) => {
      res.send(req.query.name);
    },
  });
};
```
