import type { MDXLD, WorkerContext, WorkerConfig } from '../types'
import { parse } from 'mdxld'
import * as esbuild from 'esbuild'

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
function extractWorkerMetadata(mdxld: MDXLD, options?: CompileOptions): WorkerConfig {
  // Process metadata recursively to handle nested objects
  const processMetadata = (data: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {}

    // Deep clone arrays to prevent mutation
    const cloneArray = (arr: unknown[]): unknown[] =>
      arr.map((item) => (item && typeof item === 'object' ? (Array.isArray(item) ? cloneArray(item) : processMetadata(item as Record<string, unknown>)) : item))

    // Helper to process prefixed keys
    const processPrefixedKey = (key: string, value: unknown) => {
      const cleanKey = key.replace(/^(['"])/, '').replace(/(['"])$/, '')
      const unprefixedKey = cleanKey.replace(/^[@$]/, '')
      const prefix = cleanKey.match(/^[@$]/)?.[0]

      // Always preserve both versions
      if (prefix) {
        result[`${prefix}${unprefixedKey}`] = value
      }
      result[unprefixedKey] = value

      // Special handling for worker configuration
      if (cleanKey === '$worker' || cleanKey === '@worker') {
        const config = value as Record<string, unknown>
        result.worker = config
        if (config.name) {
          result.name = config.name
        }
        if (config.routes) {
          result.routes = config.routes
        }
      }
    }

    // Process all keys
    for (const [key, value] of Object.entries(data)) {
      const isPrefix = key.startsWith('$') || key.startsWith('@') || key.startsWith("'@") || key.startsWith('"@')

      if (isPrefix) {
        // Handle prefixed keys
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            // Deep clone arrays
            processPrefixedKey(key, cloneArray(value))
          } else {
            // Process nested objects
            const processedValue = processMetadata(value as Record<string, unknown>)
            processPrefixedKey(key, processedValue)
          }
        } else {
          // Handle primitive values
          processPrefixedKey(key, value)
        }
      } else {
        // Handle non-prefixed keys
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            // Deep clone arrays
            result[key] = cloneArray(value)
          } else {
            // Process nested objects
            result[key] = processMetadata(value as Record<string, unknown>)
          }
        } else {
          // Keep primitive values as-is
          result[key] = value
        }
      }
    }

    return result
  }

  // Process all metadata
  const processedData = processMetadata(mdxld.data ?? {})

  // Extract worker configuration and ensure proper typing
  const workerData = (processedData['$worker'] || processedData['@worker']) as WorkerConfig | undefined

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
    // Add processed metadata with both prefixed and unprefixed versions
    ...processedData,
    // Ensure type and context are preserved
    ...(mdxld.type ? { type: mdxld.type } : {}),
    ...(mdxld.context ? { context: mdxld.context } : {}),
  } as ExtendedMetadata

  // Apply options if provided
  if (options?.worker) {
    metadata.name = options.worker.name || metadata.name
    metadata.routes = options.worker.routes || metadata.routes
  }

  // Apply worker configuration from metadata if present
  if (workerData) {
    if (workerData.name) {
      metadata.name = String(workerData.name)
    }
    if (Array.isArray(workerData.routes)) {
      metadata.routes = workerData.routes
    }
    if (workerData.config && typeof workerData.config === 'object') {
      metadata.config = {
        ...metadata.config,
        ...(workerData.config as Record<string, unknown>),
      }
    }
  } else if (processedData.worker && typeof processedData.worker === 'object') {
    const workerConfig = processedData.worker as Record<string, unknown>
    if (workerConfig.name) {
      metadata.name = String(workerConfig.name)
    }
    if (Array.isArray(workerConfig.routes)) {
      metadata.routes = workerConfig.routes
    }
    if (workerConfig.config && typeof workerConfig.config === 'object') {
      metadata.config = {
        ...metadata.config,
        ...(workerConfig.config as Record<string, unknown>),
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
    // Parse MDXLD content
    const mdxld = parse(source)

    // Extract worker metadata and merge with options
    const metadata = extractWorkerMetadata(mdxld, options)

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

    // Read worker template directly
    const workerTemplate = await esbuild.build({
      stdin: {
        contents: `
          // Define worker context without relying on import.meta
          globalThis.WORKER_CONTEXT = ${JSON.stringify(workerContext)};
          
          // Export worker instance as ESM default export
          export default {
            async fetch(_request) {
              return new Response(WORKER_CONTEXT.content, {
                headers: {
                  'Content-Type': 'text/html',
                  'X-MDXLD-Metadata': JSON.stringify(WORKER_CONTEXT.metadata),
                },
              });
            },
          };
        `,
        loader: 'ts',
      },
      write: false,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: ['esnext'],
      define: {
        'process.env.NODE_ENV': '"production"',
        global: 'globalThis',
      },
    })

    if (!workerTemplate.outputFiles?.[0]) {
      throw new Error('Failed to generate worker bundle')
    }

    return workerTemplate.outputFiles[0].text
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to compile MDXLD worker: ${errorMessage}`)
  }
}
