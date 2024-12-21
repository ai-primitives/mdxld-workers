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
  noExternal: ['mdxld'],
  esbuildOptions(options) {
    // Use browser platform for better worker compatibility
    options.platform = 'browser'
    options.format = 'esm'
    options.bundle = true
    options.mainFields = ['module', 'main']
    options.conditions = ['import', 'module']
    // Keep only essential defines
    options.define = {
      'process.env.NODE_ENV': '"production"',
      'import.meta': JSON.stringify({ url: 'file:///worker.js' })
    }
    // Ensure proper ESM handling
    options.splitting = false
    options.treeShaking = true
    options.logLevel = 'verbose'
  }
})
