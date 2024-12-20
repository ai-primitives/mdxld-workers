#!/usr/bin/env node
import { Command } from 'commander'
import { compile } from '../compiler'
import { deployPlatform } from '../deploy/platform'
import { deployWrangler } from '../deploy/wrangler'
import { version } from '../../package.json'
import type {
  CompileOptions,
  PlatformConfig,
  PlatformOptions,
  WranglerConfig,
  WranglerOptions
} from '../deploy/types'

// Export for testing
const exit = process.exit

// Create and configure program
export const program = new Command()
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')
  .version(version, '-v, --version', 'output the version number')
  .helpOption('-h, --help', 'display help for command')

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
  // Always throw with consistent error message format
  throw new Error(`process.exit unexpectedly called with "${err.exitCode}"`)
})

// Handle version output
program.on('option:version', () => {
  console.log(version)
  exit(0)
})

// Handle help output
program.on('--help', () => {
  const helpText = program.helpInformation()
  console.log(helpText)
  exit(0)
})

// Default action when no command is provided
program.action(() => {
  const helpText = program.helpInformation()
  console.log(helpText)
  exit(0)
})

// Default compile options
const defaultCompileOptions: CompileOptions = {
  jsx: {
    importSource: 'hono/jsx' as const,
    runtime: 'react-jsx' as const
  },
  worker: {
    name: 'mdxld-worker',
    compatibilityDate: new Date().toISOString().split('T')[0]
  }
}

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
if (typeof require !== 'undefined' && require.main === module) {
  program.parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : 'An unknown error occurred')
    exit(1)
  })
}
