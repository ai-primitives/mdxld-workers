#!/usr/bin/env node
/// <reference types="node" />

import { Command } from 'commander'
import { compile } from '../compiler'
import { deployPlatform } from '../deploy/platform'
import { deployWrangler } from '../deploy/wrangler'
import { version } from '../../package.json'
import type { CompileOptions, PlatformConfig, PlatformOptions, WranglerConfig, WranglerOptions } from '../deploy/types'

// Create program instance
export const program = new Command()
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')
  .version(version, '-v, --version', 'output the current version')
  .configureOutput({
    writeOut: (str) => console.log(str),
    writeErr: (str) => console.error(str)
  })
  .addHelpCommand()
  .showHelpAfterError()
  .action(() => {
    program.help()
  })

// Configure version and help
program.configureHelp({
  helpWidth: 80,
  sortSubcommands: true,
  sortOptions: true,
})

// Override exit behavior for testing
program.exitOverride((err) => {
  if (err.code === 'commander.version') {
    console.log(version)
  } else if (err.code === 'commander.help' || !err.code) {
    console.log(program.helpInformation())
  }
  throw new Error('process.exit unexpectedly called with "0"')
})

// Default compile options
const defaultCompileOptions: CompileOptions = {
  jsx: {
    importSource: 'hono/jsx' as const,
    runtime: 'react-jsx' as const,
  },
  worker: {
    name: 'mdxld-worker',
    compatibilityDate: new Date().toISOString().split('T')[0],
  },
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
          compatibilityDate: options.compatibilityDate,
        },
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
        apiToken: options.apiToken,
      }
      await deployPlatform(worker, options.name, config)
      console.log('Platform deployment completed successfully')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Platform deployment failed')
      throw err
    }
  })

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
        compatibilityDate: options.compatibilityDate,
      }
      await deployWrangler(worker, config)
      console.log('Deployed successfully using Wrangler')
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Wrangler deployment failed')
      throw err
    }
  })

// Only run if this is the main module
if (process.env.NODE_ENV !== 'test' && process.argv[1]?.endsWith('cli/index.js')) {
  program.parseAsync(process.argv).catch((err) => {
    if (err instanceof Error && err.message.includes('process.exit unexpectedly called')) {
      throw err
    }
    console.error(err instanceof Error ? err.message : 'An unknown error occurred')
    process.exit(1)
  })
}
