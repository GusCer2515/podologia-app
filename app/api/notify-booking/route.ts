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
// Correos al reservar una cita (podología o manicura):
// 1. Al paciente (confirmación)
// 2. A la clínica (aviso de nueva reserva)
// Usa BREVO (plan gratis permanente: 300 correos/día)
// La API key vive SOLO en el servidor
// ============================================================

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // soloPaciente: cuando agenda la propia clínica, no se envía el aviso interno
    const { appointmentId, soloPaciente } = body
    let { name, email, phone, date, time } = body

    if (!appointmentId) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Obtener contacto real desde la BD por el id de la cita.
    // Esto verifica que la cita exista Y recupera el email de pacientes
    // recurrentes que agendaron solo con su RUT.
    const contact = await getAppointmentContact(appointmentId)
    if (!contact?.found) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    name = contact.name || name
    email = contact.email || email
    phone = contact.phone || phone
    // La fecha y hora se toman de la BD: es la fuente confiable
    date = contact.fecha || date
    time = contact.hora || time

    if (!date || !time) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    if (!emailValido(email)) {
      return NextResponse.json({ ok: false, reason: 'sin_email' }, { status: 400 })
    }

    if (!process.env.BREVO_API_KEY || !process.env.BREVO_FROM_EMAIL) {
      // Email no configurado aún: no es un error fatal para el paciente
      return NextResponse.json({ ok: false, reason: 'email_not_configured' })
    }

    // Datos de contacto vigentes (editables desde el panel)
    const info = await getClinicInfo()
    const fecha = fechaLarga(date)
    const servicio = nombreServicio(contact.tipo, contact.servicio)

    // 1. Correo al paciente
    await sendEmail(
      email,
      `✅ Tu hora está reservada — ${info.brand}`,
      emailBase(info, `
        <p style="font-size:16px">Hola <strong>${name}</strong> 👋</p>
        <p style="font-size:16px">Tu hora quedó <strong style="color:#33506e">reservada</strong>:</p>
        <div style="background:#f3dee2;border-radius:14px;padding:18px 22px;margin:18px 0">
          <p style="margin:0;font-size:16px">📅 <strong>${fecha}</strong></p>
          <p style="margin:6px 0 0;font-size:16px">🕐 <strong>${time} hrs</strong></p>
          <p style="margin:6px 0 0;font-size:16px">${servicio}</p>
        </div>
        ${
          contact.es_nuevo
            ? `<div style="background:#f1e9de;border-radius:14px;padding:16px 20px;margin:18px 0">
                 <p style="margin:0;font-size:15px">📍 <strong>¿Dónde nos ubicamos?</strong></p>
                 <p style="margin:6px 0 0;font-size:14px;color:#555">
                   Como es tu primera visita, te enviaremos la <strong>dirección por WhatsApp</strong>
                   al ${info.phone} junto con las indicaciones para llegar.
                 </p>
               </div>`
            : `<p style="font-size:15px;color:#555">📍 Te esperamos <strong>donde siempre</strong>. 😊</p>`
        }
        <p style="font-size:14px;color:#666">Si necesitas cambiar o cancelar tu hora, contáctanos por WhatsApp al ${info.phone}.</p>
        <p style="font-size:16px">¡Te esperamos! 🌸</p>
      `),
      info.brand
    )

    await marcarEnviado(appointmentId, 'confirmacion')

    // 2. Aviso a la clínica (se omite si la propia clínica agendó la hora)
    if (soloPaciente) {
      return NextResponse.json({ ok: true, soloPaciente: true })
    }

    await sendEmail(
      (info as any).notifyEmail?.trim() || info.email,
      `📅 Nueva reserva: ${name} — ${date} ${time}`,
      emailBase(info, `
        <p style="font-size:16px"><strong>Nueva hora reservada</strong></p>
        <div style="background:#f1e9de;border-radius:14px;padding:18px 22px;margin:18px 0;font-size:15px">
          <p style="margin:0">👤 <strong>${name}</strong></p>
          <p style="margin:6px 0 0">📅 ${fecha} · 🕐 ${time} hrs</p>
          <p style="margin:6px 0 0">${servicio}</p>
          <p style="margin:6px 0 0">📞 ${phone || 'Sin teléfono'}</p>
          <p style="margin:6px 0 0">✉️ ${email}</p>
        </div>
        <p style="font-size:14px;color:#666">Revisa el detalle en tu panel administrativo.</p>
      `),
      info.brand
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // Devolver el motivo real ayuda a diagnosticar fallos de envío
    // (p. ej. API key inválida o remitente no verificado en Brevo)
    console.error('notify-booking error:', err)
    return NextResponse.json(
      {
        ok: false,
        stage: err?.brevoStatus ? 'brevo' : 'server',
        brevoStatus: err?.brevoStatus ?? null,
        detail: String(err?.brevoDetail ?? err?.message ?? 'error').slice(0, 300),
        from: process.env.BREVO_FROM_EMAIL ?? null,
        hasKey: !!process.env.BREVO_API_KEY,
      },
      { status: 500 }
    )
  }
}
