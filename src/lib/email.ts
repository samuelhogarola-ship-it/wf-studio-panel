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

export async function sendPackDepletedEmail({
  clientEmail,
  clientName,
  packName,
  activities,
}: {
  clientEmail: string
  clientName: string
  packName: string
  activities: { title: string; activity_type: string; minutes_used: number; work_date: string }[]
}) {
  const resend = getResend()
  const total = activities.reduce((sum, a) => sum + a.minutes_used, 0)
  const lines = activities.map(
    (a) => `  • ${a.work_date}  ${a.title} (${a.activity_type}) — ${formatDuration(a.minutes_used)}`
  )
  return resend.emails.send({
    from: getRequiredServerEnv('RESEND_FROM_EMAIL'),
    to: clientEmail,
    subject: `[WF-Studio] Resumen de actividad — ${packName}`,
    text: [
      `Hola ${clientName},`,
      '',
      `Tu bono "${packName}" ha sido completado. Aquí tienes el resumen de todo el trabajo realizado:`,
      '',
      ...lines,
      '',
      `Tiempo total consumido: ${formatDuration(total)}`,
      '',
      'Si necesitas renovar el bono o tienes alguna duda, escríbenos.',
      '',
      '— WF-Studio',
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

export async function sendPendingItemCreatedEmail({
  clientEmail,
  clientName,
  title,
  description,
  reminderIntervalDays,
}: {
  clientEmail: string
  clientName: string
  title: string
  description?: string | null
  reminderIntervalDays?: number | null
}) {
  const resend = getResend()

  return resend.emails.send({
    from: getRequiredServerEnv('RESEND_FROM_EMAIL'),
    to: clientEmail,
    subject: `[WF-Studio] Nuevo pendiente: ${title}`,
    text: [
      `Hola ${clientName},`,
      '',
      'Hemos añadido un nuevo dato o tarea pendiente en tu panel:',
      '',
      `Pendiente: ${title}`,
      ...(description ? ['', 'Detalle:', description] : []),
      '',
      reminderIntervalDays
        ? `Te enviaremos un recordatorio por email cada ${reminderIntervalDays === 1 ? 'día' : `${reminderIntervalDays} días`} hasta recibirlo.`
        : 'Puedes revisarlo en el apartado "Pendientes" de tu panel.',
      '',
      '— WF-Studio',
    ].join('\n'),
  })
}

export async function sendPendingItemReminderEmail({
  clientEmail,
  clientName,
  title,
  description,
  requestedAt,
}: {
  clientEmail: string
  clientName: string
  title: string
  description?: string | null
  requestedAt: string
}) {
  const resend = getResend()

  return resend.emails.send({
    from: getRequiredServerEnv('RESEND_FROM_EMAIL'),
    to: clientEmail,
    subject: `[WF-Studio] Recordatorio pendiente: ${title}`,
    text: [
      `Hola ${clientName},`,
      '',
      'Seguimos pendientes de recibir este dato o material para continuar:',
      '',
      `Pendiente: ${title}`,
      `Solicitado el: ${requestedAt}`,
      ...(description ? ['', 'Detalle:', description] : []),
      '',
      'Cuando lo tengas, envíanoslo y lo marcaremos como recibido en tu panel.',
      '',
      '— WF-Studio',
    ].join('\n'),
  })
}

export async function sendPublicContactEmail({
  name,
  email,
  company,
  message,
  pageUrl,
}: {
  name: string
  email: string
  company?: string
  message: string
  pageUrl?: string
}) {
  const resend = getResend()

  return resend.emails.send({
    from: getRequiredServerEnv('RESEND_FROM_EMAIL'),
    to: 'info@webfuengirola.com',
    replyTo: email,
    subject: `[WF-Studio] Nuevo contacto web: ${name}`,
    text: [
      'Nuevo mensaje desde el formulario público de Web Fuengirola.',
      '',
      `Nombre: ${name}`,
      `Email: ${email}`,
      `Empresa: ${company || 'No indicada'}`,
      `Página: ${pageUrl || 'No disponible'}`,
      '',
      'Mensaje:',
      message,
      '',
      '— Enviado desde webfuengirola.com',
    ].join('\n'),
  })
}
