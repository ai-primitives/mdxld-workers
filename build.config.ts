import { defineConfig } from 'tsup'
import { resolve } from 'path'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'esnext',
  outDir: 'dist',
  external: ['mdxld', 'esbuild', 'commander', 'execa'],
  esbuildOptions(options, { format }) {
    options.platform = 'node'
    options.format = format
    options.bundle = true
    options.target = ['esnext']
    options.define = {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis',
      'globalThis.process': 'undefined',
      ...(format === 'cjs' ? {
        'import.meta': '{ url: require("url").pathToFileURL(__filename).toString() }',
      } : {
        'import.meta': '{ url: import.meta.url }',
      })
    }
    options.mainFields = format === 'esm' ? ['module', 'main'] : ['main', 'module']
    options.conditions = format === 'esm' ? ['import', 'node'] : ['require', 'node']
  }
})
