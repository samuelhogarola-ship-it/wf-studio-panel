import { Resend } from 'resend'

import { getRequiredServerEnv } from '@/lib/env'
import { formatDuration } from '@/lib/utils'

let resendClient: Resend | null = null

function getResend() {
  if (!resendClient) {
    resendClient = new Resend(getRequiredServerEnv('RESEND_API_KEY'))
  }

  return resendClient
}

export async function sendAdminRequestEmail({
  clientName,
  clientEmail,
  subject,
  body,
}: {
  clientName: string
  clientEmail: string
  subject: string
  body: string
}) {
  const resend = getResend()
  return resend.emails.send({
    from: getRequiredServerEnv('RESEND_FROM_EMAIL'),
    to: 'samuel.hogarola@gmail.com',
    subject: `[WF-Studio] Solicitud de ${clientName}: ${subject}`,
    text: [
      `Nueva solicitud de ${clientName} (${clientEmail})`,
      '',
      subject,
      '',
      body,
      '',
      '— Enviado desde el panel de cliente WF-Studio',
    ].join('\n'),
  })
}

export async function sendActivityNotificationEmail({
  clientEmail,
  clientName,
  activityTitle,
  minutesUsed,
  remainingMinutes,
}: {
  clientEmail: string
  clientName: string
  activityTitle: string
  minutesUsed: number
  remainingMinutes: number
}) {
  const resend = getResend()

  return resend.emails.send({
    from: getRequiredServerEnv('RESEND_FROM_EMAIL'),
    to: clientEmail,
    subject: 'Actualización de minutos contratados',
    text: [
      `Hola ${clientName},`,
      'Se ha registrado una nueva actividad.',
      `Servicio: ${activityTitle}`,
      `Tiempo consumido: ${formatDuration(minutesUsed)}`,
      `Minutos restantes: ${formatDuration(remainingMinutes)}`,
      'WF-Studio',
    ].join('\n'),
  })
}
