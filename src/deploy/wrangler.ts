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
 */
export async function deployWrangler(
  worker: string,
  config: WranglerConfig
): Promise<void> {
  // Create temporary directory for worker files
  const tmpDir = await tmpdir()
  const workerPath = join(tmpDir, `${config.name}.js`)
  const configPath = join(tmpDir, 'wrangler.toml')

  try {
    // Write worker code to temporary file
    await writeFile(workerPath, worker)

    // Generate wrangler.toml
    const wranglerConfig = `
name = "${config.name}"
main = "${workerPath}"
compatibility_date = "${config.compatibilityDate}"

${config.routes ? config.routes.map(route => `routes = ["${route}"]`).join('\n') : ''}

${config.env ? '[vars]\n' + Object.entries(config.env)
  .map(([key, value]) => `${key} = "${value}"`)
  .join('\n') : ''}
`
    await writeFile(configPath, wranglerConfig)

    // Deploy using wrangler
    await execa('wrangler', ['deploy'], {
      cwd: tmpDir,
      stdio: 'inherit'
    })
  } catch (error) {
    throw new Error(`Failed to deploy worker with Wrangler: ${error instanceof Error ? error.message : String(error)}`)
  }
}
