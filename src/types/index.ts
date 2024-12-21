/**
 * Core MDXLD interface representing parsed MDX content with metadata
 */
export interface MDXLD {
  /** Unique identifier for the content */
  id?: string
  /** Content type identifier */
  type?: string
  /** JSON-LD context URL or object */
  context?: string | Record<string, unknown>
  /** Frontmatter data including YAML-LD properties */
  data?: Record<string, unknown>
  /** Main content body */
  content: string
}

/**
 * Worker context interface for runtime data
 */
export interface WorkerContext {
  /** Metadata including type, context, and frontmatter */
  metadata: {
    /** Document type */
    type: string
    /** Document context */
    context: string | Record<string, unknown>
    /** Worker configuration */
    name: string
    /** Worker routes */
    routes?: string[]
    /** Additional metadata */
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
  /** Additional configuration */
  [key: string]: unknown
}
