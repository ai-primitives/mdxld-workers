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
  const workerConfig = (mdxld.data['$worker'] || mdxld.data['@worker']) as WorkerConfig | undefined
  if (workerConfig && typeof workerConfig === 'object') {
    metadata.name = typeof workerConfig.name === 'string' ? workerConfig.name : ''
    metadata.routes = Array.isArray(workerConfig.routes) ? workerConfig.routes : []
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
    // Parse MDXLD content
    const mdxld = parse(source)

    // Extract worker metadata
    const metadata = extractWorkerMetadata(mdxld)

    // Create worker context
    const workerContext: WorkerContext = {
      metadata: {
        type: mdxld.type,
        context: mdxld.context,
        ...metadata,
        // Include all $ and @ prefixed properties
        ...Object.fromEntries(
          Object.entries(mdxld.data)
            .filter(([key]) => key.startsWith('$') || key.startsWith('@'))
        )
      },
      content: mdxld.content
    }

    // Bundle with esbuild
    const result = await esbuild.build({
      entryPoints: [path.resolve(__dirname, '../templates/worker.ts')],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'esnext',
      platform: 'browser',
      external: ['__STATIC_CONTENT_MANIFEST'],
      metafile: true,
      define: {
        WORKER_CONTEXT: JSON.stringify(workerContext)
      }
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
