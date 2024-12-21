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
  data: Record<string, unknown>
  /** Main content body */
  content: string
}
