import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { program, exit } from './index'

// Mock dependencies before importing tested module
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
  const mockExit = vi.fn()

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Replace the exit function with our mock
    vi.stubGlobal('exit', mockExit)
    mockExit.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should show version when --version flag is used', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    await expect(async () => {
      await program.parseAsync(['--version'])
    }).rejects.toThrow('process.exit called with "0"')

    expect(consoleSpy).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should show help when --help flag is used', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    await expect(async () => {
      await program.parseAsync(['--help'])
    }).rejects.toThrow('process.exit called with "0"')

    expect(consoleSpy).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should show help when no command is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    await expect(async () => {
      await program.parseAsync([])
    }).rejects.toThrow('process.exit called with "0"')

    expect(consoleSpy).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should have compile command', async () => {
    const { compile } = await import('../compiler')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parseAsync(['compile', 'test.mdx'])

    expect(compile).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Compilation completed successfully')
  })

  it('should have deploy-platform command', async () => {
    const { deployPlatform } = await import('../deploy/platform')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parseAsync([
      'deploy-platform', 'worker.js',
      '--name', 'test-worker',
      '--account-id', 'account123',
      '--namespace', 'test-ns',
      '--api-token', 'token123'
    ])

    expect(deployPlatform).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Deployed successfully using Platform API')
  })

  it('should have deploy-wrangler command', async () => {
    const { deployWrangler } = await import('../deploy/wrangler')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parseAsync([
      'deploy-wrangler', 'worker.js',
      '--name', 'test-worker'
    ])

    expect(deployWrangler).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Deployed successfully using Wrangler')
  })
})
