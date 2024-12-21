import type { WorkerContext, WorkerConfig } from '../types'
import { parse } from 'mdxld'
import type { MDXLD } from 'mdxld'
import * as esbuild from 'esbuild'

// Extended metadata type for internal use
export type ExtendedMetadata = {
  name: string
  routes?: string[]
  type?: string
  '@type'?: string
  '$type'?: string
  context?: string | Record<string, unknown>
  '@context'?: string | Record<string, unknown>
  '$context'?: string | Record<string, unknown>
  id?: string
  '@id'?: string
  '$id'?: string
  language?: string
  base?: string
  vocab?: string
  list?: unknown[]
  set?: Set<unknown>
  reverse?: boolean
  config: {
    memory?: number
    env?: Record<string, string>
    [key: string]: unknown
  }
  [key: string]: string | Record<string, unknown> | unknown[] | Set<unknown> | boolean | undefined
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
function extractWorkerMetadata(mdxld: MDXLD, options?: CompileOptions): ExtendedMetadata {
  // Process metadata recursively with proper type handling
  const processMetadata = (data: Record<string, unknown>): Record<string, unknown> => {
    if (!data || typeof data !== 'object') return {}

    const result: Record<string, unknown> = {}

    // Helper to process special fields
    const processSpecialField = (field: string, value: unknown): unknown => {
      if (field === 'context' && typeof value === 'object') {
        const contextObj = value as Record<string, unknown>
        const processedContext: Record<string, unknown> = {}
        
        for (const [k, v] of Object.entries(contextObj)) {
          if (k === 'vocab' || k === '@vocab') {
            processedContext['@vocab'] = v
          } else {
            processedContext[k] = v
          }
        }
        return processedContext
      }
      
      if (Array.isArray(value)) return value
      if (typeof value === 'object' && value !== null) return value
      return typeof value === 'string' ? value : String(value)
    }

    // Process all fields
    for (const [key, value] of Object.entries(data)) {
      const unprefixedKey = key.replace(/^[@$]/, '')
      const isSpecialField = specialFields.includes(unprefixedKey as SpecialField)

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Process nested objects
        result[key] = processMetadata(value as Record<string, unknown>)
      } else if (Array.isArray(value)) {
        // Handle arrays
        result[key] = value.map(item => 
          typeof item === 'object' && item !== null
            ? processMetadata(item as Record<string, unknown>)
            : item
        )
      } else if (isSpecialField) {
        // Process special fields with all prefix variants
        const processedValue = processSpecialField(unprefixedKey, value)
        result[unprefixedKey] = processedValue
        result[`@${unprefixedKey}`] = processedValue
        result[`$${unprefixedKey}`] = processedValue
      } else {
        // Handle regular fields
        result[key] = value
      }
    }

    return result
  }

  // Process metadata with proper handling of nested structures
  const processedData = processMetadata(mdxld.data ?? {})

  // Process special fields from mdxld and frontmatter
  const specialFields = ['type', 'context', 'id', 'language', 'base', 'vocab', 'list', 'set', 'reverse'] as const
  type SpecialField = typeof specialFields[number]

  // Process special fields from both mdxld and processed data
  const combinedData = {
    ...mdxld,
    ...processedData
  }

  // Process special fields with proper type handling
  for (const field of specialFields) {
    const value = combinedData[field]
    if (value !== undefined) {
      const processedValue = field === 'context' && typeof value === 'object'
        ? value as Record<string, unknown>
        : String(value)

      processedData[field] = processedValue
      processedData[`@${field}`] = processedValue
      processedData[`$${field}`] = processedValue

      if (field === 'context' && typeof value === 'object') {
        const contextObj = value as Record<string, unknown>
        if (contextObj['@vocab'] || contextObj.vocab) {
          processedData['@vocab'] = contextObj['@vocab'] || contextObj.vocab
        }
      }
    }
  }

  // Extract and process worker configuration from all possible sources
  const extractWorkerConfig = (config: Record<string, unknown>): Partial<WorkerConfig> => {
    if (!config || typeof config !== 'object') return {}
    return {
      name: config.name ? String(config.name) : undefined,
      routes: Array.isArray(config.routes) ? config.routes : undefined,
      config: typeof config.config === 'object' ? config.config as Record<string, unknown> : undefined
    }
  }

  // Process all worker config sources in order of precedence
  const workerConfigs = [
    options?.worker,
    processedData.worker,
    processedData['$worker'],
    processedData['@worker']
  ].filter((config): config is Record<string, unknown> => 
    config !== undefined && typeof config === 'object'
  ).map(extractWorkerConfig)

  // Merge worker configurations
  const mergedWorkerConfig: WorkerConfig = {
    name: workerConfigs.find(c => c.name)?.name ?? '',
    routes: workerConfigs.find(c => c.routes)?.routes ?? [],
    config: {
      memory: 128,
      env: {
        NODE_ENV: 'production',
      },
      ...workerConfigs.reduce((acc, c) => ({ ...acc, ...(c.config || {}) }), {}),
      ...(processedData.config as Record<string, unknown> || {})
    }
  }

  // Process special fields with proper type handling
  const processSpecialValue = (value: unknown): string | Record<string, unknown> | unknown[] | Set<unknown> | boolean | undefined => {
    if (value === undefined) return undefined
    if (typeof value === 'object') return value as Record<string, unknown> | unknown[] | Set<unknown>
    if (typeof value === 'boolean') return value
    return String(value)
  }

  // Apply special value processing to metadata fields
  for (const field of specialFields) {
    const value = combinedData[field]
    if (value !== undefined) {
      const processedValue = processSpecialValue(value)
      processedData[field] = processedValue
      processedData[`@${field}`] = processedValue
      processedData[`$${field}`] = processedValue
    }
  }

  // Create final metadata combining all processed data
  const metadata: ExtendedMetadata = {
    ...mergedWorkerConfig,
    ...processedData,
    // Ensure required fields are present
    name: mergedWorkerConfig.name,
    config: {
      memory: 128,
      env: {
        NODE_ENV: 'production'
      },
      ...mergedWorkerConfig.config
    }
  }

  return metadata
}

