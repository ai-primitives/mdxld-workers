export interface WorkerContext {
  metadata: Record<string, unknown>
  content: string
}

declare const WORKER_CONTEXT: WorkerContext

const worker = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetch(_request: Request): Promise<Response> {
    // Request parameter required by Worker API, will be used for routing
    const ctx: WorkerContext = WORKER_CONTEXT

    return new Response(ctx.content, {
      headers: {
        'Content-Type': 'text/html',
        'X-MDXLD-Metadata': JSON.stringify(ctx.metadata),
      },
    })
  },
}

export default worker
