declare module '@/lib/contact-form.mjs' {
  type ContactDependencies = {
    env?: NodeJS.ProcessEnv
    fetchImpl?: typeof fetch
    sendEmail?: (message: { name: string; email: string; company?: string; message: string; pageUrl?: string }) => Promise<unknown>
  }
  export function handleContactOptions(request: Request, methods: string): Response
  export function handleContactConfigGet(request: Request, dependencies?: ContactDependencies): Promise<Response>
  export function handleContactPost(request: Request, dependencies?: ContactDependencies): Promise<Response>
}
