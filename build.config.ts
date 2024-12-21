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
  external: ['mdxld', 'esbuild', 'commander', 'execa'],
  platform: 'node',
  esbuildOptions(options) {
    options.bundle = true
    options.platform = 'node'
    options.target = ['esnext']
    options.define = {
      'process.env.NODE_ENV': '"production"'
    }
    options.supported = {
      'import.meta.url': false
    }
  }
})
