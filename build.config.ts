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
    options.platform = 'browser'
    options.format = 'iife'
    options.bundle = true
    options.target = ['esnext']
    options.define = {
      'process.env.NODE_ENV': '"production"'
    }
    options.conditions = ['worker', 'browser']
    options.supported = {
      'import.meta.url': false
    }
  }
})
