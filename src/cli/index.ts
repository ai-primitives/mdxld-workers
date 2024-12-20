#!/usr/bin/env node
import { Command } from 'commander'
import { compile } from '../compiler'
import { deployPlatform } from '../deploy/platform'
import { deployWrangler } from '../deploy/wrangler'
import { version } from '../../package.json'
import type { CompileOptions, PlatformConfig, PlatformOptions, WranglerOptions, WranglerConfig, WorkerConfig } from '../deploy/types'

// Export for testing
const exit = process.exit

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
    exit(0)
  }
  throw err
})

// Default compile options
const defaultCompileOptions = {
  jsx: {
    importSource: 'hono/jsx' as const,
    runtime: 'react-jsx' as const
  },
  worker: {
    name: 'mdxld-worker',
    compatibilityDate: new Date().toISOString().split('T')[0]
  }
} satisfies CompileOptions

interface CompileCommandOptions {
  name: string
  routes?: string
  compatibilityDate: string
}

program
  .command('compile')
  .argument('<input>', 'Input MDXLD file')
  .option('--name <name>', 'Worker name', defaultCompileOptions.worker.name)
  .option('--routes <routes>', 'Worker routes (comma-separated)')
  .option('--compatibility-date <date>', 'Worker compatibility date', defaultCompileOptions.worker.compatibilityDate)
  .description('Compile MDXLD file to Cloudflare Worker')
  .action(async (input: string, options: CompileCommandOptions) => {
    try {
      const compileOptions: CompileOptions = {
        jsx: defaultCompileOptions.jsx,
        worker: {
          name: options.name,
          routes: options.routes?.split(','),
          compatibilityDate: options.compatibilityDate
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
        namespace: options.namespace || 'default', // Provide default namespace if undefined
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
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  program.parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : 'An unknown error occurred')
    exit(1)
  })
}
