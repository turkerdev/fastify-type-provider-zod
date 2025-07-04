import { defineConfig } from "vite";
import UnpluginIsolatedDecl from 'unplugin-isolated-decl/vite'

export default defineConfig({
  build: {
    lib: { entry: "src/index.ts",},
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: ["fastify", /zod\/v4*?/,  "@fastify/swagger", "@fastify/error"],
      output: [{
        preserveModules: true,
        entryFileNames: 'cjs/[name].cjs',
        format: 'commonjs'
      }, {
        preserveModules: true,
        entryFileNames: 'esm/[name].js',
        format: 'es'
      }],
    },
  },
  plugins: [UnpluginIsolatedDecl()],
});