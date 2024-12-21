// Provide import.meta.url shim for ESM compatibility
export const importMetaUrl = globalThis.URL ? new globalThis.URL(import.meta.url).toString() : import.meta.url
