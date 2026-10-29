import { redirect } from 'next/navigation'

export default function ClientRegisterPage() {
  redirect('/cliente?error=invite_required')
}
