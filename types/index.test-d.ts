import type {
    FastifyInstance,
    FastifyLoggerInstance,
    RawReplyDefaultExpression,
    RawRequestDefaultExpression,
    RawServerDefault,
} from "fastify"
import Fastify from "fastify"
import { expectAssignable, expectType } from "tsd"
import z from "zod"

import { ZodSerializerCompiler, ZodValidatorCompiler } from "../src/index"
import type { ZodTypeProvider } from "../src/index"

const fastify = Fastify().withTypeProvider<ZodTypeProvider>()

type FastifyZodInstance = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    FastifyLoggerInstance,
    ZodTypeProvider
>

expectType<FastifyZodInstance>(fastify.setValidatorCompiler(ZodValidatorCompiler))
expectType<FastifyZodInstance>(fastify.setSerializerCompiler(ZodSerializerCompiler))
expectAssignable<FastifyZodInstance>(fastify)
expectAssignable<FastifyInstance>(fastify)

fastify.route({
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
        expectType<string>(req.query.name)
        res.send("string")
    },
})
