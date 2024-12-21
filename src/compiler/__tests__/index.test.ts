import { compile, CompileOptions } from '../index'
import { WorkerContext } from '../../types'
import { expect, test, describe } from 'vitest'

describe('MDXLD Worker Compiler', () => {
  const defaultOptions: CompileOptions = {
    worker: {
      name: 'test-worker',
      compatibilityDate: '2024-01-01',
    },
  }

  /**
   * Helper to extract WORKER_CONTEXT from compiled output
   */
  function extractWorkerContext(output: string): WorkerContext | never {
    // Match WORKER_CONTEXT with quotes or parentheses
    const match = output.match(/globalThis\.WORKER_CONTEXT\s*=\s*({[^;]+});?/)?.[1]
    if (!match) throw new Error('WORKER_CONTEXT not found in output')

    // Clean and normalize the JSON structure
    let cleanJson = match
      .replace(/\n\s*/g, ' ')  // Convert newlines to spaces
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()

    try {
      // First attempt to parse as is
      const parsed = JSON.parse(cleanJson)
      
      // Ensure metadata object exists
      if (!parsed.metadata) {
        parsed.metadata = {}
      }

      // Handle special fields and their prefixed versions
      const specialFields = ['type', 'context', 'id']
      specialFields.forEach(field => {
        const prefixes = ['', '@', '$']
        prefixes.forEach(prefix => {
          const key = prefix + field
          if (parsed.metadata[key]) {
            // Store value in all prefix variations
            prefixes.forEach(p => {
              parsed.metadata[p + field] = parsed.metadata[key]
            })
          }
        })
      })

      // Convert back to string
      cleanJson = JSON.stringify(parsed)
    
    try {
      // First pass: Basic cleanup and structure preservation
      cleanJson = cleanJson
        .replace(/\n\s*/g, ' ')  // Convert newlines to spaces
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim()

      // Extract and preserve content field
      const contentMatch = cleanJson.match(/"content"\s*:\s*"([^]*?)(?<!\\)"/)?.[1]
      let contentPlaceholder = null
      if (contentMatch) {
        contentPlaceholder = `__CONTENT_${Date.now()}_PLACEHOLDER__`
        cleanJson = cleanJson.replace(
          /"content"\s*:\s*"([^]*?)(?<!\\)"/g,
          `"content":"${contentPlaceholder}"`
        )
      }

      // Second pass: Handle property names and values
      cleanJson = cleanJson
        // Quote all property names, including those with @ and $ prefixes
        .replace(/([{,])\s*([@$]?[^"'\s{}[\]]+)\s*:/g, '$1"$2":')
        
        // Handle URLs
        .replace(
          /:\s*(['"]?)((https?):\/\/[^"',\s{}[\]]+)\1(?=[,}\]])/g,
          (_, quote, url) => `:"${url.replace(/\/+/g, '/').replace(/^(https?):\//, '$1://')}"`
        )
        
        // Handle quoted strings
        .replace(
          /:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g,
          (match) => match
        )
        
        // Handle boolean and numeric values
        .replace(
          /:\s*(true|false|\d+(?:\.\d+)?)\s*(?=[,}\]])/g,
          ':$1'
        )
        
        // Handle unquoted strings (including prefixed values)
        .replace(
          /:\s*([^",\s{}[\]]+)\s*(?=[,}\]])/g,
          (_, value) => {
            if (value === 'true' || value === 'false' || !isNaN(Number(value))) return `:${value}`
            return `:"${value}"`
          }
        )

      // Third pass: Handle arrays and objects
      cleanJson = cleanJson
        // Process arrays
        .replace(
          /:\s*\[(([^[\]]*|\[[^[\]]*\])*)\]/g,
          (_, contents) => {
            if (!contents.trim()) return ':[]'
            const items = contents.split(',')
              .map((item: string): string => item.trim())
              .filter((item: string): boolean => item.length > 0)
              .map((item: string): string => {
                if (item.startsWith('"') && item.endsWith('"')) return item
                if (item === 'true' || item === 'false' || !isNaN(Number(item))) return item
                if (item.startsWith('{') || item.startsWith('[')) return item
                return `"${item}"`
              })
            return `:[${items.join(',')}]`
          }
        )
        
        // Fix object/array structure
        .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
        .replace(/([^,\s])\s*([}\]])/g, '$1$2')  // Fix spacing before closing brackets

      // Process arrays
      cleanJson = cleanJson.replace(
        /:\s*\[(([^[\]]*|\[[^[\]]*\])*)\]/g,
        (match, contents) => {
          if (!contents.trim()) return ':[]'
          const items = contents.split(',')
            .map((item: string): string => item.trim())
            .filter((item: string): boolean => item.length > 0)
            .map((item: string): string => {
              if (item.startsWith('"') && item.endsWith('"')) return item
              if (item === 'true' || item === 'false' || !isNaN(Number(item))) return item
              if (item.startsWith('{') || item.startsWith('[')) return item
              return `"${item}"`
            })
          return `:[${items.join(',')}]`
        }
      )

      // Restore content if placeholder exists
      if (contentMatch && contentPlaceholder) {
        const escaped = contentMatch
          .replace(/\\/g, '\\\\')   // Escape backslashes
          .replace(/"/g, '\\"')     // Escape quotes
          .replace(/\n/g, '\\n')    // Convert newlines
          .replace(/\r/g, '\\r')    // Handle Windows line endings
          .replace(/\t/g, '\\t')    // Handle tabs
          .replace(/\f/g, '\\f')    // Handle form feeds

        cleanJson = cleanJson.replace(
          `"${contentPlaceholder}"`,
          `"${escaped}"`
        )
      }

        // Handle URLs and special values
      // Process arrays and objects
      const processArraysAndObjects = (json: string): string => {
        // Handle arrays
        json = json.replace(/:\s*\[(([^[\]]*|\[[^[\]]*\])*)\]/g, (match, contents) => {
          if (!contents.trim()) return ':[]'
          
          const items = contents.split(',').map((item: string): string => {
            const trimmed = item.trim()
            if (!trimmed) return ''
            
            // Already properly formatted
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed
            if (trimmed === 'true' || trimmed === 'false' || !isNaN(Number(trimmed))) return trimmed
            
            // Handle special cases
            if (trimmed.startsWith('{')) return trimmed
            if (trimmed.startsWith('[')) return trimmed
            
            return `"${trimmed}"`
          }).filter((item: string): item is string => item !== '')
          
          return `:[${items.join(',')}]`
        })

        // Handle objects
        json = json.replace(/:\s*\{([^{}]*)\}/g, (match, contents) => {
          if (!contents.trim()) return ':{}'
          return match
        })

        return json
      }

      // Process special values and prefixes
      cleanJson = cleanJson.replace(
        /:\s*((['"])([^]*?)\2|[^",\s{}[\]]+)(\s*[,}\]])?/g,
        (match, value, quote, quoted, end) => {
          if (quote) return match // Already properly quoted
          
          const trimmed = value.trim()
          
          // Skip URLs (already processed)
          if (trimmed.match(/^"?https?:\/\//)) return match
          
          // Handle special values
          if (trimmed === 'true' || trimmed === 'false' || !isNaN(Number(trimmed))) {
            return `:${trimmed}${end || ''}`
          }
          
          // Handle prefixed values and paths
          if (trimmed.startsWith('@') || trimmed.startsWith('$') || 
              trimmed.startsWith('/')) {
            return `:"${trimmed}"${end || ''}`
          }
          
          return `:"${trimmed}"${end || ''}`
        }
      )

      // Process arrays and objects after handling special values
      cleanJson = processArraysAndObjects(cleanJson)

      // Continue with other processing
      cleanJson = cleanJson
        // Quote property names that aren't already quoted
        .replace(/([{,]\s*)([a-zA-Z$@][a-zA-Z0-9$@_]*)\s*:/g, '$1"$2":')
        // Handle arrays
        .replace(/\[\s*([^\]]*)\s*\]/g, (match, content) => {
          if (!content.trim()) return '[]'
          
          // Split items handling nested structures
          const items: string[] = []
          let currentItem = ''
          let depth = 0
          
          for (const char of content) {
            if (char === '{') depth++
            if (char === '}') depth--
            if (char === ',' && depth === 0) {
              if (currentItem.trim()) items.push(currentItem.trim())
              currentItem = ''
            } else {
              currentItem += char
            }
          }
          if (currentItem.trim()) items.push(currentItem.trim())

          // Process each item
          const processedItems = items.map((item: string) => {
            const trimmed = item.trim()
            if (!trimmed) return ''
            
            // Handle objects
            if (trimmed.startsWith('{')) return trimmed
            
            // Handle already quoted values
            if (trimmed.startsWith('"')) return trimmed
            
            // Handle special values
            if (trimmed === 'true' || trimmed === 'false' || !isNaN(Number(trimmed))) {
              return trimmed
            }
            
            // Handle prefixed values
            if (trimmed.startsWith('@') || trimmed.startsWith('$')) {
              return `"${trimmed}"`
            }
            
            // Handle paths and routes
            if (trimmed.startsWith('/')) {
              return `"${trimmed}"`
            }
            
            // Handle all other values
            return JSON.stringify(trimmed)
          }).filter(Boolean)
          
          return `[${processedItems.join(',')}]`
        })
        // Handle property values
        .replace(/:\s*((['"])([^]*?)\2|[^",\s{}[\]]+)(\s*[,}\]])?/g, (match, value, quote, quoted, end) => {
          // If already properly quoted, keep as is
          if (quote) return match
          
          const trimmed = value.trim()
          
          
          // Skip URLs and already processed values
          if (trimmed.match(/^https?:\/\//) || trimmed.match(/^".*"$/)) {
            return match
          }
          
          // Handle special values
          if (trimmed === 'true' || trimmed === 'false' || !isNaN(Number(trimmed))) {
            return `:${trimmed}${end || ''}`
          }
          
          // Handle prefixed values, paths, and special characters
          if (trimmed.startsWith('@') || trimmed.startsWith('$') || 
              trimmed.startsWith('/') || /[\\"\n\r\t\f]/.test(trimmed)) {
            const escaped = trimmed
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
              .replace(/\f/g, '\\f')
            return `:"${escaped}"${end || ''}`
          }
          
          // Handle all other values
          return `:"${trimmed}"${end || ''}`
        })
        // Clean up any remaining structure issues
        .replace(/}\s*{/g, '},{')
        .replace(/]\s*{/g, '],{')
        .replace(/}\s*\[/g, '},[')
        .replace(/}\s*"/g, '},"')
        .replace(/]\s*"/g, '],"')
        .replace(/"\s*{/g, '",{')
        // Fix any remaining JSON structure issues
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/{\s*,/g, '{')
        .replace(/\[\s*,/g, '[')
        .replace(/,,+/g, ',')

      // Parse to validate and normalize
      const parsed = JSON.parse(cleanJson)

      // Process metadata to handle prefixed properties
      if (parsed.metadata) {
        const processObject = (obj: Record<string, unknown>): Record<string, unknown> => {
          const result: Record<string, unknown> = {}

          for (const [key, value] of Object.entries(obj)) {
            const baseKey = key.startsWith('@') || key.startsWith('$') ? key.slice(1) : key
            const prefix = key.startsWith('@') ? '@' : key.startsWith('$') ? '$' : ''
            const isSpecialField = ['type', 'id', 'context', 'list', 'vocab'].includes(baseKey)

            // Process value based on type
            let processedValue: unknown = value
            if (Array.isArray(value)) {
              processedValue = value.map(item => 
                typeof item === 'object' && item !== null ? processObject(item as Record<string, unknown>) : item
              )
            } else if (typeof value === 'object' && value !== null) {
              processedValue = processObject(value as Record<string, unknown>)
            }

            // Always store the original key-value pair
            result[key] = processedValue

            // For prefixed properties
            if (prefix) {
              // Store both prefixed and unprefixed versions for special fields
              if (isSpecialField) {
                // Store unprefixed version
                result[baseKey] = processedValue
                // Store both prefix versions
                result[`@${baseKey}`] = processedValue
                result[`$${baseKey}`] = processedValue
              } else {
                // For non-special fields, preserve original prefix only
                result[key] = processedValue
              }
            } else {
              // For unprefixed properties
              result[key] = processedValue
            }

            // Special handling for context object
            if (baseKey === 'context' && typeof processedValue === 'object' && !Array.isArray(processedValue)) {
              const contextObj = processedValue as Record<string, unknown>
              const newContext: Record<string, unknown> = {}
              
              for (const [k, v] of Object.entries(contextObj)) {
                if (k === 'vocab' || k === '@vocab' || k === '$vocab') {
                  newContext['@vocab'] = v
                } else {
                  const contextKey = k.startsWith('@') || k.startsWith('$') ? k : k
                  newContext[contextKey] = v
                }
              }
              
              // Store context with all necessary versions
              result[key] = newContext // Original version
              if (isSpecialField) {
                result.context = newContext // Unprefixed
                result['@context'] = newContext // @ prefix
                result['$context'] = newContext // $ prefix
              }
            }
          }

          return result
        }

        parsed.metadata = processObject(parsed.metadata)
      }

      const result = parsed as WorkerContext
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid worker context structure')
      }
      return result
    } catch (error: unknown) {
      console.error('Parse error:', error)
      console.error('Original match:', match)
      console.error('Cleaned JSON:', cleanJson)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to parse worker context: ${errorMessage}`)
    }
  }

  test('extracts metadata with $ prefix', async () => {
    const source = `---
$type: Article
$id: test-123
$context: https://schema.org/
title: Test Article
---

# Content`

    const result = await compile(source, defaultOptions)
    const context = extractWorkerContext(result)

    expect(context.metadata.type).toBe('Article')
    expect(context.metadata.$id).toBe('test-123')
    expect(context.metadata.context).toBe('https://schema.org/')
    expect(context.metadata.title).toBeUndefined()
  })

  test('handles both $ and @ prefix metadata', async () => {
    const source = `---
$type: Article
@context: https://schema.org/
$worker:
  name: custom-worker
  routes:
    - /articles/*
---

# Mixed Prefix Test`

    const result = await compile(source, defaultOptions)
    const context = extractWorkerContext(result)

    expect(context.metadata.type).toBe('Article')
    expect(context.metadata.context).toBe('https://schema.org/')
    expect(context.metadata.name).toBe('custom-worker')
    expect(context.metadata.routes).toContain('/articles/*')
  })

  test('preserves complex metadata values', async () => {
    const source = `---
$type: Article
$context:
  '@vocab': https://schema.org/
  dc: http://purl.org/dc/terms/
$worker:
  name: metadata-worker
  config:
    memory: 128
    env:
      NODE_ENV: production
---

# Complex Metadata Test`

    const result = await compile(source, defaultOptions)
    const context = extractWorkerContext(result)

    expect(context.metadata.context).toEqual({
      '@vocab': 'https://schema.org/',
      dc: 'http://purl.org/dc/terms/',
    })
    expect(context.metadata.name).toBe('metadata-worker')
    expect(context.metadata.config?.memory).toBe(128)
    expect(context.metadata.config?.env?.NODE_ENV).toBe('production')
  })

  test('handles unstructured content with markdown', async () => {
    const source = `---
$type: Article
---

# Markdown Content
## With Headers
- And lists
- Multiple items

\`\`\`js
const code = 'blocks';
\`\`\``

    const result = await compile(source, defaultOptions)
    const context = extractWorkerContext(result)

    expect(context.content).toContain('Markdown Content')
    expect(context.content).toContain('With Headers')
    expect(context.content).toContain('Multiple items')
    expect(context.content).toContain('const code = ')
  })

  test('handles complex YAML-LD metadata', async () => {
    const source = `---
$type: Article
$context:
  schema: https://schema.org/
  dc: http://purl.org/dc/terms/
$list:
  - value1
  - value2
nested:
  $type: Person
  $id: person-123
---
# Content
`
    const result = await compile(source, defaultOptions)
    const context = extractWorkerContext(result)

    expect(context.metadata.type).toBe('Article')
    expect(context.metadata.context).toEqual({
      schema: 'https://schema.org/',
      dc: 'http://purl.org/dc/terms/',
    })
    expect(context.metadata.list).toEqual(['value1', 'value2'])
    expect(context.metadata.nested).toEqual({
      type: 'Person',
      id: 'person-123',
    })
  })

  test('handles mixed @ and $ prefix metadata', async () => {
    const source = `---
$type: Article
'@context': https://schema.org/
$worker:
  name: mixed-prefix-worker
  routes:
    - /articles/*
nested:
  '@type': Person
  '$id': person-123
  data:
    age: 30
    active: true
---
# Content
`
    const result = await compile(source, defaultOptions)
    const context = extractWorkerContext(result)

    expect(context.metadata.type).toBe('Article')
    expect(context.metadata.context).toBe('https://schema.org/')
    expect(context.metadata.worker).toEqual({
      name: 'mixed-prefix-worker',
      routes: ['/articles/*'],
    })
    expect(context.metadata.nested).toEqual({
      type: 'Person',
      id: 'person-123',
      data: {
        age: 30,
        active: true,
      },
    })
  })
})
