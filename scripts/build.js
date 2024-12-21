import * as esbuild from 'esbuild'

async function build() {
  try {
    // Build core worker bundle
    await esbuild.build({
      entryPoints: ['src/compiler/index.ts'],
      outfile: 'dist/compiler.js',
      bundle: true,
      platform: 'neutral',
      format: 'esm',
      target: ['esnext'],
      sourcemap: true,
      external: ['mdxld', 'esbuild'],
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    })

    // Build Node.js specific modules
    await esbuild.build({
      entryPoints: ['src/index.ts', 'src/deploy/wrangler.ts', 'src/deploy/platform.ts'],
      outdir: 'dist',
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: ['esnext'],
      sourcemap: true,
      external: ['mdxld', 'esbuild', 'commander', 'execa'],
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    })

    console.log('Build completed successfully')
  } catch (error) {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

build()
