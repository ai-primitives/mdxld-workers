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

program
  .name('mdxld-workers')
  .description('CLI to compile and deploy MDXLD files to Cloudflare Workers')
  .version(version)

program
  .command('compile')
  .description('Compile MDXLD files into Cloudflare Workers')
  .argument('<input>', 'input MDXLD file or directory')
  .option('-o, --output <dir>', 'output directory', './dist')
  .option('-c, --config <path>', 'config file path')
  .action(async (input: string, options: CompileOptions) => {
    try {
      const config = options.config
        ? JSON.parse(await fs.readFile(options.config, 'utf-8'))
        : {}

      const stats = await fs.stat(input)
      if (stats.isDirectory()) {
        const files = await fs.readdir(input)
        for (const file of files) {
          if (file.endsWith('.mdx')) {
            const content = await fs.readFile(path.join(input, file), 'utf-8')
            const worker = await compile(content, config)
            await fs.mkdir(options.output, { recursive: true })
            await fs.writeFile(
              path.join(options.output, `${path.basename(file, '.mdx')}.js`),
              worker
            )
          }
        }
      } else {
        const content = await fs.readFile(input, 'utf-8')
        const worker = await compile(content, config)
        await fs.mkdir(options.output, { recursive: true })
        await fs.writeFile(
          path.join(options.output, `${path.basename(input, '.mdx')}.js`),
          worker
        )
      }
      console.log('Compilation completed successfully')
    } catch (error) {
      console.error('Compilation failed:', error)
      process.exitCode = 1
      return
    }
  })

program
  .command('deploy-platform')
  .description('Deploy workers using Cloudflare Platform API')
  .argument('<input>', 'input worker file')
  .requiredOption('-n, --name <name>', 'worker name')
  .requiredOption('--account-id <id>', 'Cloudflare account ID')
  .requiredOption('--namespace <namespace>', 'worker namespace')
  .requiredOption('--api-token <token>', 'Cloudflare API token')
  .action(async (input: string, options: DeployPlatformOptions) => {
    try {
      const worker = await fs.readFile(input, 'utf-8')
      const config: PlatformConfig = {
        accountId: options.accountId,
        namespace: options.namespace,
        apiToken: options.apiToken
      }
      await deployPlatform(worker, options.name, config)
      console.log('Deployed successfully using Platform API')
    } catch (error) {
      console.error('Platform deployment failed:', error)
      process.exitCode = 1
      return
    }
  })

program
  .command('deploy-wrangler')
  .description('Deploy workers using Wrangler')
  .argument('<input>', 'input worker file')
  .requiredOption('-n, --name <name>', 'worker name')
  .option('-c, --config <path>', 'wrangler config file path')
  .action(async (input: string, options: DeployWranglerOptions) => {
    try {
      const worker = await fs.readFile(input, 'utf-8')
      const config = options.config
        ? JSON.parse(await fs.readFile(options.config, 'utf-8'))
        : undefined
      await deployWrangler(worker, options.name, config)
      console.log('Deployed successfully using Wrangler')
    } catch (error) {
      console.error('Wrangler deployment failed:', error)
      process.exitCode = 1
      return
    }
  })

// Only parse arguments if this is the main module
if (require.main === module) {
  program.parse()
}
