import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['iife'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'esnext',
  outDir: 'dist',
  external: ['mdxld', 'esbuild', 'commander', 'execa'],
  platform: 'browser',
  esbuildOptions(options) {
    options.bundle = true
    options.platform = 'browser'
    options.target = ['esnext']
    options.format = 'iife'
    options.define = {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis',
      'import.meta': '{}',
      'import.meta.url': '""'
    }
  }
})
