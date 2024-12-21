import { compile } from './compiler'
import { deployWrangler as deploy } from './deploy/wrangler'
import { deployPlatform } from './deploy/platform'
import type { CompileOptions, DeployOptions, PlatformDeployOptions } from './deploy/types'

export { compile, deploy, deployPlatform }
export type { CompileOptions, DeployOptions, PlatformDeployOptions }

// Re-export common types
export * from './deploy/types'
