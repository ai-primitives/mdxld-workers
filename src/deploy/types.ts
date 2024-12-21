export interface WorkerConfig {
  name: string
  routes?: string[]
  compatibilityDate: string
}

export interface CompileOptions {
  jsx: {
    importSource: 'hono/jsx'
    runtime: 'react-jsx'
  }
  worker: WorkerConfig
}

export interface PlatformConfig {
  accountId: string
  namespace: string
  apiToken: string
}

export interface PlatformOptions {
  accountId: string
  namespace?: string
  apiToken: string
  name: string
}

export type PlatformDeployOptions = Required<PlatformOptions>

export interface WranglerOptions {
  name: string
  routes?: string
  compatibilityDate?: string
}

export interface WranglerConfig extends WorkerConfig {
  env?: Record<string, string>
}

export type DeployOptions = WranglerConfig
