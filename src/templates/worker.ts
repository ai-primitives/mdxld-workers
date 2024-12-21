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
        'X-MDXLD-Metadata': JSON.stringify(WORKER_CONTEXT.metadata),
      },
    })
  },
}

// Use type assertion to avoid TypeScript errors
;(globalThis as unknown as { default: WorkerExports }).default = worker
