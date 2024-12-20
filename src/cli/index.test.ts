import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { program } from './index'
import type { MockInstance } from 'vitest'

// Mock dependencies
vi.mock('../compiler', () => ({
  compile: vi.fn().mockResolvedValue('compiled-worker')
}))

vi.mock('../deploy/platform', () => ({
  deployPlatform: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../deploy/wrangler', () => ({
  deployWrangler: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue('test content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => false })
  }
}))

describe('CLI', () => {
  let exitSpy: MockInstance<typeof process.exit>
  let logSpy: MockInstance<typeof console.log>
  let errorSpy: MockInstance<typeof console.error>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit called with code ${code}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should show version when --version flag is used', async () => {
    await expect(async () => {
      await program.parseAsync(['node', 'cli.js', '--version'])
    }).rejects.toThrow('process.exit called with code 0')

    expect(logSpy).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('should show help when --help flag is used', async () => {
    await expect(async () => {
      await program.parseAsync(['node', 'cli.js', '--help'])
    }).rejects.toThrow('process.exit called with code 0')

    expect(logSpy).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('should show help when no command is provided', async () => {
    await expect(async () => {
      await program.parseAsync(['node', 'cli.js'])
    }).rejects.toThrow('process.exit called with code 0')

    expect(logSpy).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('should compile MDXLD file with default options', async () => {
    const { compile } = await import('../compiler')

    await program.parseAsync(['node', 'cli.js', 'compile', 'test.mdx'])

    expect(compile).toHaveBeenCalledWith('test.mdx', expect.objectContaining({
      jsx: expect.objectContaining({
        importSource: 'hono/jsx',
        runtime: 'react-jsx'
      }),
      worker: expect.objectContaining({
        name: 'mdxld-worker'
      })
    }))
    expect(logSpy).toHaveBeenCalledWith('Compilation completed successfully')
  })

  it('should deploy using platform API', async () => {
    const { deployPlatform } = await import('../deploy/platform')

    await program.parseAsync(['node', 'cli.js', 'deploy-platform', '--namespace', 'test'])

    expect(deployPlatform).toHaveBeenCalledWith(expect.objectContaining({
      namespace: 'test'
    }))
    expect(logSpy).toHaveBeenCalledWith('Platform deployment completed successfully')
  })

  it('should deploy using wrangler', async () => {
    const { deployWrangler } = await import('../deploy/wrangler')

    await program.parseAsync(['node', 'cli.js', 'deploy-wrangler'])

    expect(deployWrangler).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('Wrangler deployment completed successfully')
  })
})
