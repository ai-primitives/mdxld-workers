// Shim for import.meta.url in environments that don't support it
const importMetaUrl = 'file:///worker'
export default { url: importMetaUrl }
