declare module '@/lib/blogger/build-hook.mjs' {
  export function buildHookRequest(siteKey: string, env?: NodeJS.ProcessEnv): { url: string; headers: Record<string, string>; body: string }
  export function executeBuildHook(siteKey: string): Promise<{ status: number; body: { error: string } | { ok: true; siteKey: string } }>
}
