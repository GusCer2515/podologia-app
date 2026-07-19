// Teléfonos chilenos y enlaces de WhatsApp.
// wa.me EXIGE el número completo con código de país (56...). Si se le pasa
// un número local, WhatsApp abre un chat cualquiera —incluso el del propio
// usuario— en vez del de la clínica.

import { CLINIC } from './clinicConfig'

// 56 + 9 + 8 dígitos
const LARGO_VALIDO = 11

export function waPhone(phone?: string | null): string {
  const d = String(phone ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('56')) return d // ya viene con código de país
  if (d.length === 9 && d.startsWith('9')) return '56' + d // 9XXXXXXXX
  if (d.length === 8) return '569' + d // sin el 9 inicial
  return d
}

export function esWaValido(phone?: string | null): boolean {
  const d = waPhone(phone)
  return d.length === LARGO_VALIDO && d.startsWith('569')
}

// Número de la clínica. Si el guardado en Configuración quedó incompleto,
// se usa el de respaldo: es preferible eso a abrir un chat equivocado.
export function waClinica(phone?: string | null): string {
  return esWaValido(phone) ? waPhone(phone) : waPhone(CLINIC.phone)
}

// Enlace listo para el botón "Consultar por WhatsApp" del sitio público
export function waLinkClinica(phone: string | null | undefined, texto: string): string {
  return `https://wa.me/${waClinica(phone)}?text=${encodeURIComponent(texto)}`
}
