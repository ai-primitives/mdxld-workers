#!/usr/bin/env node
import { Command } from 'commander'
import { compile, type CompileOptions } from '../compiler'
import { deployPlatform } from '../deploy/platform'
import { deployWrangler } from '../deploy/wrangler'
import type { PlatformConfig } from '../deploy/types'
import { version } from '../../package.json'

// Export for testing
export const exit = (code?: number): never => {
  throw new Error(`process.exit unexpectedly called with "${code}"`)
}

// Create and configure program
export const program = new Command()
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')
  .version(version, '-v, --version')
  .helpOption('-h, --help')

// Override exit behavior for testing
program.exitOverride((err) => {
  if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
    console.log(program.helpInformation())
    exit(0)
    throw new Error('process.exit unexpectedly called with "0"')
  } else if (err.code === 'commander.version') {
    console.log(version)
    exit(0)
    throw new Error('process.exit unexpectedly called with "0"')
  }
  throw err
})

// Default compile options
const defaultCompileOptions: CompileOptions = {
  jsx: {
    importSource: 'hono/jsx',
    runtime: 'react-jsx'
  },
  worker: {
    name: 'mdxld-worker',
    compatibilityDate: new Date().toISOString().split('T')[0]
  }
}

program
  .command('compile')
  .argument('<input>', 'Input MDXLD file')
  .option('--name <name>', 'Worker name', defaultCompileOptions.worker.name)
  .option('--routes <routes...>', 'Worker routes')
  .description('Compile MDXLD file to Cloudflare Worker')
  .action(async (input: string, options: any) => {
    try {
      const compileOptions: CompileOptions = {
        ...defaultCompileOptions,
        worker: {
          ...defaultCompileOptions.worker,
          name: options.name,
          routes: options.routes
        }
      }
      await compile(input, compileOptions)
      console.log('Compilation completed successfully')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Compilation failed')
      exit(1)
    }
  })

program
  .command('deploy-platform <worker>')
  .description('Deploy worker using Cloudflare Platform API')
  .requiredOption('--namespace <namespace>', 'Platform namespace')
  .requiredOption('--account-id <accountId>', 'Cloudflare account ID')
  .requiredOption('--api-token <token>', 'Cloudflare API token')
  .requiredOption('--name <name>', 'Worker name')
  .action(async (worker: string, options: any) => {
    try {
      const config: PlatformConfig = {
        namespace: options.namespace,
        accountId: options.accountId,
        apiToken: options.apiToken
      }
      await deployPlatform(worker, options.name, config)
      console.log('Platform deployment completed successfully')
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
