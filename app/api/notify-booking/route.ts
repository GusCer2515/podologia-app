import { NextResponse } from 'next/server'
import { getClinicInfo } from '@/lib/clinicConfig'

// ============================================================
// Envía correos de confirmación al reservar una cita:
// 1. Al paciente (confirmación)
// 2. A la clínica (aviso de nueva reserva)
// Usa BREVO (plan gratis permanente: 300 correos/día)
// La API key vive SOLO en el servidor
// ============================================================

async function sendEmail(to: string, subject: string, html: string, fromName: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_FROM_EMAIL, name: fromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Brevo ${res.status}: ${detail}`)
  }
}

function emailBase(info: any, contenido: string) {
  return `
  <div style="background:#faf6f0;padding:32px 16px;font-family:Georgia,serif;color:#43414a">
    <div style="max-width:520px;margin:0 auto;background:#fffdf9;border-radius:20px;padding:36px;border:1px solid #f1e9de">
      <h1 style="font-style:italic;color:#33506e;text-align:center;margin:0 0 4px;font-weight:600">
        ${info.brand}
      </h1>
      <p style="text-align:center;color:#c96f85;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 28px">
        ${info.subtitle}
      </p>
      ${contenido}
      <hr style="border:none;border-top:1px solid #f1e9de;margin:28px 0 16px" />
      <p style="text-align:center;font-size:12px;color:#999;margin:0">
        ${info.professional} · ${info.instagram} · ${info.phone}
      </p>
    </div>
  </div>`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { appointmentId, date, time } = body
    let { name, email, phone } = body

    if (!appointmentId || !date || !time) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Obtener contacto real desde la BD por el id de la cita.
    // Esto verifica que la cita exista Y recupera el email de pacientes
    // recurrentes que agendaron solo con su RUT.
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_appointment_contact`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_id: appointmentId }),
      }
    )
    const contact = await res.json()
    if (!contact?.found) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    name = contact.name || name
    email = contact.email || email
    phone = contact.phone || phone

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    if (!process.env.BREVO_API_KEY || !process.env.BREVO_FROM_EMAIL) {
      // Email no configurado aún: no es un error fatal para el paciente
      return NextResponse.json({ ok: false, reason: 'email_not_configured' })
    }

    // Datos de contacto vigentes (editables desde el panel)
    const info = await getClinicInfo()

    const fecha = new Date(date + 'T00:00:00').toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

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
        </div>
        <p style="font-size:14px;color:#666">Si necesitas cambiar o cancelar tu hora, contáctanos por WhatsApp al ${info.phone}.</p>
        <p style="font-size:16px">¡Te esperamos! 🌸</p>
      `),
      info.brand
    )

    // 2. Aviso a la clínica
    await sendEmail(
      info.email,
      `📅 Nueva reserva: ${name} — ${date} ${time}`,
      emailBase(info, `
        <p style="font-size:16px"><strong>Nueva hora reservada</strong></p>
        <div style="background:#f1e9de;border-radius:14px;padding:18px 22px;margin:18px 0;font-size:15px">
          <p style="margin:0">👤 <strong>${name}</strong></p>
          <p style="margin:6px 0 0">📅 ${fecha} · 🕐 ${time} hrs</p>
          <p style="margin:6px 0 0">📞 ${phone || 'Sin teléfono'}</p>
          <p style="margin:6px 0 0">✉️ ${email}</p>
        </div>
        <p style="font-size:14px;color:#666">Revisa el detalle en tu panel administrativo.</p>
      `),
      info.brand
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('notify-booking error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
