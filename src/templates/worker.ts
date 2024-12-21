import type { MDXLD } from '../types'

export interface WorkerContext {
  metadata: Record<string, unknown>
  content: string
}

declare const WORKER_CONTEXT: WorkerContext

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const ctx: WorkerContext = WORKER_CONTEXT // Will be replaced during build

    return new Response(ctx.content, {
      headers: {
        'Content-Type': 'text/html',
        'X-MDXLD-Metadata': JSON.stringify(ctx.metadata)
      }
    })
  }
}
