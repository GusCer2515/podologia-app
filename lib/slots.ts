// Lógica compartida de cupos disponibles (booking público y agenda admin)
// Considera DURACIÓN del servicio, ALMUERZO, SOLAPAMIENTOS y el TIEMPO DE
// PREPARACIÓN que queda reservado después de cada atención.
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

export interface DayInfo {
  blocked: boolean
  message: string
  start: number
  end: number
  lunchStart: number | null
  lunchEnd: number | null
  busy: { start: number; end: number }[] // ya incluye el tiempo de preparación
  buffers: Buffers
}

export async function getDayInfo(date: string): Promise<DayInfo> {
  const [availability, blockouts, occupied, buffers] = await Promise.all([
    getAvailability(),
    getBlockouts(),
    getOccupiedSlots(date),
    getBuffers(),
  ])

  const empty: DayInfo = {
    blocked: false,
    message: '',
    start: 0,
    end: 0,
    lunchStart: null,
    lunchEnd: null,
    busy: [],
    buffers,
  }

  if ((blockouts ?? []).some((b: any) => b.blocked_date === date)) {
    return { ...empty, blocked: true, message: '⛔ Ese día no hay atención (feriado o día bloqueado). Elige otra fecha.' }
  }

  const dow = new Date(date + 'T00:00:00').getDay()
  const config = (availability ?? []).find((a: any) => a.day_of_week === dow)
  if (!config) {
    return { ...empty, message: '⛔ Ese día no hay atención. Elige otra fecha.' }
  }

  // Cada cita ocupa su duración + el tiempo de preparación posterior
  const busy = (occupied ?? []).map((o: any) => {
    const t = toMin(String(o.slot).substring(11, 16))
    return { start: t, end: t + (o.duration || 60) + bufferDe(o.tipo, buffers) }
  })

  return {
    blocked: false,
    message: '',
    start: toMin(String(config.start_time).substring(0, 5)),
    end: toMin(String(config.end_time).substring(0, 5)),
    lunchStart: config.lunch_start ? toMin(String(config.lunch_start).substring(0, 5)) : null,
    lunchEnd: config.lunch_end ? toMin(String(config.lunch_end).substring(0, 5)) : null,
    busy,
    buffers,
  }
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

// ¿Cabe un servicio de `duration` min empezando en `startMin`?
// `buffer` es la preparación que quedará reservada después.
export function fits(
  info: DayInfo,
  startMin: number,
  duration: number,
  date: string,
  buffer = 0
): boolean {
  const finAtencion = startMin + duration
  const finConPrep = finAtencion + buffer

  // La atención debe terminar dentro del horario (la preparación puede quedar fuera)
  if (finAtencion > info.end) return false
  if (info.lunchStart != null && info.lunchEnd != null && overlaps(startMin, finAtencion, info.lunchStart, info.lunchEnd))
    return false
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

// Horas de inicio disponibles para un servicio de `duration` minutos
export async function getAvailableSlots(
  date: string,
  duration = 60,
  tipo: 'podologia' | 'manicura' = 'podologia'
): Promise<SlotsResult> {
  const info = await getDayInfo(date)
  if (info.blocked || info.start === info.end) {
    return { slots: [], message: info.message || '⛔ Ese día no hay atención.' }
  }
  const buffer = bufferDe(tipo, info.buffers)
  const out: string[] = []
  for (let t = info.start; t + duration <= info.end; t += PASO_MIN) {
    if (fits(info, t, duration, date, buffer)) out.push(toHHMM(t))
  }
  if (out.length === 0) {
    return { slots: [], message: '😔 No quedan horas disponibles ese día. Elige otra fecha.' }
  }
  return { slots: out, message: '' }
}

export { toMin, toHHMM }
