type FormMessageProps = {
  error?: string
  success?: string
}

export function FormMessage({ error, success }: FormMessageProps) {
  if (!error && !success) return null

  return (
    <p className={error ? 'text-sm font-medium text-rose-600' : 'text-sm font-medium text-emerald-700'}>
      {error ?? success}
    </p>
  )
}
