// Lógica compartida de cupos disponibles (booking público y agenda admin)
// Cada día puede tener VARIOS BLOQUES de atención (ej. 09:00-13:00 y 15:00-21:30).
// Considera duración del servicio, solapamientos y el tiempo de preparación
// que queda reservado después de cada atención.
import { getAvailability, getBlockouts, getOccupiedSlots, getSetting } from './supabase'

// Los cupos se ofrecen cada 15 minutos
export const PASO_MIN = 15

export function todayLocalStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const toMin = (hhmm: string) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// ============ Tiempos de preparación (configurables) ============
export interface Buffers {
  podologia: number
  manicura: number
}
let buffersCache: Buffers | null = null

export async function getBuffers(): Promise<Buffers> {
  if (buffersCache) return buffersCache
  const [p, m] = await Promise.all([
    getSetting('buffer_podologia').catch(() => null),
    getSetting('buffer_manicura').catch(() => null),
  ])
  buffersCache = {
    podologia: parseInt(p ?? '15', 10) || 0,
    manicura: parseInt(m ?? '10', 10) || 0,
  }
  return buffersCache
}

export function clearBuffersCache() {
  buffersCache = null
}

export const bufferDe = (tipo: string | null | undefined, b: Buffers) =>
  tipo === 'manicura' ? b.manicura : b.podologia

export interface Bloque {
  start: number
  end: number
}

export interface DayInfo {
  blocked: boolean
  message: string
  bloques: Bloque[] // bloques de atención del día, ordenados
  busy: { start: number; end: number }[] // ya incluye el tiempo de preparación
  buffers: Buffers
}

// Convierte las filas de availability de un día en bloques ordenados
export function bloquesDelDia(availability: any[], dow: number): Bloque[] {
  return (availability ?? [])
    .filter((a: any) => a.day_of_week === dow && a.is_active !== false)
    .map((a: any) => ({
      start: toMin(String(a.start_time).substring(0, 5)),
      end: toMin(String(a.end_time).substring(0, 5)),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start)
}

export async function getDayInfo(date: string): Promise<DayInfo> {
  const [availability, blockouts, occupied, buffers] = await Promise.all([
    getAvailability(),
    getBlockouts(),
    getOccupiedSlots(date),
    getBuffers(),
  ])

  const empty: DayInfo = { blocked: false, message: '', bloques: [], busy: [], buffers }

  if ((blockouts ?? []).some((b: any) => b.blocked_date === date)) {
    return { ...empty, blocked: true, message: '⛔ Ese día no hay atención (feriado o día bloqueado). Elige otra fecha.' }
  }

  const dow = new Date(date + 'T00:00:00').getDay()
  const bloques = bloquesDelDia(availability ?? [], dow)
  if (bloques.length === 0) {
    return { ...empty, message: '⛔ Ese día no hay atención. Elige otra fecha.' }
  }

  // Cada cita ocupa su duración + el tiempo de preparación posterior
  const busy = (occupied ?? []).map((o: any) => {
    const t = toMin(String(o.slot).substring(11, 16))
    return { start: t, end: t + (o.duration || 60) + bufferDe(o.tipo, buffers) }
  })

  return { blocked: false, message: '', bloques, busy, buffers }
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

// ¿Cabe un servicio de `duration` min empezando en `startMin`?
export function fits(
  info: DayInfo,
  startMin: number,
  duration: number,
  date: string,
  buffer = 0
): boolean {
  const finAtencion = startMin + duration

  // Debe caber completo dentro de ALGÚN bloque de atención
  const dentroDeBloque = info.bloques.some((b) => startMin >= b.start && finAtencion <= b.end)
  if (!dentroDeBloque) return false

  // No puede pisar otra cita ni su tiempo de preparación
  const finConPrep = finAtencion + buffer
  for (const b of info.busy) if (overlaps(startMin, finConPrep, b.start, b.end)) return false

  if (date === todayLocalStr()) {
    const now = new Date()
    if (startMin <= now.getHours() * 60 + now.getMinutes()) return false
  }
  return true
}

export interface SlotsResult {
  slots: string[]
  message: string
}

// ============ Horas fijas ofrecidas en el sitio público ============
const HORAS_PUBLICAS_DEFECTO =
  '08:30,09:00,09:15,10:45,11:45,15:30,16:00,16:45,17:45,18:45,19:45'

export async function getPublicSlotTimes(): Promise<string[]> {
  const v = await getSetting('public_slots').catch(() => null)
  const raw: string = v || HORAS_PUBLICAS_DEFECTO
  return raw
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)
    .sort()
}

// Horas que ve el paciente: de la lista fija, solo las realmente disponibles
// (dentro de un bloque de atención y sin chocar con otra cita ni su preparación)
export async function getPublicAvailableSlots(date: string): Promise<SlotsResult> {
  const [info, fijas] = await Promise.all([getDayInfo(date), getPublicSlotTimes()])
  if (info.blocked || info.bloques.length === 0) {
    return { slots: [], message: info.message || '⛔ Ese día no hay atención.' }
  }
  const slots = fijas.filter((h) => fits(info, toMin(h), 60, date, info.buffers.podologia))
  if (slots.length === 0) {
    return { slots: [], message: '😔 No quedan horas disponibles ese día. Elige otra fecha.' }
  }
  return { slots, message: '' }
}

// Horas de inicio disponibles para un servicio de `duration` minutos
export async function getAvailableSlots(
  date: string,
  duration = 60,
  tipo: 'podologia' | 'manicura' = 'podologia'
): Promise<SlotsResult> {
  const info = await getDayInfo(date)
  if (info.blocked || info.bloques.length === 0) {
    return { slots: [], message: info.message || '⛔ Ese día no hay atención.' }
  }
  const buffer = bufferDe(tipo, info.buffers)
  const out: string[] = []
  for (const bloque of info.bloques) {
    for (let t = bloque.start; t + duration <= bloque.end; t += PASO_MIN) {
      if (fits(info, t, duration, date, buffer)) out.push(toHHMM(t))
    }
  }
  if (out.length === 0) {
    return { slots: [], message: '😔 No quedan horas disponibles ese día. Elige otra fecha.' }
  }
  return { slots: Array.from(new Set(out)).sort(), message: '' }
}

export { toMin, toHHMM }
