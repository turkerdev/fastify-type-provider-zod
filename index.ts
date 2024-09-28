export {
  type ZodTypeProvider,
  type FastifyPluginAsyncZod,
  type FastifyPluginCallbackZod,
  type ZodSerializerCompilerOptions,
  jsonSchemaTransform,
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  createSerializerCompiler,
} from './src/core';

export {
  ZodFastifySchemaValidationError,
  ResponseSerializationError,
  InvalidSchemaError,
  hasZodFastifySchemaValidationErrors,
} from './src/errors';
