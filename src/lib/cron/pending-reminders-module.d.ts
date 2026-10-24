declare module '@/lib/cron/pending-reminders.mjs' {
  export function isAuthorizedCronRequest(options: {
    configuredSecret?: string
    authorization?: string | null
  }): boolean
}
