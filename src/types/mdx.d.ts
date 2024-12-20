declare module '@mdx-js/mdx' {
  export interface CompileOptions {
    jsx?: boolean
    jsxRuntime?: 'automatic' | 'classic'
    jsxImportSource?: string
    development?: boolean
    outputFormat?: 'program' | 'function-body'
    providerImportSource?: string
  }

  export function compile(content: string, options?: CompileOptions): Promise<string>
}
