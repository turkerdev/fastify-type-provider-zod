import z, { toJSONSchema } from 'zod'

console.log(toJSONSchema(z.union([z.string(), z.number()]).array()))
// {
//   '$schema': 'https://json-schema.org/draft/2020-12/schema',
//   type: 'array',
//   items: { anyOf: [ [Object], [Object] ] }
// }

console.log(toJSONSchema(z.tuple([z.string(), z.number()])))
// {
//   '$schema': 'https://json-schema.org/draft/2020-12/schema',
//   type: 'array',
//   prefixItems: [ { type: 'string' }, { type: 'number' } ]
// }
