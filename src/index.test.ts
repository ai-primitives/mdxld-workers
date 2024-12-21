import { describe, it, expect } from 'vitest'
import { compile } from './index'

describe('mdxld-workers', () => {
  it('exports compile function', () => {
    expect(compile).toBeDefined()
    expect(typeof compile).toBe('function')
  })
})
