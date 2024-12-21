import type { WorkerContext, WorkerConfig } from '../types'
import { parse } from 'mdxld'
import type { MDXLD } from 'mdxld'
import * as esbuild from 'esbuild'

// Extended metadata type for internal use
export type ExtendedMetadata = WorkerConfig & {
  type?: string
  context?: string | Record<string, unknown>
  language?: string
  base?: string
  vocab?: string
  list?: unknown[]
  set?: Set<unknown>
  reverse?: boolean
  config?: {
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
  // Process metadata recursively to handle nested objects
  const processMetadata = (data: Record<string, unknown>): Record<string, unknown> => {
    if (!data || typeof data !== 'object') return {}

    const result: Record<string, unknown> = {}

    // Deep clone arrays
    const cloneArray = (arr: unknown[]): unknown[] =>
      arr.map((item) => {
        if (Array.isArray(item)) return cloneArray(item)
        if (item && typeof item === 'object') return processMetadata(item as Record<string, unknown>)
        return item
      })

    // Process all keys
    for (const [key, value] of Object.entries(data)) {
      // Remove quotes from keys if present
      const cleanKey = key.replace(/^(['"])(.*)\1$/, '$2')
      const prefix = cleanKey.match(/^[@$]/)?.[0]
      const unprefixedKey = prefix ? cleanKey.slice(1) : cleanKey

      // Process value based on type
      const processedValue = Array.isArray(value)
        ? cloneArray(value)
        : value && typeof value === 'object'
          ? processMetadata(value as Record<string, unknown>)
          : value

      // Store both prefixed and unprefixed versions
      if (prefix) {
        // Store original prefixed version
        result[cleanKey] = processedValue
        // Store unprefixed version
        result[unprefixedKey] = processedValue
        // Store alternate prefix version
        const otherPrefix = prefix === '@' ? '$' : '@'
        result[`${otherPrefix}${unprefixedKey}`] = processedValue
      } else {
        // Store original unprefixed version
        result[cleanKey] = processedValue
      }

      // Special handling for context object
      if ((cleanKey === 'context' || cleanKey === '@context' || cleanKey === '$context') && typeof processedValue === 'object') {
        const contextObj = processedValue as Record<string, unknown>
        const newContext: Record<string, unknown> = {}

        // Process context properties
        Object.entries(contextObj).forEach(([k, v]) => {
          if (k === 'vocab') {
            newContext['@vocab'] = v
          } else if (k.startsWith('@') || k.startsWith('$')) {
            // Preserve prefixed properties
            newContext[k] = v
          } else {
            newContext[k] = v
          }
        })

        result.context = newContext
      }

      // Special handling for worker configuration
      if (cleanKey === 'worker' || cleanKey === '@worker' || cleanKey === '$worker') {
        const config = processedValue as Record<string, unknown>
        if (config?.name) result.name = config.name
        if (config?.routes) result.routes = config.routes
      }

      // Special handling for list metadata
      if (cleanKey === 'list' || cleanKey === '@list' || cleanKey === '$list') {
        result.list = Array.isArray(processedValue) ? processedValue : [processedValue]
      }
    }

    return result
  }

  // Process all metadata
  const processedData = processMetadata(mdxld.data ?? {})

  // Handle special fields from mdxld and data
  const specialFields = ['type', 'context', 'id', 'language', 'base', 'vocab', 'list', 'set', 'reverse'] as const
  specialFields.forEach((field) => {
    // Try to get value from all possible sources, prioritizing prefixed versions
    const value = 
      processedData[`$${field}`] || 
      processedData[`@${field}`] || 
      processedData[field] ||
      mdxld[field]

    if (value !== undefined) {
      // Store unprefixed version
      processedData[field] = value
      // Store prefixed versions
      processedData[`@${field}`] = value
      processedData[`$${field}`] = value

      // Special handling for context object
      if (field === 'context' && typeof value === 'object') {
        const contextObj = value as Record<string, unknown>
        const processedContext: Record<string, unknown> = {}
        
        Object.entries(contextObj).forEach(([k, v]) => {
          // Handle vocab specially
          if (k === 'vocab' || k === '@vocab' || k === '$vocab') {
            processedContext['@vocab'] = v
          } else {
            // Store both prefixed and unprefixed versions
            const cleanKey = k.replace(/^[@$]/, '')
            processedContext[k] = v
            processedContext[cleanKey] = v
          }
        })
        
        processedData.context = processedContext
        processedData['@context'] = processedContext
        processedData['$context'] = processedContext
      }

      // Special handling for Set values
      if (field === 'set' && Array.isArray(value)) {
        processedData.set = new Set(value)
      }
    }
  })

  // Process nested objects and arrays
  Object.entries(processedData).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      // Preserve object structure
      processedData[key] = value

      // Handle prefixed versions if needed
      const baseKey = key.replace(/^[@$]/, '')
      if (key.startsWith('@') || key.startsWith('$')) {
        processedData[`@${baseKey}`] = value
        processedData[`$${baseKey}`] = value
        processedData[baseKey] = value
      }
    }
  })

  // Extract worker configuration and ensure proper typing
  const workerData = (processedData['$worker'] || processedData['@worker']) as WorkerConfig | undefined

  // Start with base metadata
  const baseMetadata: ExtendedMetadata = {
    name: '',
    routes: [],
    config: {
      memory: 128,
      env: {
        NODE_ENV: 'production',
      },
    },
    // Ensure all special fields are preserved
    type: mdxld.type,
    context: mdxld.context,
    language: mdxld.language,
    base: mdxld.base,
    vocab: mdxld.vocab,
    list: mdxld.list,
    set: mdxld.set,
    reverse: mdxld.reverse
  }

  // Add prefixed properties with proper type assertions
  const prefixedMetadata = {
    '@type': processedData['@type'] as string | undefined,
    '$type': processedData['$type'] as string | undefined,
    '@id': processedData['@id'] as string | undefined,
    '$id': processedData['$id'] as string | undefined,
    '@context': processedData['@context'] as string | Record<string, unknown> | undefined,
    '$context': processedData['$context'] as string | Record<string, unknown> | undefined,
    // Add special fields without prefix if they exist with either prefix
    type: (processedData['@type'] || processedData['$type']) as string | undefined,
    id: (processedData['@id'] || processedData['$id']) as string | undefined,
    context: (processedData['@context'] || processedData['$context']) as string | Record<string, unknown> | undefined
  }

  // Combine base metadata with processed data and prefixed properties
  const metadata: ExtendedMetadata = {
    ...baseMetadata,
    ...processedData,
    ...prefixedMetadata
  }

  // Apply options if provided
  if (options?.worker) {
    metadata.name = options.worker.name || metadata.name
    metadata.routes = options.worker.routes || metadata.routes
  }

  // Extract worker configuration from metadata if present
  const extractWorkerConfig = (config: Record<string, unknown>) => {
    if (config.name) {
      metadata.name = String(config.name)
    }
    if (Array.isArray(config.routes)) {
      metadata.routes = config.routes
    }
    if (config.config && typeof config.config === 'object') {
      metadata.config = {
        ...metadata.config,
        ...(config.config as Record<string, unknown>),
      }
    }
  }

  // Try all possible worker config sources
  if (workerData) {
    extractWorkerConfig(workerData)
  } else if (processedData.worker && typeof processedData.worker === 'object') {
    extractWorkerConfig(processedData.worker as Record<string, unknown>)
  } else if (processedData['$worker'] && typeof processedData['$worker'] === 'object') {
    extractWorkerConfig(processedData['$worker'] as Record<string, unknown>)
  } else if (processedData['@worker'] && typeof processedData['@worker'] === 'object') {
    extractWorkerConfig(processedData['@worker'] as Record<string, unknown>)
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
