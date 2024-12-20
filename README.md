# mdxld-workers

[![npm version](https://badge.fury.io/js/%40ai-primitives%2Fmdxld-workers.svg)](https://www.npmjs.com/package/@ai-primitives/mdxld-workers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Compile and deploy MDXLD files to Cloudflare Workers using Hono JSX and the Workers Platform API.

## Features

- 🚀 Compile MDXLD files into Cloudflare Workers with Hono JSX support
- ⚡️ Deploy workers using the Cloudflare Workers Platform API
- 🔧 Deploy workers using Wrangler CLI
- 📝 Full TypeScript support with proper JSX configuration
- 🎨 Support for both CLI and programmatic usage

## Installation

```bash
pnpm add @ai-primitives/mdxld-workers
```

## Usage

### CLI Usage

```bash
# Compile an MDXLD file to a Cloudflare Worker
mdxld-workers compile input.mdx --config worker.config.json

# Deploy using Wrangler
mdxld-workers deploy --name my-worker

# Deploy using Platform API
mdxld-workers deploy-platform --namespace my-namespace --account-id xxx
```

### Configuration

worker.config.json:
```json
{
  "jsx": {
    "importSource": "hono/jsx",
    "runtime": "react-jsx"
  },
  "worker": {
    "name": "my-worker",
    "routes": ["/api/*"],
    "compatibilityDate": "2023-12-20"
  },
  "platform": {
    "namespace": "my-namespace",
    "accountId": "xxx"
  }
}
```

### API Usage

```typescript
import { compile, deploy, deployPlatform } from '@ai-primitives/mdxld-workers'

// Compile MDXLD to Worker
const worker = await compile('input.mdx', {
  jsx: {
    importSource: 'hono/jsx',
    runtime: 'react-jsx'
  }
})

// Deploy using Wrangler
await deploy(worker, {
  name: 'my-worker',
  routes: ['/api/*']
})

// Deploy using Platform API
await deployPlatform(worker, {
  namespace: 'my-namespace',
  accountId: 'xxx'
})
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build the package
pnpm build

# Lint the code
pnpm lint

# Format the code
pnpm format
```

## Contributing

Please read our [Contributing Guide](./CONTRIBUTING.md) to learn about our development process and how to propose bugfixes and improvements.

## License

MIT © [AI Primitives](https://mdx.org.ai)

## Dependencies

This package uses the following key dependencies:

- @mdx-js/react for MDX processing
- hono/jsx for JSX runtime
- @cloudflare/workers-types for Worker types
- wrangler for Worker deployment
