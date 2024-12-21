/**
 * Core MDXLD interface representing parsed MDX content with metadata
 */
export interface MDXLD {
  /** Optional document ID */
  id?: string
  /** Document type URI */
  type?: string
  /** JSON-LD context - can be string URI or object */
  context?: string | Record<string, unknown>
  /** Document language */
  language?: string
  /** Base URI */
  base?: string
  /** Vocabulary URI */
  vocab?: string
  /** Optional list value */
  list?: unknown[]
  /** Optional set value */
  set?: Set<unknown>
  /** Optional reverse flag */
  reverse?: boolean
  /** Frontmatter data excluding special $ and @ prefixed properties */
  data: Record<string, unknown>
  /** Document content excluding frontmatter */
  content: string
  /** Allow string indexing for metadata fields */
  [key: string]: string | Record<string, unknown> | unknown[] | Set<unknown> | boolean | undefined
}

/**
 * Worker context interface for runtime data
 */
export interface WorkerContext {
  /** Metadata including type, context, and frontmatter */
  metadata: {
    /** Worker name */
    name: string
    /** Worker routes */
    routes?: string[]
    /** Worker type */
    type?: string
    /** JSON-LD context */
    context?: string | Record<string, unknown>
    /** Worker configuration */
    config: {
      memory?: number
      env?: Record<string, string>
      [key: string]: unknown
    }
    /** Worker configuration (legacy) */
    worker?: {
      name: string
      routes?: string[]
      config?: {
        memory?: number
        env?: Record<string, string>
        [key: string]: unknown
      }
    }
    /** Additional metadata including prefixed properties */
    [key: string]: unknown
  }
  /** Document content */
  content: string
}

/**
 * Worker configuration from YAML-LD frontmatter
 */
export interface WorkerConfig {
  /** Worker name */
  name: string
  /** Worker routes */
  routes?: string[]
  /** Worker configuration */
  config: {
    /** Memory limit in MB */
    memory?: number
    /** Environment variables */
    env?: Record<string, string>
    /** Additional configuration */
    [key: string]: unknown
  }
  /** Additional configuration */
  [key: string]: unknown
}
