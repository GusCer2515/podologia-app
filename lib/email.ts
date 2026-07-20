// Envío de correos con Brevo. SOLO servidor: la API key nunca llega al
// navegador. Lo comparten las rutas de confirmación y de cancelación.

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromName: string
) {
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
    const err: any = new Error(`Brevo ${res.status}: ${detail}`)
    err.brevoStatus = res.status
    err.brevoDetail = detail
    throw err
  }
}

export function emailBase(info: any, contenido: string) {
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

// Nombre legible del servicio para el asunto y el cuerpo del correo
export function nombreServicio(tipo?: string, servicio?: string | null): string {
  if (tipo === 'manicura') return servicio ? `💅 ${servicio}` : '💅 Manicura'
  return '🦶 Podología'
}

export function fechaLarga(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Consulta el contacto de la cita (nombre, correo, tipo de servicio...)
export async function getAppointmentContact(appointmentId: string) {
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
  return res.json()
}

// Deja constancia de que el aviso salió, para no repetirlo
export async function marcarEnviado(appointmentId: string, tipo: 'confirmacion' | 'cancelacion') {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/mark_notification_sent`, {
      method: 'POST',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_id: appointmentId, p_tipo: tipo }),
    })
  } catch {
    // El correo ya salió: que falle la marca no debe romper la respuesta
  }
}

export const emailValido = (e?: string) => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)
