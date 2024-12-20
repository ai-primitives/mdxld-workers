#!/usr/bin/env node
import { Command } from 'commander'
import { compile } from '../compiler'
import { deployPlatform } from '../deploy/platform'
import { deployWrangler } from '../deploy/wrangler'
import type { PlatformConfig } from '../deploy/types'
import { version } from '../../package.json'

// Export for testing
export let exit = process.exit

// Configure process.exit for testing
if (process.env.NODE_ENV === 'test') {
  exit = ((code?: number) => {
    throw new Error(`process.exit called with "${code}"`)
  }) as never
}

export const program = new Command()

// Configure program
program
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')
  .version(version, '-v, --version')
  .helpOption('-h, --help')

// Override exit behavior for testing
program.exitOverride((err) => {
  if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
    console.log(program.helpInformation())
    exit(0)
    return
  }
  if (err.code === 'commander.version') {
    console.log(version)
    exit(0)
    return
  }
  throw err
})

// Add commands
program
  .command('compile')
  .argument('<input>', 'Input MDXLD file')
  .description('Compile MDXLD file to Cloudflare Worker')
  .action(async (input: string) => {
    try {
      await compile(input)
      console.log('Compilation completed successfully')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Compilation failed')
      exit(1)
    }
  })

program
  .command('deploy-platform')
  .argument('<worker>', 'Worker file to deploy')
  .requiredOption('--name <name>', 'Worker name')
  .requiredOption('--account-id <accountId>', 'Cloudflare account ID')
  .requiredOption('--namespace <namespace>', 'Worker namespace')
  .requiredOption('--api-token <token>', 'Cloudflare API token')
  .description('Deploy worker using Cloudflare Platform API')
  .action(async (worker: string, options: any) => {
    try {
      const config: PlatformConfig = {
        accountId: options.accountId,
        namespace: options.namespace,
        apiToken: options.apiToken
      }
      await deployPlatform(worker, options.name, config)
      console.log('Deployed successfully using Platform API')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Deployment failed')
      exit(1)
    }
  })

program
  .command('deploy-wrangler')
  .argument('<worker>', 'Worker file to deploy')
  .requiredOption('--name <name>', 'Worker name')
  .description('Deploy worker using Wrangler')
  .action(async (worker: string, options: any) => {
    try {
      await deployWrangler(worker, options.name)
      console.log('Deployed successfully using Wrangler')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Deployment failed')
      exit(1)
    }
  })

// Run CLI
if (require.main === module) {
  program.parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : 'An unknown error occurred')
    exit(1)
  })
}
