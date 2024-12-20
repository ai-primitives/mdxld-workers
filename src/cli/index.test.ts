import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { program } from './index'

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
  // Mock process.exit to prevent tests from terminating and track exit codes
  const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit unexpectedly called with "${code}"`)
  })

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockExit.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should show version when --version flag is used', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    await expect(async () => {
      await program.parseAsync(['node', 'test', '--version'])
    }).rejects.toThrow('process.exit unexpectedly called with "0"')

    expect(consoleSpy).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should show help when --help flag is used', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    await expect(async () => {
      await program.parseAsync(['node', 'test', '--help'])
    }).rejects.toThrow('process.exit unexpectedly called with "0"')

    expect(consoleSpy).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should show help when no command is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    await expect(async () => {
      await program.parseAsync(['node', 'test'])
    }).rejects.toThrow('process.exit unexpectedly called with "0"')

    expect(consoleSpy).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should have compile command', async () => {
    const { compile } = await import('../compiler')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parseAsync(['node', 'test', 'compile', 'test.mdx'], { from: 'user' })

    expect(compile).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Compilation completed successfully')
  })

  it('should have deploy-platform command', async () => {
    const { deployPlatform } = await import('../deploy/platform')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parseAsync([
      'node', 'test', 'deploy-platform', 'worker.js',
      '--name', 'test-worker',
      '--account-id', 'account123',
      '--namespace', 'test-ns',
      '--api-token', 'token123'
    ], { from: 'user' })

    expect(deployPlatform).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Deployed successfully using Platform API')
  })

  it('should have deploy-wrangler command', async () => {
    const { deployWrangler } = await import('../deploy/wrangler')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parseAsync([
      'node', 'test', 'deploy-wrangler', 'worker.js',
      '--name', 'test-worker'
    ], { from: 'user' })

    expect(deployWrangler).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Deployed successfully using Wrangler')
  })
})
