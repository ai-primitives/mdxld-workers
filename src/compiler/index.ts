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
    // Preprocess YAML to handle @ and $ prefixes
    const preprocessYaml = (content: string): string => {
      const [frontmatter, ...rest] = content.split('---\n')
      if (!frontmatter || !rest.length) return content

      const processedLines: string[] = []
      const indentStack: string[] = []
      let currentIndent = ''
      let inArray = false
      let inQuotedValue = false

      const quoteKey = (key: string): string => {
        const trimmed = key.trim()
        // Remove existing quotes if any
        const unquoted = trimmed.replace(/^['"]|['"]$/g, '')

        // Don't quote @ or $ prefixed keys to maintain YAML-LD compatibility
        if (unquoted.startsWith('@') || unquoted.startsWith('$')) {
          return unquoted
        }

        // Quote keys that:
        // 1. Contain special characters
        // 2. Are already quoted
        // 3. Are in an array context
        // 4. Contain URLs or paths
        if (unquoted.includes(' ') || unquoted.includes('"') || unquoted.includes("'") || unquoted.includes('/') || unquoted.includes(':') || inArray) {
          return `"${unquoted.replace(/"/g, '\\"')}"`
        }

        return unquoted
      }

      const processValue = (value: string): string => {
        const trimmed = value.trim()

        // Handle special values
        if (trimmed === 'true' || trimmed === 'false') {
          return trimmed
        }

        // Handle numeric values
        if (!isNaN(Number(trimmed)) && trimmed !== '') {
          return trimmed
        }

        // Handle @ and $ prefixed values
        if (trimmed.startsWith('@') || trimmed.startsWith('$')) {
          return trimmed
        }

        // Quote values that:
        // 1. Contain special characters
        // 2. Are already quoted
        // 3. Are in an array (unless boolean/number)
        // 4. Contain URLs or paths
        // 5. Contain colons or slashes
        if (
          trimmed.includes(' ') ||
          trimmed.includes('"') ||
          trimmed.includes("'") ||
          trimmed.includes('/') ||
          trimmed.includes(':') ||
          (inArray && !inQuotedValue)
        ) {
          return `"${trimmed.replace(/"/g, '\\"')}"`
        }

        return trimmed
      }

      frontmatter.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed) {
          processedLines.push(line)
          return
        }

        const indent = line.match(/^\s*/)?.[0] || ''

        // Handle array items
        if (trimmed.startsWith('-')) {
          inArray = true
          if (trimmed.match(/^-\s*[@$]/)) {
            // Handle array items with @ or $ prefixes
            const [dash, ...rest] = trimmed.split(/\s+/)
            const key = rest.join(' ')
            const quotedKey = processValue(key)
            processedLines.push(`${indent}${dash} ${quotedKey}`)
          } else if (trimmed.includes(':')) {
            // Handle array items with key-value pairs
            const [dash, keyValue] = trimmed.split(/\s+(.*)/)
            const [key, ...valueParts] = keyValue.split(':')
            const value = valueParts.join(':').trim()
            const quotedKey = quoteKey(key)

            // Handle special values
            let processedValue = ''
            if (value) {
              if (value === 'true' || value === 'false' || !isNaN(Number(value))) {
                processedValue = ` ${value}`
              } else if (value.startsWith('@') || value.startsWith('$')) {
                processedValue = ` ${value}`
              } else {
                processedValue = ` ${processValue(value)}`
              }
            }

            processedLines.push(`${indent}${dash} ${quotedKey}:${processedValue}`)
          } else {
            // Handle simple array items
            const value = trimmed.slice(1).trim()
            if (value === 'true' || value === 'false' || !isNaN(Number(value))) {
              processedLines.push(`${indent}- ${value}`)
            } else if (value.startsWith('@') || value.startsWith('$')) {
              processedLines.push(`${indent}- ${value}`)
            } else {
              const processedValue = processValue(value)
              processedLines.push(`${indent}- ${processedValue}`)
            }
          }
          return
        }

        // Track nested block state
        if (trimmed.endsWith(':')) {
          if (!inArray) {
            indentStack.push(currentIndent)
            currentIndent = indent
          }
          // Quote key if needed
          const key = trimmed.slice(0, -1)
          const quotedKey = quoteKey(key)
          processedLines.push(`${indent}${quotedKey}:`)
          return
        }

        // Check if we're exiting a nested block or array
        if (indent.length <= currentIndent.length) {
          inArray = false
          while (indentStack.length && indent.length <= currentIndent.length) {
            currentIndent = indentStack.pop() || ''
          }
        }

        // Handle key-value pairs
        const colonIndex = line.indexOf(':')
        if (colonIndex === -1) {
          processedLines.push(line)
          return
        }

        const key = line.slice(0, colonIndex).trim()
        const value = line.slice(colonIndex + 1).trim()
        const quotedKey = quoteKey(key)

        // Handle special values
        let processedValue = ''
        if (value) {
          if (value === 'true' || value === 'false' || !isNaN(Number(value))) {
            processedValue = ` ${value}`
          } else if (value.startsWith('@') || value.startsWith('$')) {
            processedValue = ` ${processValue(value)}`
          } else if (value.includes(':') || value.includes('/')) {
            processedValue = ` ${processValue(value)}`
          } else {
            processedValue = ` ${processValue(value)}`
          }
        }

        processedLines.push(`${indent}${quotedKey}:${processedValue}`)
      })

      return [processedLines.join('\n'), ...rest].join('---\n')
    }

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
    const workerTemplate = await esbuild.build({
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

    if (!workerTemplate.outputFiles?.[0]) {
      throw new Error('Failed to generate worker bundle')
    }

    return workerTemplate.outputFiles[0].text
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to compile MDXLD worker: ${errorMessage}`)
  }
}
