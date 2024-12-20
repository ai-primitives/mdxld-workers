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
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should show version when --version flag is used', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    await expect(program.parse(['node', 'test', '--version'], { from: 'user' }))
      .rejects.toThrow()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should show help when --help flag is used', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    await expect(program.parse(['node', 'test', '--help'], { from: 'user' }))
      .rejects.toThrow()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should show help when no command is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    await expect(program.parse(['node', 'test'], { from: 'user' }))
      .rejects.toThrow()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should have compile command', () => {
    expect(program.commands.some(cmd => cmd.name() === 'compile')).toBe(true)
  })

  it('should have deploy-platform command', () => {
    expect(program.commands.some(cmd => cmd.name() === 'deploy-platform')).toBe(true)
  })

  it('should have deploy-wrangler command', () => {
    expect(program.commands.some(cmd => cmd.name() === 'deploy-wrangler')).toBe(true)
  })

  it('should handle compile command with valid input', async () => {
    const { compile } = await import('../compiler')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parse(['node', 'test', 'compile', 'test.mdx'], { from: 'user' })

    expect(compile).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Compilation completed successfully')
  })

  it('should handle deploy-platform command with valid input', async () => {
    const { deployPlatform } = await import('../deploy/platform')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parse([
      'node', 'test', 'deploy-platform', 'worker.js',
      '--name', 'test-worker',
      '--account-id', 'account123',
      '--namespace', 'test-ns',
      '--api-token', 'token123'
    ], { from: 'user' })

    expect(deployPlatform).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Deployed successfully using Platform API')
  })

  it('should handle deploy-wrangler command with valid input', async () => {
    const { deployWrangler } = await import('../deploy/wrangler')
    const consoleSpy = vi.spyOn(console, 'log')

    await program.parse([
      'node', 'test', 'deploy-wrangler', 'worker.js',
      '--name', 'test-worker'
    ], { from: 'user' })

    expect(deployWrangler).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Deployed successfully using Wrangler')
  })
})
