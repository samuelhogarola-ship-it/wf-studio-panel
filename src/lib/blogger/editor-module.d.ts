declare module '@/lib/blogger/editor.mjs' {
  export function getBloggerEditorTarget(site: {
    key: string
    blogger?: { enabled?: boolean; runtime?: string; url?: string }
  }): { kind: 'iframe' | 'external'; href: string } | null
}
