import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'esnext',
  outDir: 'dist',
  external: ['mdxld', 'esbuild', 'commander', 'execa'],
  format: ['esm'],
  treeshake: true,
  splitting: false,
  env: {
    NODE_ENV: 'production'
  },
  esbuildOptions(options) {
    options.bundle = true
    options.platform = 'neutral'
    options.mainFields = ['module', 'main']
    options.format = 'esm'
  }
})
