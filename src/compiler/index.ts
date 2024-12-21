import type { MDXLD, WorkerContext, WorkerConfig } from '../types'
import { parse } from 'mdxld'
import * as esbuild from 'esbuild'
import { resolve } from 'path'

// Extended metadata type for internal use
export type ExtendedMetadata = WorkerConfig & {
  type?: string
  context?: string | Record<string, unknown>
  config?: {
    memory?: number
    env?: Record<string, string>
    [key: string]: unknown
  }
  [key: string]: unknown
}

// Use relative path that will work in both development and production
const TEMPLATES_DIR = resolve(process.cwd(), 'src/templates')

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
  // Process metadata recursively to handle nested objects
  const processMetadata = (data: Record<string, unknown>): Record<string, unknown> => {
    return Object.fromEntries(
      Object.entries(data).flatMap(([key, value]) => {
        // Handle prefixed properties
        if (key.startsWith('$') || key.startsWith('@') || key.startsWith("'@") || key.startsWith('"@')) {
          const cleanKey = key.replace(/^(['"])/, '').replace(/(['"])$/, '')
          const unprefixedKey = cleanKey.replace(/^[@$]/, '')
          // For type and context, keep both prefixed and unprefixed at root
          if (cleanKey === '$type' || cleanKey === '@type' || cleanKey === '$context' || cleanKey === '@context') {
            return [
              [cleanKey, value],
              [unprefixedKey, value],
            ]
          }
          return [[cleanKey, value]]
        }

        // Process nested objects recursively
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            return [[key, value]]
          }
          return [[key, processMetadata(value as Record<string, unknown>)]]
        }

        return [[key, value]]
      }),
    )
  }

  // Process all metadata
  const processedData = processMetadata(mdxld.data ?? {})

  // Extract worker configuration and ensure proper typing
  const workerConfig = (processedData['$worker'] || processedData['@worker']) as WorkerConfig | undefined

  // Start with base metadata
  const metadata = {
    name: '',
    routes: [],
    config: {
      memory: 128,
      env: {
        NODE_ENV: 'production',
      },
    },
    // Add processed metadata
    ...processedData,
    // Ensure type and context are preserved
    ...(mdxld.type ? { type: mdxld.type } : {}),
    ...(mdxld.context ? { context: mdxld.context } : {}),
  } as ExtendedMetadata

  // Update with worker configuration if present
  if (workerConfig && !Array.isArray(workerConfig)) {
    if ('name' in workerConfig && typeof workerConfig.name === 'string') {
      metadata.name = workerConfig.name
    }
    if ('routes' in workerConfig && Array.isArray(workerConfig.routes)) {
      metadata.routes = workerConfig.routes
    }
    if ('config' in workerConfig && workerConfig.config && typeof workerConfig.config === 'object') {
      metadata.config = {
        ...metadata.config,
        ...workerConfig.config,
      }
    }
  }

  return metadata
}

/**
 * Compiles MDXLD content into a Cloudflare Worker
 */
export async function compile(source: string, options: CompileOptions): Promise<string> {
  try {
    // Parse MDXLD content and ensure @ prefixes are properly quoted
    const quotedSource = source.replace(/^(@\w+):/gm, '"$1":')
    const mdxld = parse(quotedSource)

    // Extract worker metadata and merge with options
    const metadata = {
      ...extractWorkerMetadata(mdxld),
      name: options.worker.name,
      routes: options.worker.routes,
    }

    // Create worker context with properly typed metadata
    const typedMetadata = metadata as ExtendedMetadata
    const workerContext: WorkerContext = {
      metadata: {
        name: typedMetadata.name,
        routes: typedMetadata.routes,
        ...(typedMetadata.type ? { type: typedMetadata.type } : {}),
        ...(typedMetadata.context ? { context: typedMetadata.context } : {}),
        config: {
          memory: 128,
          env: {
            NODE_ENV: 'production',
          },
          ...(typedMetadata.config || {}),
        },
        // Add all other metadata properties
        ...Object.entries(typedMetadata).reduce(
          (acc, [key, value]) => {
            if (!['name', 'routes', 'type', 'context', 'config'].includes(key)) {
              acc[key] = value
            }
            return acc
          },
          {} as Record<string, unknown>,
        ),
      },
      content: mdxld.content,
    }

    // Create worker script with WORKER_CONTEXT in test-expected format
    const workerTemplate = await esbuild.build({
      entryPoints: [resolve(TEMPLATES_DIR, 'worker.ts')],
      write: false,
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      mainFields: ['module', 'main'],
      conditions: ['import', 'module', 'default'],
      define: {
        'process.env.NODE_ENV': '"production"'
      },
    })

    if (!workerTemplate.outputFiles?.[0]) {
      throw new Error('Failed to load worker template')
    }

    // Format WORKER_CONTEXT exactly as test expects
    // Format for test regex with double quotes
    // The test helper will remove the outer quotes and parse directly
    const workerScript = `globalThis.WORKER_CONTEXT = ${JSON.stringify(workerContext)};\n\n${workerTemplate.outputFiles[0].text}`

    // Bundle final worker with proper configuration and type annotation
    const result: esbuild.BuildResult = await esbuild.build({
      stdin: {
        contents: workerScript,
        loader: 'ts',
      },
      bundle: true,
      format: 'esm',
      target: 'esnext',
      write: false,
      platform: 'browser',
      external: ['__STATIC_CONTENT_MANIFEST'],
      metafile: true,
      define: {
        'process.env.NODE_ENV': '"production"',
        // Define WORKER_CONTEXT as a global variable for esbuild
        'globalThis.WORKER_CONTEXT': 'undefined',
      },
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
