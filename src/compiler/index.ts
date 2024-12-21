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
  const specialFields = ['type', 'context', 'id']
  specialFields.forEach(field => {
    const value = mdxld[field] || 
                 processedData[`$${field}`] || 
                 processedData[`@${field}`] || 
                 processedData[field]
    
    if (value !== undefined) {
      // Store all versions of the field
      processedData[field] = value
      processedData[`@${field}`] = value
      processedData[`$${field}`] = value
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
    // Ensure list metadata is preserved
    ...(processedData.list ? { list: processedData.list } : {}),
    // Ensure prefixed properties are preserved
    ...(processedData['@type'] ? { '@type': processedData['@type'] } : {}),
    ...(processedData['$type'] ? { '$type': processedData['$type'] } : {}),
    ...(processedData['@id'] ? { '@id': processedData['@id'] } : {}),
    ...(processedData['$id'] ? { '$id': processedData['$id'] } : {}),
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
// Helper functions for YAML preprocessing
const quoteString = (str: string, force = false): string => {
  const trimmed = str.trim()
  const unquoted = trimmed.replace(/^['"]|['"]$/g, '')
  
  if (force ||
      unquoted.startsWith('@') || 
      unquoted.startsWith('$') ||
      unquoted.includes(' ') || 
      unquoted.includes('"') || 
      unquoted.includes("'") || 
      unquoted.includes('/') || 
      unquoted.includes(':')) {
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

      // Process key
      const quotedKey = quoteKey(key)

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
