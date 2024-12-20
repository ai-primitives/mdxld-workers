import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { program, parseArgs } from './index'

describe('CLI', () => {
  // Mock process.exit to prevent tests from terminating
  const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
    throw new Error(`Process.exit called with code: ${code}`)
  })

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockExit.mockClear()
  })

  it('should show version when --version flag is used', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    expect(() => parseArgs(['--version'])).toThrow()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should show help when --help flag is used', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    expect(() => parseArgs(['--help'])).toThrow()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should show help when no command is provided', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    expect(() => parseArgs([])).toThrow()
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
    const mockCompile = vi.fn().mockResolvedValue('compiled-worker')
    vi.mock('../compiler', () => ({ compile: mockCompile }))

    await expect(parseArgs(['compile', 'test.mdx'])).rejects.toThrow()
    expect(mockCompile).toHaveBeenCalled()
  })

  it('should handle deploy-platform command with valid input', async () => {
    await expect(
      parseArgs([
        'deploy-platform',
        'worker.js',
        '--name', 'test-worker',
        '--account-id', 'account123',
        '--namespace', 'test-ns',
        '--api-token', 'token123'
      ])
    ).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should handle deploy-wrangler command with valid input', async () => {
    await expect(
      parseArgs([
        'deploy-wrangler',
        'worker.js',
        '--name', 'test-worker'
      ])
    ).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(0)
  })
})
