import { defineConfig } from 'tsup'
import { resolve } from 'path'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'esnext',
  outDir: 'dist',
  external: ['mdxld'],
  esbuildOptions(options) {
    options.platform = 'node'
    options.format = 'esm'
    options.bundle = true
    options.mainFields = ['module', 'main']
    options.conditions = ['import', 'module']
    options.define = {
      'process.env.NODE_ENV': '"production"'
    }
  }
})
