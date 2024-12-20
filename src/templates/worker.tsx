import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { MDXProvider } from '@mdx-js/react'
import { compile } from '@mdx-js/mdx'
import * as runtime from 'react/jsx-runtime'
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
  // Convert YAML-LD frontmatter $ prefix to @ prefix
  const jsonLdData = Object.fromEntries(
    Object.entries(mdxld.data)
      .map(([key, value]) => [
        key.startsWith('$') ? '@' + key.slice(1) : key,
        value
      ])
  )

  return `
import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { MDXProvider } from '@mdx-js/react'
import * as runtime from 'react/jsx-runtime'

// MDXLD content and metadata
const mdxld = {
  content: ${JSON.stringify(mdxld.content)},
  context: ${JSON.stringify(mdxld.context)},
  type: ${JSON.stringify(mdxld.type)},
  data: ${JSON.stringify(jsonLdData)}
}

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
      <div data-mdxld-content dangerouslySetInnerHTML={{ __html: mdxld.content }} />
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
            )
          })
        }}
      />
    </MDXProvider>
  )
})

export default app
`
}
