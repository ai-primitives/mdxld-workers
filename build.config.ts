import { defineConfig } from 'tsup'

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
  treeshake: true,
  splitting: true,
  esbuildOptions(options) {
    options.bundle = true
    options.platform = 'neutral'
    options.target = ['esnext']
    options.format = 'esm'
    options.mainFields = ['module', 'main']
    options.conditions = ['import', 'module']
    options.define = {
      'process.env.NODE_ENV': '"production"'
    }
  }
})
