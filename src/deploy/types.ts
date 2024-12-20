export interface WorkerConfig {
  name: string
  routes?: string[]
  compatibilityDate: string
}

export interface CompileOptions {
  jsx: {
    importSource: string
    runtime: string
  }
  worker: WorkerConfig
}

export interface PlatformConfig {
  accountId: string
  namespace: string
  apiToken: string
  name: string
}

export interface PlatformOptions {
  accountId: string
  namespace?: string
  apiToken: string
  name: string
}

export interface WranglerOptions {
  name: string
  routes?: string[]
}
