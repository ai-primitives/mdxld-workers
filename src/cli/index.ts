#!/usr/bin/env node
import { Command } from 'commander'
import { compile } from '../compiler'
import { deployPlatform } from '../deploy/platform'
import { deployWrangler } from '../deploy/wrangler'
import type { PlatformConfig } from '../deploy/platform'
import fs from 'node:fs/promises'
import path from 'node:path'
import { version } from '../../package.json'

interface CompileOptions {
  output: string
  config?: string
}

interface DeployPlatformOptions {
  name: string
  accountId: string
  namespace: string
  apiToken: string
}

interface DeployWranglerOptions {
  name: string
  config?: string
}

export const program = new Command()

// Configure program with help and version handling
program
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')
  .version(version, '-v, --version')
  .helpOption('-h, --help')

// Mock process.exit in test environment
if (process.env.NODE_ENV === 'test') {
  const mockExit = (code: number) => {
    throw new Error(`process.exit unexpectedly called with "${code}"`)
  }
  process.exit = mockExit as never
}

// Override exit behavior to prevent process.exit in tests
program.exitOverride((err) => {
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.help') {
    console.log(program.helpInformation())
    process.exit(0)
  }
  if (err.code === 'commander.version') {
    console.log(version)
    process.exit(0)
  }
  if (err.code === 'commander.unknownOption' || err.code === 'commander.unknownCommand') {
    console.error(err.message)
    process.exit(1)
  }
  process.exit(1)
})

// Handle unknown options and error cases
program.on('command:*', () => {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '))
  program.help()
})

program
  .command('compile <input>')
  .description('Compile MDXLD file to Cloudflare Worker')
  .option('-o, --output <dir>', 'output directory', 'dist')
  .action(async (input, options) => {
    try {
      await compile(input, options)
      console.log('Compilation completed successfully')
    } catch (error) {
      console.error('Compilation failed:', error)
      process.exit(1)
    }
  })

program
  .command('deploy-platform <worker>')
  .description('Deploy worker using Cloudflare Platform API')
  .requiredOption('--name <name>', 'worker name')
  .requiredOption('--account-id <id>', 'Cloudflare account ID')
  .requiredOption('--namespace <namespace>', 'worker namespace')
  .requiredOption('--api-token <token>', 'Cloudflare API token')
  .action(async (worker, options) => {
    try {
      const config: PlatformConfig = {
        accountId: options.accountId,
        namespace: options.namespace,
        apiToken: options.apiToken
      }
      await deployPlatform(worker, options.name, config)
      console.log('Deployed successfully using Platform API')
    } catch (error) {
      console.error('Platform deployment failed:', error)
      process.exit(1)
    }
  })

program
  .command('deploy-wrangler <worker>')
  .description('Deploy worker using Wrangler')
  .requiredOption('--name <name>', 'worker name')
  .action(async (worker, options) => {
    try {
      await deployWrangler(worker, options)
      console.log('Deployed successfully using Wrangler')
    } catch (error) {
      console.error('Wrangler deployment failed:', error)
      process.exit(1)
    }
  })

// Only parse arguments if this is the main module
if (require.main === module) {
  program.parseAsync().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
} else {
  // When imported as a module (for testing), let Commander handle help display
  program.parse(process.argv)
}
