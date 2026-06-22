import { Resend } from 'resend'

import { getRequiredServerEnv } from '@/lib/env'
import { formatHours } from '@/lib/utils'

let resendClient: Resend | null = null

function getResend() {
  if (!resendClient) {
    resendClient = new Resend(getRequiredServerEnv('RESEND_API_KEY'))
  }

  return resendClient
}

export async function sendActivityNotificationEmail({
  clientEmail,
  clientName,
  activityTitle,
  hoursUsed,
  remainingHours,
}: {
  clientEmail: string
  clientName: string
  activityTitle: string
  hoursUsed: number
  remainingHours: number
}) {
  const resend = getResend()

  return resend.emails.send({
    from: getRequiredServerEnv('RESEND_FROM_EMAIL'),
    to: clientEmail,
    subject: 'Actualización de horas contratadas',
    text: [
      `Hola ${clientName},`,
      'Se ha registrado una nueva actividad.',
      `Servicio: ${activityTitle}`,
      `Tiempo consumido: ${formatHours(hoursUsed)}`,
      `Horas restantes: ${formatHours(remainingHours)}`,
      'WF-Studio',
    ].join('\n'),
  })
}
