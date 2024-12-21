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
  function extractWorkerContext(output: string): WorkerContext {
    // Match WORKER_CONTEXT with quotes or parentheses
    const match = output.match(/globalThis\.WORKER_CONTEXT\s*=\s*({[^;]+});?/)?.[1]
    if (!match) throw new Error('WORKER_CONTEXT not found in output')

    let cleanJson = ''
    try {
      // First pass: Basic cleanup and structure preservation
      cleanJson = match
        // Remove newlines and normalize spaces
        .replace(/\s+/g, ' ')
        // Handle quoted string values
        .replace(/:\s*"([^"]*)"(\s*[,}\]])?/g, (_, value, end) => {
          return `:${JSON.stringify(value)}${end || ''}`
        })
        // Quote property names
        .replace(/([{,]\s*)([a-zA-Z$@][a-zA-Z0-9$@_]*)\s*:/g, '$1"$2":')
        // Handle arrays with proper value handling
        .replace(/\[\s*([^\]]*)\s*\]/g, (match, content) => {
          if (!content.trim()) return '[]'
          const items = content.split(',').map((item: string) => {
            const trimmed = item.trim()
            if (!trimmed) return ''
            if (trimmed.startsWith('"')) return trimmed
            if (trimmed === 'true' || trimmed === 'false' || !isNaN(Number(trimmed))) return trimmed
            return JSON.stringify(trimmed)
          }).filter(Boolean)
          return `[${items.join(',')}]`
        })
        // Handle unquoted values
        .replace(/:\s*([^",\s{}[\]]+)(\s*[,}\]])/g, (_, value, end) => {
          const trimmed = value.trim()
          if (trimmed === 'true' || trimmed === 'false' || !isNaN(Number(trimmed))) {
            return `:${trimmed}${end}`
          }
          return `:${JSON.stringify(trimmed)}${end}`
        })
        // Fix object structure
        .replace(/}(\s*["{])/g, '},$1')
        .replace(/](\s*["{[])/g, '],$1')
        // Fix trailing commas
        .replace(/,(\s*[}\]])/g, '$1')

      // Parse to validate and normalize
      const parsed = JSON.parse(cleanJson)

      // Process metadata to handle prefixed properties
      if (parsed.metadata) {
        const processObject = (obj: Record<string, unknown>): Record<string, unknown> => {
          const result: Record<string, unknown> = {}

          for (const [key, value] of Object.entries(obj)) {
            // Handle arrays
            if (Array.isArray(value)) {
              result[key] = value.map(item => 
                item && typeof item === 'object' ? processObject(item as Record<string, unknown>) : item
              )
            }
            // Handle nested objects
            else if (value && typeof value === 'object') {
              result[key] = processObject(value as Record<string, unknown>)
            }
            // Handle primitive values
            else {
              result[key] = value
            }

            // Handle prefixed properties
            if (key.startsWith('@') || key.startsWith('$')) {
              const baseKey = key.slice(1)
              const otherPrefix = key.startsWith('@') ? '$' : '@'
              
              // Store unprefixed version
              if (!result[baseKey]) {
                result[baseKey] = value
              }
              
              // Store both prefix versions for special fields
              if (['type', 'id', 'context', 'list', 'vocab'].includes(baseKey)) {
                result[`@${baseKey}`] = value
                result[`$${baseKey}`] = value
              }
            }

            // Special handling for context object
            if ((key === 'context' || key === '@context' || key === '$context') && typeof value === 'object') {
              const contextObj = value as Record<string, unknown>
              const newContext: Record<string, unknown> = {}
              
              for (const [k, v] of Object.entries(contextObj)) {
                if (k === 'vocab') {
                  newContext['@vocab'] = v
                } else {
                  newContext[k] = v
                }
              }
              
              result.context = newContext
            }
          }

          return result
        }

        parsed.metadata = processObject(parsed.metadata)
      }

      return parsed
    } catch (error) {
      console.error('Parse error:', error)
      console.error('Original match:', match)
      console.error('Cleaned JSON:', cleanJson)
      throw error
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
