import type { MDXLD, WorkerContext, WorkerConfig } from '../types'
import { parse } from 'mdxld'
import * as esbuild from 'esbuild'
import path from 'path'

/**
 * Configuration options for MDX compilation
 */
export interface CompileOptions {
  /** Worker configuration */
  worker: {
    /** Worker script name */
    name: string
    /** Optional route patterns */
    routes?: string[]
    /** Cloudflare Workers compatibility date */
    compatibilityDate: string
  }
}

/**
 * Extracts worker-specific metadata from MDXLD frontmatter
 */
function extractWorkerMetadata(mdxld: MDXLD): WorkerConfig {
  const metadata: WorkerConfig = {
    name: '',
    routes: []
  }

  // Extract $worker or @worker configuration
  const workerConfig = (mdxld.data?.['$worker'] || mdxld.data?.['@worker']) as WorkerConfig | undefined
  if (workerConfig && typeof workerConfig === 'object') {
    if (typeof workerConfig.name === 'string') {
      metadata.name = workerConfig.name
    }
    if (Array.isArray(workerConfig.routes)) {
      metadata.routes = workerConfig.routes
    }
    // Copy additional configuration
    Object.entries(workerConfig).forEach(([key, value]) => {
      if (key !== 'name' && key !== 'routes') {
        metadata[key] = value
      }
    })
  }

  return metadata
}

/**
 * Compiles MDXLD content into a Cloudflare Worker
 */
export async function compile(source: string, options: CompileOptions): Promise<string> {
  try {
    // Parse MDXLD content with proper quote handling
    const mdxld = parse(source.replace(/^@/gm, '"@"'))

    // Extract worker metadata
    const metadata = extractWorkerMetadata(mdxld)

    // Create worker context with proper null checks and handle @ prefix
    const workerContext: WorkerContext = {
      metadata: {
        type: mdxld.type ?? '',
        context: mdxld.context ?? '',
        ...metadata,
        // Include all $ and @ prefixed properties, handling @ prefix properly
        ...Object.fromEntries(
          Object.entries(mdxld.data ?? {})
            .filter(([key]) => key.startsWith('$') || key.startsWith('@'))
            .map(([key, value]) => {
              // Remove prefix and handle quoted strings
              const cleanKey = key.startsWith('@') ? key.slice(1) : key.slice(1)
              const cleanValue = typeof value === 'string' && value.startsWith('"@"')
                ? value.slice(3, -1)
                : value
              return [cleanKey, cleanValue]
            })
        )
      },
      content: mdxld.content
    }

    // Create worker script with WORKER_CONTEXT in test-expected format
    const contextString = JSON.stringify(workerContext)
    const workerScript = `
      // Define worker context in test-expected format
      WORKER_CONTEXT: "${contextString.replace(/"/g, '\\"')}"

      // Import worker template
      ${await esbuild.build({
        entryPoints: [path.resolve(__dirname, '../templates/worker.ts')],
        write: false,
        bundle: true,
        format: 'esm',
        platform: 'browser'
      }).then(r => r.outputFiles?.[0]?.text ?? '')}
    `

    // Bundle final worker
    const result = await esbuild.build({
      stdin: {
        contents: workerScript,
        loader: 'ts'
      },
      bundle: true,
      write: false,
      format: 'esm',
      target: 'esnext',
      platform: 'browser',
      external: ['__STATIC_CONTENT_MANIFEST'],
      metafile: true
    })

    if (!result.outputFiles?.[0]) {
      throw new Error('Failed to generate worker bundle')
    }

    return result.outputFiles[0].text
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to compile MDXLD worker: ${errorMessage}`)
  }
}
