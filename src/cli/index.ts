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

// Create program instance
export const program = new Command()
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')

// Configure version and help
program
  .version(version, '-v, --version', 'output the version number')
  .configureHelp({
    helpWidth: 80,
    sortSubcommands: true,
    sortOptions: true
  })
  .showHelpAfterError(true)

// Override exit behavior for testing
program.exitOverride((err) => {
  throw new Error(`process.exit unexpectedly called with "${err.exitCode}"`)
})

// Add listener for version and help output
const originalWrite = process.stdout.write.bind(process.stdout)
const newWrite = function(
  this: NodeJS.WriteStream,
  buffer: string | Uint8Array,
  encodingOrCb?: BufferEncoding | ((err?: Error) => void),
  cb?: (err?: Error) => void
): boolean {
  const output = buffer.toString()

  // Handle version output
  if (output.trim() === version) {
    console.log(version)
    exit(0)
  }

  // Handle help output
  if (output.includes('Usage:')) {
    console.log(output)
    exit(0)
  }

  if (typeof encodingOrCb === 'function') {
    return originalWrite(buffer, encodingOrCb)
  }
  return originalWrite(buffer, encodingOrCb, cb)
}

process.stdout.write = newWrite as typeof process.stdout.write

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

// Add compile command
program
  .command('compile')
  .description('Compile MDXLD file to Cloudflare Worker')
  .argument('<input>', 'Input MDXLD file')
  .option('-n, --name <name>', 'Worker name', defaultCompileOptions.worker.name)
  .option('-r, --routes <routes>', 'Worker routes (comma-separated)')
  .option('-c, --compatibility-date <date>', 'Worker compatibility date', defaultCompileOptions.worker.compatibilityDate)
  .action(async (input: string, options: CompileCommandOptions) => {
    try {
      const compileOptions: CompileOptions = {
        ...defaultCompileOptions,
        worker: {
          name: options.name,
          routes: options.routes?.split(','),
          compatibilityDate: options.compatibilityDate
        }
      }
      await compile(input, compileOptions)
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Compilation failed')
      throw err
    }
  })

// Add deploy-platform command
program
  .command('deploy-platform')
  .description('Deploy worker using Cloudflare Platform API')
  .argument('<worker>', 'Worker script file')
  .requiredOption('-n, --name <name>', 'Worker name')
  .requiredOption('--namespace <namespace>', 'Platform namespace')
  .requiredOption('--account-id <accountId>', 'Platform account ID')
  .requiredOption('--api-token <token>', 'Platform API token')
  .action(async (worker: string, options: PlatformOptions & Required<Pick<PlatformOptions, 'namespace' | 'accountId' | 'apiToken'>>) => {
    try {
      const config: PlatformConfig = {
        namespace: options.namespace,
        accountId: options.accountId,
        apiToken: options.apiToken
      }
      await deployPlatform(worker, options.name, config)
      console.log('Platform deployment completed successfully')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Platform deployment failed')
      throw err
    }
  })

// Add deploy-wrangler command
program
  .command('deploy-wrangler')
  .description('Deploy worker using Wrangler')
  .argument('<worker>', 'Worker script file')
  .requiredOption('-n, --name <name>', 'Worker name')
  .option('-c, --compatibility-date <date>', 'Worker compatibility date', defaultCompileOptions.worker.compatibilityDate)
  .action(async (worker: string, options: WranglerOptions & { compatibilityDate: string }) => {
    try {
      const config: WranglerConfig = {
        name: options.name,
        compatibilityDate: options.compatibilityDate
      }
      await deployWrangler(worker, config)
      console.log('Deployed successfully using Wrangler')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Wrangler deployment failed')
      throw err
    }
  })

// Run CLI
if (typeof require !== 'undefined' && require.main === module) {
  program.parseAsync(process.argv).catch((err) => {
    // Check if error is from help text display
    if (err instanceof Error && err.message.includes('process.exit unexpectedly called with "0"')) {
      process.exit(0)
    }
    console.error(err instanceof Error ? err.message : 'An unknown error occurred')
    process.exit(1)
  })
}
