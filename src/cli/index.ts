#!/usr/bin/env node
import { Command } from 'commander'
import { compile } from '../compiler'
import { deployPlatform } from '../deploy/platform'
import { deployWrangler } from '../deploy/wrangler'
import type { PlatformConfig } from '../deploy/types'
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

// Configure program
program
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')
  .version(version, '-v, --version')
  .helpOption('-h, --help')

// Override exit behavior to ensure console output before exit
program.exitOverride((err) => {
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    throw err
  }
  if (err.code === 'commander.unknownOption' || err.code === 'commander.unknownCommand') {
    console.error(err.message)
    throw err
  }
  throw err
})

// Add commands
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

// Parse arguments
if (require.main === module) {
  program.parseAsync().catch((err) => {
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
      process.exit(0)
    }
    console.error(err.message)
    process.exit(1)
  })
} else {
  program.parse(process.argv)
}
