import { execa } from 'execa'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Wrangler deployment configuration
 */
export interface WranglerConfig {
  /** Worker name */
  name: string
  /** Worker route patterns */
  routes?: string[]
  /** Compatibility date */
  compatibilityDate: string
  /** Environment variables */
  env?: Record<string, string>
}

/**
 * Deploys a worker using Wrangler CLI
 * @param worker Worker code as string
 * @param options Worker deployment options
 */
export async function deployWrangler(worker: string, options: WranglerConfig): Promise<void> {
  // Create temporary directory for worker files
  const tmpDir = tmpdir()
  const workerPath = join(tmpDir, `${options.name}.js`)
  const configPath = join(tmpDir, 'wrangler.toml')

  const fullConfig: WranglerConfig = {
    name: options.name,
    compatibilityDate: options.compatibilityDate ?? new Date().toISOString().split('T')[0],
    routes: options.routes,
    env: options.env,
  }

  try {
    // Write worker code to temporary file
    await writeFile(workerPath, worker)

    // Generate wrangler.toml
    const wranglerConfig = `
name = "${fullConfig.name}"
main = "${workerPath}"
compatibility_date = "${fullConfig.compatibilityDate}"

${fullConfig.routes ? fullConfig.routes.map((route) => `routes = ["${route}"]`).join('\n') : ''}

${
  fullConfig.env
    ? '[vars]\n' +
      Object.entries(fullConfig.env)
        .map(([key, value]) => `${key} = "${value}"`)
        .join('\n')
    : ''
}
`
    await writeFile(configPath, wranglerConfig)

    // Deploy using wrangler
    await execa('wrangler', ['deploy'], {
      cwd: tmpDir,
      stdio: 'inherit',
    })
  } catch (error) {
    throw new Error(`Failed to deploy worker with Wrangler: ${error instanceof Error ? error.message : String(error)}`)
  }
}
