import type { MDXLD } from 'mdxld'
import { parse } from 'mdxld'
import { parse as parseAST } from 'mdxld/ast'
import * as esbuild from 'esbuild'
import { createWorkerTemplate } from '../templates/worker.js'

/**
 * Configuration options for MDX compilation
 */
export interface CompileOptions {
  /** JSX compilation options */
  jsx: {
    /** Import source for JSX runtime */
    importSource: 'hono/jsx'
    /** JSX runtime mode */
    runtime: 'react-jsx'
  }
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

    // Generate worker code using template
    const workerCode = createWorkerTemplate(mdxld, {
      name: metadata.name || options.worker.name,
      routes: metadata.routes || options.worker.routes,
      compatibilityDate: options.worker.compatibilityDate
    })

    // Bundle with esbuild
    const result = await esbuild.build({
      stdin: {
        contents: workerCode,
        loader: 'tsx',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      target: 'esnext',
      platform: 'browser',
      jsx: 'automatic',
      jsxImportSource: options.jsx.importSource,
      external: ['__STATIC_CONTENT_MANIFEST'],
      metafile: true,
    })

    if (!result.outputFiles?.[0]) {
      throw new Error('Failed to generate worker bundle')
    }

    return result.outputFiles[0].text
  } catch (error) {
    throw new Error(`Failed to compile MDXLD worker: ${error instanceof Error ? error.message : String(error)}`)
  }
}
