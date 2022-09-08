# Fastify Type Provider Zod

[![NPM Version][npm-image]][npm-url]
[![npm downloads](https://img.shields.io/npm/dm/fastify-type-provider-zod.svg)](https://npmjs.org/package/fastify-type-provider-zod)
[![Build Status](https://github.com//turkerdev/fastify-type-provider-zod/workflows/CI/badge.svg)](https://github.com//turkerdev/fastify-type-provider-zod/actions)


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

## How to use together with @fastify/swagger

```ts
import {
  jsonSchemaTransform,
  createJsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';

const app = Fastify();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifySwagger, {
  exposeRoute: true,
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

const LOGIN_SCHEMA = z.object({
  username: z.string().max(32).describe('someDescription'),
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

await app.ready();
```

[npm-image]: https://img.shields.io/npm/v/fastify-type-provider-zod.svg
[npm-url]: https://npmjs.org/package/fastify-type-provider-zod
[downloads-image]: https://img.shields.io/npm/dm/fastify-type-provider-zod.svg
[downloads-url]: https://npmjs.org/package/fastify-type-provider-zod
