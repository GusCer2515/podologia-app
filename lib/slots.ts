// Lógica compartida de cupos disponibles (booking público y agenda admin)
// Ahora considera DURACIÓN del servicio, ALMUERZO y SOLAPAMIENTOS.
import { getAvailability, getBlockouts, getOccupiedSlots } from './supabase'

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

export interface DayInfo {
  blocked: boolean
  message: string
  start: number // minutos desde medianoche
  end: number
  lunchStart: number | null
  lunchEnd: number | null
  busy: { start: number; end: number }[] // intervalos ocupados (min)
}

// Info del día: horario, almuerzo y citas ocupadas (con su duración)
export async function getDayInfo(date: string): Promise<DayInfo> {
  const [availability, blockouts, occupied] = await Promise.all([
    getAvailability(),
    getBlockouts(),
    getOccupiedSlots(date),
  ])

  const empty: DayInfo = {
    blocked: false,
    message: '',
    start: 0,
    end: 0,
    lunchStart: null,
    lunchEnd: null,
    busy: [],
  }

  if ((blockouts ?? []).some((b: any) => b.blocked_date === date)) {
    return { ...empty, blocked: true, message: '⛔ Ese día no hay atención (feriado o día bloqueado). Elige otra fecha.' }
  }

  const dow = new Date(date + 'T00:00:00').getDay()
  const config = (availability ?? []).find((a: any) => a.day_of_week === dow)
  if (!config) {
    return { ...empty, message: '⛔ Ese día no hay atención. Elige otra fecha.' }
  }

  const busy = (occupied ?? []).map((o: any) => {
    const t = toMin(String(o.slot).substring(11, 16))
    return { start: t, end: t + (o.duration || 60) }
  })

  return {
    blocked: false,
    message: '',
    start: toMin(String(config.start_time).substring(0, 5)),
    end: toMin(String(config.end_time).substring(0, 5)),
    lunchStart: config.lunch_start ? toMin(String(config.lunch_start).substring(0, 5)) : null,
    lunchEnd: config.lunch_end ? toMin(String(config.lunch_end).substring(0, 5)) : null,
    busy,
  }
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

// ¿Cabe un servicio de `duration` minutos empezando en `startMin`?
export function fits(info: DayInfo, startMin: number, duration: number, date: string): boolean {
  const endMin = startMin + duration
  if (endMin > info.end) return false
  if (info.lunchStart != null && info.lunchEnd != null && overlaps(startMin, endMin, info.lunchStart, info.lunchEnd))
    return false
  for (const b of info.busy) if (overlaps(startMin, endMin, b.start, b.end)) return false
  // Si es hoy, no permitir horas ya pasadas
  if (date === todayLocalStr()) {
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (startMin <= nowMin) return false
  }
  return true
}

export interface SlotsResult {
  slots: string[]
  message: string
}

// Horas de inicio disponibles para un servicio de `duration` minutos
export async function getAvailableSlots(date: string, duration = 60): Promise<SlotsResult> {
  const info = await getDayInfo(date)
  if (info.blocked || info.start === info.end) {
    return { slots: [], message: info.message || '⛔ Ese día no hay atención.' }
  }
  const out: string[] = []
  for (let t = info.start; t + duration <= info.end; t += 30) {
    if (fits(info, t, duration, date)) out.push(toHHMM(t))
  }
  if (out.length === 0) {
    return { slots: [], message: '😔 No quedan horas disponibles ese día. Elige otra fecha.' }
  }
  return { slots: out, message: '' }
}

export { toMin, toHHMM }
