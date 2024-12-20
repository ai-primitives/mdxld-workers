/// <reference types="@cloudflare/workers-types" />

// Platform API deployment utilities

/**
 * Platform API configuration
 */
export interface PlatformConfig {
  /** Cloudflare account ID */
  accountId: string
  /** Worker namespace */
  namespace: string
  /** API token for authentication */
  apiToken: string
}

/**
 * Deploys a worker to Cloudflare using the Platform API
 */
export async function deployPlatform(worker: string, name: string, config: PlatformConfig): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/workers/dispatch/namespaces/${config.namespace}/scripts/${name}`

  const response = await globalThis.fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/javascript',
    },
    body: worker,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to deploy worker: ${JSON.stringify(error)}`)
  }
}
