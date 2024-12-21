/// <reference lib="webworker" />

export interface WorkerContext {
  metadata: Record<string, unknown>
  content: string
}

declare const WORKER_CONTEXT: WorkerContext

export interface WorkerExports {
  fetch(request: Request): Promise<Response>
}

const worker: WorkerExports = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetch(_request: Request): Promise<Response> {
    return new Response(WORKER_CONTEXT.content, {
      headers: {
        'Content-Type': 'text/html',
        'X-MDXLD-Metadata': JSON.stringify(WORKER_CONTEXT.metadata, (key, value) => {
          // Handle special cases for metadata serialization
          if (value instanceof Set) {
            return Array.from(value)
          }
          // Ensure proper string escaping for special characters
          if (typeof value === 'string') {
            // eslint-disable-next-line no-control-regex
            return value.replace(/[\u0000-\u001f\u2028\u2029"\\]/g, char => {
              const escaped = char.charCodeAt(0).toString(16).padStart(4, '0')
              return `\\u${escaped}`
            })
          }
          return value
        }),
      },
    })
  },
}

// Use type assertion to avoid TypeScript errors
;(globalThis as unknown as { default: WorkerExports }).default = worker
