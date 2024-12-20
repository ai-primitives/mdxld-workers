#!/usr/bin/env node
import { Command } from 'commander'
import { compile, type CompileOptions } from '../compiler'
import { deployPlatform } from '../deploy/platform'
import { deployWrangler } from '../deploy/wrangler'
import { version } from '../../package.json'
import type { PlatformConfig, PlatformOptions, WranglerOptions, WranglerConfig } from '../deploy/types'

// Export for testing
export const exit = (code: number): never => {
  process.exit(code)
  throw new Error('Unreachable') // TypeScript needs this
}

// Create and configure program
export const program = new Command()
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')
  .version(version, '-v, --version')
  .helpOption('-h, --help')

// Show help by default when no command is provided
program
  .configureHelp({
    helpWidth: 80,
    sortSubcommands: true,
    sortOptions: true
  })
  .showHelpAfterError(true)

// Override exit behavior for testing
program.exitOverride((err) => {
  if (!err.code || err.code === 'commander.help' || err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    if (err.code === 'commander.version') {
      console.log(version)
    } else {
      console.log(program.helpInformation())
    }
    process.exit(0)
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
  .action(async (input: string, options: CompileOptions) => {
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
  .action(async (worker: string, options: PlatformOptions) => {
    try {
      const config: PlatformConfig = {
        namespace: options.namespace || options.name, // Use name as fallback for namespace
        accountId: options.accountId,
        apiToken: options.apiToken,
        name: options.name
      }
      await deployPlatform(worker, config)
      console.log('Platform deployment completed successfully')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Deployment failed')
      exit(1)
    }
  })

program
  .command('deploy-wrangler')
  .argument('<worker>', 'Worker file or directory')
  .requiredOption('--name <name>', 'Worker name')
  .option('--routes <routes>', 'Worker routes (comma-separated)')
  .option('--compatibility-date <date>', 'Worker compatibility date')
  .description('Deploy worker using Wrangler')
  .action(async (worker: string, cmdOptions: WranglerOptions) => {
    try {
      const config: WranglerConfig = {
        name: cmdOptions.name,
        routes: cmdOptions.routes?.split(','),
        compatibilityDate: cmdOptions.compatibilityDate ?? new Date().toISOString().split('T')[0]
      }
      await deployWrangler(worker, config)
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
