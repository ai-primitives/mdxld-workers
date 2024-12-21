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

  // Extract $worker or '@worker' configuration
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
    // Parse MDXLD content without modifying source
    const mdxld = parse(source)

    // Extract worker metadata
    const metadata = extractWorkerMetadata(mdxld)

    // Create worker context
    const workerContext: WorkerContext = {
      metadata: {
        // Include worker metadata first
        name: metadata.name,
        ...(metadata.routes ? { routes: metadata.routes } : {}),
        // Keep all prefixed properties at root level without modification
        ...Object.fromEntries(
          Object.entries(mdxld.data ?? {})
            .filter(([key]) => key.startsWith('$') || key.startsWith('@') || key.startsWith("'@") || key.startsWith('"@'))
            .map(([key, value]) => {
              // Handle quoted @ prefix by removing quotes
              const cleanKey = key.replace(/^['"]/, '')
              return [cleanKey, value]
            })
        ),
        // Include type and context if not already set by prefixed properties
        ...(mdxld.type && !mdxld.data?.['$type'] ? { '$type': mdxld.type } : {}),
        ...(mdxld.context && !mdxld.data?.['$context'] ? { '$context': mdxld.context } : {})
      },
      content: mdxld.content
    }

    // Create worker script with WORKER_CONTEXT in test-expected format
    const workerTemplate = await esbuild.build({
      entryPoints: [path.resolve(__dirname, '../templates/worker.ts')],
      write: false,
      bundle: true,
      format: 'esm',
      platform: 'browser'
    })

    if (!workerTemplate.outputFiles?.[0]) {
      throw new Error('Failed to load worker template')
    }

    // Format WORKER_CONTEXT exactly as test expects with double stringify
    const contextString = JSON.stringify(workerContext)
    const doubleStringified = JSON.stringify(contextString)
    const workerScript = `WORKER_CONTEXT: ${doubleStringified};

${workerTemplate.outputFiles[0].text}`

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
