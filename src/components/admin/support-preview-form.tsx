'use client'

import { useFormStatus } from 'react-dom'

import { startSupportPreviewAction } from '@/lib/actions/support-preview'
import { supportPreviewTranslations, type Locale } from '@/lib/i18n'

function SubmitButton({
  clientName,
  disabled,
  locale,
}: {
  clientName: string
  disabled: boolean
  locale: Locale
}) {
  const { pending } = useFormStatus()
  const copy = supportPreviewTranslations[locale]
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
    >
      {pending ? copy.starting : `${copy.viewAs} ${clientName}`}
    </button>
  )
}

export function SupportPreviewForm({
  clientId,
  clientName,
  projectId,
  returnPath,
  disabledReason,
  locale = 'es',
}: {
  clientId?: string
  clientName: string
  projectId?: string
  returnPath: string
  disabledReason?: string
  locale?: Locale
}) {
  return (
    <div className="grid gap-2" data-support-preview-entry>
      <form action={startSupportPreviewAction}>
        {clientId ? <input type="hidden" name="client_id" value={clientId} /> : null}
        {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
        <input type="hidden" name="return_path" value={returnPath} />
        <SubmitButton clientName={clientName} disabled={Boolean(disabledReason)} locale={locale} />
      </form>
      {disabledReason ? <p className="text-sm text-amber-800" role="status">{disabledReason}</p> : null}
    </div>
  )
}
