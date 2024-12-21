import { defineConfig } from 'tsup'
import { resolve } from 'path'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'esnext',
  outDir: 'dist',
  external: ['mdxld', 'esbuild', 'commander', 'execa'],
  esbuildOptions(options) {
    options.platform = 'node'
    options.format = 'cjs'
    options.bundle = true
    options.target = ['esnext']
    options.define = {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis',
      'import.meta': '{ url: "" }',
      'import.meta.url': '""'
    }
    options.conditions = ['node', 'import']
    options.mainFields = ['module', 'main']
  }
})
