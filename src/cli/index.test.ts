import { describe, it, expect, vi } from 'vitest'
import { program } from './index'

describe('CLI', () => {
  it('should show version when --version flag is used', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    program.parse(['node', 'cli', '--version'])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should show help when --help flag is used', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    program.parse(['node', 'cli', '--help'])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should show help when no command is provided', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    program.parse(['node', 'cli'])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
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
})