/**
 * Compiles MDXLD content into a Cloudflare Worker
 */
// Helper functions for YAML preprocessing
const quoteString = (str: string, force = false): string => {
  const trimmed = str.trim()
  const unquoted = trimmed.replace(/^['"]|['"]$/g, '')

  if (
    force ||
    unquoted.startsWith('@') ||
    unquoted.startsWith('$') ||
    unquoted.includes(' ') ||
    unquoted.includes('"') ||
    unquoted.includes("'") ||
    unquoted.includes('/') ||
    unquoted.includes(':')
  ) {
    return `"${unquoted.replace(/"/g, '\\"')}"`
  }

  return unquoted
}

const quoteKey = (key: string): string => {
  return quoteString(key, key.startsWith('@') || key.startsWith('$'))
}

const processValue = (value: string): string => {
  const trimmed = value.trim()
  const unquoted = trimmed.replace(/^['"]|['"]$/g, '')

  // Handle special values
  if (unquoted === 'true' || unquoted === 'false' || !isNaN(Number(unquoted))) {
    return unquoted
  }

  // Handle URLs - preserve exactly as-is
  if (unquoted.includes('://')) {
    return unquoted
  }

  // Quote everything else
  return quoteString(unquoted, unquoted.startsWith('@') || unquoted.startsWith('$'))
}

// Preprocess YAML to handle @ and $ prefixes
const preprocessYaml = (content: string): string => {
  const parts = content.split('---\n')
  if (parts.length < 2) return content

  const [frontmatterContent, ...restContent] = parts
  const processedLines: string[] = []
  let currentIndent = ''

  // Helper to process a line's indentation
  const processIndentation = (line: string): string => {
    const match = line.match(/^(\s*)/)
    return match ? match[1] : ''
  }

  // Process YAML frontmatter line by line
  const lines = frontmatterContent.split('\n')

  for (const line of lines) {
    currentIndent = processIndentation(line)
    const trimmed = line.trim()

    if (!trimmed) {
      processedLines.push(line)
      continue
    }

    // Handle array items
    if (trimmed.startsWith('-')) {
      const [dash, ...rest] = trimmed.split(/\s+/)
      const value = rest.join(' ')
      const processedValue = value ? processValue(value) : ''
      processedLines.push(`${currentIndent}${dash} ${processedValue}`)
      continue
    }

    // Handle key-value pairs
    const keyValueMatch = trimmed.match(/^([^:]+):(.*)$/)
    if (keyValueMatch) {
      const [, rawKey, rawValue] = keyValueMatch
      const key = rawKey.trim()
      const value = rawValue.trim()

      // Special handling for prefixed keys
      const baseKey = key.replace(/^[@$]/, '')
      const isSpecialField = ['type', 'id', 'context', 'list', 'vocab'].includes(baseKey)
      const hasPrefix = key.startsWith('@') || key.startsWith('$')

      // Process key - preserve original prefix
      const quotedKey = hasPrefix ? `"${key}"` : quoteKey(key)

      // Handle different value types
      let processedValue = ''
      if (value.startsWith('{') || value.startsWith('[')) {
        // Preserve object and array structures
        processedValue = value
      } else if (isSpecialField && (value.startsWith('@') || value.startsWith('$'))) {
        // Preserve prefixed values for special fields
        processedValue = `"${value}"`
      } else if (value.includes('://')) {
        // Preserve URLs
        processedValue = `"${value}"`
      } else if (value === 'true' || value === 'false' || !isNaN(Number(value))) {
        // Preserve boolean and numeric values
        processedValue = value
      } else if (value.startsWith('@') || value.startsWith('$')) {
        // Preserve prefixed values
        processedValue = `"${value}"`
      } else {
        // Process other values
        processedValue = value ? processValue(value) : ''
      }

      processedLines.push(`${currentIndent}${quotedKey}: ${processedValue}`)
      continue
    }

    // Pass through any other lines unchanged
    processedLines.push(line)
  }

  // Reconstruct the document
  return `${processedLines.join('\n')}\n---\n${restContent.join('---\n')}`
}

export async function compile(source: string, options: CompileOptions): Promise<string> {
  try {
    // Parse MDXLD content with preprocessed YAML
    const mdxld = parse(preprocessYaml(source))

    // Extract worker metadata and merge with options
    const metadata = extractWorkerMetadata(mdxld, options)

    // Create worker context with properly typed metadata
    const workerContext: WorkerContext = {
      metadata: {
        ...metadata,
        // Handle special fields with proper type assertions
        type: (metadata.$type ?? metadata['@type'] ?? metadata.type) as string | undefined,
        context: (() => {
          const ctx = metadata.$context ?? metadata['@context'] ?? metadata.context
          if (!ctx) return undefined
          return typeof ctx === 'object' ? ctx as Record<string, unknown> : String(ctx)
        })(),
        id: (metadata.$id ?? metadata['@id'] ?? metadata.id) as string | undefined,
        // Preserve config with defaults
        config: {
          memory: 128,
          env: {
            NODE_ENV: 'production',
          },
          ...(metadata.config || {}),
        },
      },
      content: mdxld.content,
    }

    // Process nested metadata structures
    function processNestedMetadata(obj: ExtendedMetadata): ExtendedMetadata {
      const result: ExtendedMetadata = {
        name: obj.name,
        config: {
          memory: obj.config?.memory ?? 128,
          env: obj.config?.env ?? { NODE_ENV: 'production' },
          ...obj.config
        }
      }

      for (const [key, value] of Object.entries(obj)) {
        if (key === 'name' || key === 'config') continue // Skip already handled fields

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Process nested objects while preserving type information
          if (key === 'config') {
            result.config = {
              memory: (value as ExtendedMetadata['config']).memory ?? 128,
              env: (value as ExtendedMetadata['config']).env ?? { NODE_ENV: 'production' },
              ...(value as Record<string, unknown>)
            }
          } else {
            result[key] = value as Record<string, unknown>
          }
        } else if (Array.isArray(value)) {
          // Preserve arrays
          result[key] = value
        } else {
          // Handle special fields with proper prefix handling
          const unprefixedKey = key.replace(/^[@$]/, '')
          if (['type', 'context', 'id'].includes(unprefixedKey)) {
            const processedValue = String(value)
            result[unprefixedKey] = processedValue
            result[`@${unprefixedKey}`] = processedValue
            result[`$${unprefixedKey}`] = processedValue
          } else {
            result[key] = value
          }
        }
      }

      return result
    }

    // Process nested structures in metadata while preserving required fields
    workerContext.metadata = processNestedMetadata(workerContext.metadata as ExtendedMetadata)

    // Generate worker code as ESM
    const workerCode = `
      // Worker context
      globalThis.WORKER_CONTEXT = ${JSON.stringify(workerContext, null, 2).replace(/\n/g, '\n      ')};
      
      // Create fetch handler
      async function handleFetch(request) {
        return new Response(WORKER_CONTEXT.content, {
          headers: {
            'Content-Type': 'text/html',
            'X-MDXLD-Metadata': JSON.stringify(WORKER_CONTEXT.metadata),
          },
        });
      }

      // Export fetch handler
      export default { fetch: handleFetch };
    `

    // Build worker bundle
    try {
      const result = await esbuild.build({
        stdin: {
          contents: workerCode,
          loader: 'js',
        },
        write: false,
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        target: ['esnext'],
        mainFields: ['module', 'main'],
        define: {
          'process.env.NODE_ENV': '"production"',
        },
      })

      if (!result.outputFiles?.[0]) {
        throw new Error('Failed to generate worker bundle')
      }

      return result.outputFiles[0].text
    } catch (error: unknown) {
      const buildError = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to build worker bundle: ${buildError}`)
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to compile MDXLD worker: ${errorMessage}`)
  }
}
