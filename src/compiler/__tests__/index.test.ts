import { compile, CompileOptions } from '../index'
import { expect, test, describe } from 'vitest'

describe('MDXLD Worker Compiler', () => {
  const defaultOptions: CompileOptions = {
    worker: {
      name: 'test-worker',
      compatibilityDate: '2024-01-01'
    }
  }

  test('compiles MDXLD with $ prefix metadata', async () => {
    const source = `---
$type: Article
$context: https://schema.org/
title: Test Article
$worker:
  name: custom-worker
  routes:
    - /articles/*
---

# Test Content`

    const result = await compile(source, defaultOptions)
    expect(result).toContain('WORKER_CONTEXT')
    expect(result).toContain('Article')
    expect(result).toContain('schema.org')
    expect(result).toContain('custom-worker')
    expect(result).toContain('/articles/*')
  })

  test('handles both $ and @ prefix metadata', async () => {
    const source = `---
$type: Article
@context: https://schema.org/
title: Test Article
---

# Mixed Prefix Test`

    const result = await compile(source, defaultOptions)
    expect(result).toContain('Article')
    expect(result).toContain('schema.org')
  })

  test('preserves unstructured content', async () => {
    const source = `---
$type: Article
---

# Markdown Content
## With Headers
- And lists
- Multiple items`

    const result = await compile(source, defaultOptions)
    expect(result).toContain('Markdown Content')
    expect(result).toContain('With Headers')
    expect(result).toContain('Multiple items')
  })
})
