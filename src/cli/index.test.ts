import { beforeEach, describe, expect, it, vi } from 'vitest'
import { version } from '../../package.json'
import type { CompileOptions, PlatformConfig, WranglerConfig } from '../deploy/types'

// Setup spies before importing program
const exitSpy = vi.spyOn(process, 'exit').mockImplementation(function mockExit(code?: number | string | null | undefined): never {
  throw new Error(`process.exit called with ${code}`)
})
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

// Mock compiler module before importing program
vi.mock('../compiler', () => ({
  compile: vi.fn().mockImplementation(async (input: string, options: CompileOptions) => {
    console.log('Mocked compile called with:', input, options)
    return Promise.resolve(undefined)
  })
}))

// Import after all mocks are set up
import { program } from './index'

// Mock deployment functions
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
    vi.clearAllMocks()
  })

  it('should show version when --version flag is used', async () => {
    await expect(async () => {
      await program.parseAsync(['node', 'cli.js', '--version'])
    }).rejects.toThrow('process.exit unexpectedly called with "0"')

    expect(logSpy).toHaveBeenCalledWith(version)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('should show help when --help flag is used', async () => {
    await expect(async () => {
      await program.parseAsync(['node', 'cli.js', '--help'])
    }).rejects.toThrow('process.exit unexpectedly called with "0"')

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('should show help when no command is provided', async () => {
    await expect(async () => {
      await program.parseAsync(['node', 'cli.js'])
    }).rejects.toThrow('process.exit unexpectedly called with "0"')

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
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
        name: 'mdxld-worker',
        compatibilityDate: expect.any(String)
      })
    }))
  })

  it('should deploy using platform API', async () => {
    const { deployPlatform } = await import('../deploy/platform')

    await program.parseAsync([
      'node', 'cli.js', 'deploy-platform',
      'worker.js',
      '--namespace', 'test',
      '--account-id', 'test-account',
      '--api-token', 'test-token',
      '--name', 'test-worker'
    ])

    expect(deployPlatform).toHaveBeenCalledWith(
      'worker.js',
      'test-worker',
      {
        namespace: 'test',
        accountId: 'test-account',
        apiToken: 'test-token'
      }
    )
    expect(logSpy).toHaveBeenCalledWith('Platform deployment completed successfully')
  })

  it('should deploy using wrangler', async () => {
    const { deployWrangler } = await import('../deploy/wrangler')

    await program.parseAsync(['node', 'cli.js', 'deploy-wrangler', '--name', 'test-worker', 'worker.js'])

    expect(deployWrangler).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('Deployed successfully using Wrangler')
  })
})
