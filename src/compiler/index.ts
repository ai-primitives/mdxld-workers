import type { MDXLD } from '../types'
import { parse } from 'mdxld'
import * as esbuild from 'esbuild'

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
 * Worker-specific metadata extracted from YAML-LD
 */
interface WorkerMetadata {
  /** Worker route patterns */
  routes?: string[]
  /** Worker name override */
  name?: string
  /** Additional worker configuration */
  config?: Record<string, unknown>
}

/**
 * Worker configuration from YAML-LD frontmatter
 */
interface WorkerConfig {
  /** Worker route patterns */
  routes?: string[]
  /** Worker name */
  name?: string
  /** Additional configuration */
  [key: string]: unknown
}

/**
 * Extracts worker-specific metadata from MDXLD frontmatter
 */
function extractWorkerMetadata(mdxld: MDXLD): WorkerMetadata {
  const metadata: WorkerMetadata = {}

  // Extract $worker or @worker configuration
  const workerConfig = (mdxld.data['$worker'] || mdxld.data['@worker']) as WorkerConfig | undefined
  if (workerConfig && typeof workerConfig === 'object') {
    metadata.routes = Array.isArray(workerConfig.routes) ? workerConfig.routes : undefined
    metadata.name = typeof workerConfig.name === 'string' ? workerConfig.name : undefined
    metadata.config = workerConfig
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
    const workerContext = {
      metadata: {
        ...metadata,
        context: mdxld.context,
        type: mdxld.type,
        data: mdxld.data
      },
      content: mdxld.content
    }

    // Bundle with esbuild
    const result = await esbuild.build({
      entryPoints: ['./src/templates/worker.ts'],
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
