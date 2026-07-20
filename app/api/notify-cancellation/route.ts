import { NextResponse } from 'next/server'
import { getClinicInfo } from '@/lib/clinicConfig'
import {
  sendEmail,
  emailBase,
  nombreServicio,
  fechaLarga,
  getAppointmentContact,
  marcarEnviado,
  emailValido,
} from '@/lib/email'

// ============================================================
// Aviso al paciente cuando su hora se cancela.
// Se envía tanto si canceló la clínica como si canceló el paciente:
// en ambos casos sirve como constancia de que la hora quedó liberada.
// ============================================================

export async function POST(req: Request) {
  try {
    const { appointmentId } = await req.json()
    if (!appointmentId) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const contact = await getAppointmentContact(appointmentId)
    if (!contact?.found) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    if (!emailValido(contact.email)) {
      return NextResponse.json({ ok: false, reason: 'sin_email' })
    }
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_FROM_EMAIL) {
      return NextResponse.json({ ok: false, reason: 'email_not_configured' })
    }

    const info = await getClinicInfo()
    const fecha = fechaLarga(contact.fecha)
    const servicio = nombreServicio(contact.tipo, contact.servicio)

    await sendEmail(
      contact.email,
      `Tu hora del ${contact.fecha} fue cancelada — ${info.brand}`,
      emailBase(info, `
        <p style="font-size:16px">Hola <strong>${contact.name}</strong> 👋</p>
        <p style="font-size:16px">
          Te confirmamos que tu hora quedó <strong style="color:#c96f85">cancelada</strong>:
        </p>
        <div style="background:#f1e9de;border-radius:14px;padding:18px 22px;margin:18px 0">
          <p style="margin:0;font-size:16px">📅 <strong>${fecha}</strong></p>
          <p style="margin:6px 0 0;font-size:16px">🕐 <strong>${contact.hora} hrs</strong></p>
          <p style="margin:6px 0 0;font-size:16px">${servicio}</p>
        </div>
        <p style="font-size:15px">
          Si quieres tomar otra hora, puedes hacerlo cuando gustes en nuestra agenda en línea
          o escribiéndonos por WhatsApp al ${info.phone}.
        </p>
        <p style="font-size:16px">¡Esperamos verte pronto! 🌸</p>
      `),
      info.brand
    )

    await marcarEnviado(appointmentId, 'cancelacion')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('notify-cancellation error:', err)
    return NextResponse.json(
      {
        ok: false,
        stage: err?.brevoStatus ? 'brevo' : 'server',
        brevoStatus: err?.brevoStatus ?? null,
        detail: String(err?.brevoDetail ?? err?.message ?? 'error').slice(0, 300),
      },
      { status: 500 }
    )
  }
}
