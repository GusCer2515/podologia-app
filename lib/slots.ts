// Lógica compartida de cupos disponibles (booking público y agenda admin)
import { getAvailability, getBlockouts, getOccupiedSlots } from './supabase'

export function todayLocalStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface SlotsResult {
  slots: string[]
  message: string // vacío si hay cupos; texto explicativo si no
}

// Horas realmente disponibles para una fecha, según horario
// configurado, días bloqueados y citas ya tomadas
export async function getAvailableSlots(date: string): Promise<SlotsResult> {
  const [availability, blockouts, occupied] = await Promise.all([
    getAvailability(),
    getBlockouts(),
    getOccupiedSlots(date),
  ])

  // ¿Día bloqueado? (feriado, vacaciones, etc.)
  if ((blockouts ?? []).some((b: any) => b.blocked_date === date)) {
    return { slots: [], message: '⛔ Ese día no hay atención (feriado o día bloqueado). Elige otra fecha.' }
  }

  // ¿Hay horario configurado para ese día de la semana?
  const dayOfWeek = new Date(date + 'T00:00:00').getDay()
  const config = (availability ?? []).find((a: any) => a.day_of_week === dayOfWeek)
  if (!config) {
    return { slots: [], message: '⛔ Ese día no hay atención. Elige otra fecha.' }
  }

  // Horas ya tomadas ese día (ej: "10:00", "15:30")
  const occupiedTimes = new Set(occupied.map((o) => String(o.slot).substring(11, 16)))

  // Generar cupos desde hora inicio a hora fin
  const [sh, sm] = String(config.start_time).split(':').map(Number)
  const [eh, em] = String(config.end_time).split(':').map(Number)
  const step = config.slot_duration_minutes || 30
  const now = new Date()
  const isToday = date === todayLocalStr()

  const generated: string[] = []
  for (let mins = sh * 60 + sm; mins + step <= eh * 60 + em; mins += step) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0')
    const m = String(mins % 60).padStart(2, '0')
    const time = `${h}:${m}`

    if (occupiedTimes.has(time)) continue
    if (isToday && new Date(`${date}T${time}:00`) <= now) continue

    generated.push(time)
  }

  if (generated.length === 0) {
    return { slots: [], message: '😔 No quedan horas disponibles ese día. Elige otra fecha.' }
  }
  return { slots: generated, message: '' }
}
