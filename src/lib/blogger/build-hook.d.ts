declare module '@/lib/blogger/build-hook.mjs' {
  export function buildHookRequest(siteKey: string): { url: string; headers: Record<string, string>; body: string }
}
