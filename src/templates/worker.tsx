import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { MDXProvider } from '@mdx-js/react'
import type { MDXLD } from 'mdxld'

export interface WorkerOptions {
  name: string
  routes?: string[]
  compatibilityDate: string
}

export interface WorkerEnv {
  [key: string]: string
}

export function createWorkerTemplate(mdxld: MDXLD, options: WorkerOptions): string {
  return `
import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { MDXProvider } from '@mdx-js/react'

// MDXLD content and metadata
const mdxld = ${JSON.stringify(mdxld, null, 2)}

// Initialize Hono app
const app = new Hono<{ Bindings: WorkerEnv }>()

// Add JSX renderer middleware
app.use('*', jsxRenderer({
  docType: true,
  stream: true
}))

// Add MDX route with environment access
app.get('*', (c) => {
  const { env } = c

  return c.render(
    <MDXProvider>
      {/* MDX content will be transformed and injected here */}
      <div data-mdxld-content>
        {mdxld.content}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': mdxld.context,
            '@type': mdxld.type,
            ...mdxld.data
          })
        }}
      />
    </MDXProvider>
  )
})

export default app
`
}
