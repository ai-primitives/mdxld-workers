// Provide import.meta.url shim for ESM compatibility
export const importMetaUrl = new URL(import.meta.url).toString();
