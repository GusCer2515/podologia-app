'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  getAppointmentsBetween,
  updateAppointmentStatus,
  getBlockouts,
  getAvailability,
  getPatients,
  adminCreateAppointment,
  getNailServices,
} from '@/lib/supabase'
import {
  todayLocalStr,
  getBuffers,
  bufferDe,
  bloquesDelDia,
  PASO_MIN,
  type Buffers,
} from '@/lib/slots'
import { initials, colorFor } from '@/lib/avatar'
import { showToast } from '@/components/toast'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function mondayOf(d: Date): Date {
  const monday = new Date(d)
  const day = monday.getDay()
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day))
  monday.setHours(0, 0, 0, 0)
  return monday
}
const toLocalIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtShort = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
const toMin = (hhmm: string) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const overlaps = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-white border-tinta text-tinta',
  completed: 'bg-salvia/10 border-salvia text-tinta',
  cancelled: 'bg-rosa-palo/30 border-rosa/40 text-rosa/60 line-through',
}

export default function AdminAgendaPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [appointments, setAppointments] = useState<any[]>([])
  const [blockouts, setBlockouts] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [nailServices, setNailServices] = useState<any[]>([])
  const [buffers, setBuffers] = useState<Buffers>({ podologia: 15, manicura: 10 })
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todo' | 'podologia' | 'manicura'>('todo')

  // Modal de agendar
  const [bookSlot, setBookSlot] = useState<{ date: string; time: string; info: any } | null>(null)
  const [bookPatient, setBookPatient] = useState('')
  const [bookSearch, setBookSearch] = useState('')
  const [bookNotes, setBookNotes] = useState('')
  const [bookTipo, setBookTipo] = useState<'podologia' | 'manicura'>('podologia')
  const [bookServiceId, setBookServiceId] = useState('')
  const [savingBook, setSavingBook] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<any>(null)

  const todayIso = todayLocalStr()

  const loadWeek = useCallback(async (start: Date) => {
    setLoading(true)
    try {
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const [appts, blocks, avail] = await Promise.all([
        getAppointmentsBetween(`${toLocalIso(start)}T00:00:00`, `${toLocalIso(end)}T00:00:00`),
        getBlockouts().catch(() => []),
        getAvailability().catch(() => []),
      ])
      setAppointments(appts || [])
      setBlockouts(blocks || [])
      setAvailability(avail || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWeek(weekStart)
  }, [weekStart, loadWeek])

  useEffect(() => {
    getPatients().then((p) => setPatients(p || [])).catch(() => {})
    getNailServices(true).then((s) => setNailServices(s || [])).catch(() => {})
    getBuffers().then(setBuffers).catch(() => {})
  }, [])

  const changeWeek = (delta: number) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + delta)
    setWeekStart(next)
  }

  const setStatus = async (id: string, status: string) => {
    try {
      await updateAppointmentStatus(id, status)
      loadWeek(weekStart)
    } catch (err) {
      showToast('Error actualizando la cita', 'error')
      console.error(err)
    }
  }

  const confirmBook = async () => {
    if (!bookSlot || !bookPatient) {
      showToast('Selecciona el paciente', 'error')
      return
    }
    const servicio = nailServices.find((s) => s.id === bookServiceId)
    const duration = bookTipo === 'manicura' ? servicio?.duracion_minutes ?? 60 : 60
    if (bookTipo === 'manicura' && !bookServiceId) {
      showToast('Selecciona el servicio de manicura', 'error')
      return
    }

    // Validar que el servicio CABE (incluyendo el tiempo de preparación posterior)
    const info = bookSlot.info
    const prep = bookTipo === 'manicura' ? buffers.manicura : buffers.podologia
    const startMin = toMin(bookSlot.time)
    const endMin = startMin + duration
    const endConPrep = endMin + prep
    // La atención completa debe caber dentro de un bloque de atención
    const dentroDeBloque = info.bloques.some(
      (b: any) => startMin >= b.start && endMin <= b.end
    )
    if (!dentroDeBloque) {
      showToast(
        `El servicio de ${duration} min no cabe en el bloque de atención (terminaría ${toHHMM(endMin)})`,
        'error'
      )
      return
    }
    if (info.busy.some((b: any) => overlaps(startMin, endConPrep, b.start, b.end))) {
      showToast(
        `No cabe: termina ${toHHMM(endMin)} y con ${prep} min de preparación llega a ${toHHMM(endConPrep)}, chocando con la siguiente cita`,
        'error'
      )
      return
    }

    setSavingBook(true)
    try {
      await adminCreateAppointment(
        bookPatient,
        `${bookSlot.date}T${bookSlot.time}:00`,
        bookNotes || 'Agendada por administración',
        bookTipo === 'manicura'
          ? { tipo: 'manicura', nail_service_id: bookServiceId, valor: servicio?.valor ?? null, duration_minutes: duration }
          : { tipo: 'podologia', duration_minutes: 60 }
      )
      showToast(bookTipo === 'manicura' ? 'Manicura agendada 💅' : 'Cita agendada')
      setBookSlot(null)
      setBookPatient('')
      setBookSearch('')
      setBookNotes('')
      setBookTipo('podologia')
      setBookServiceId('')
      loadWeek(weekStart)
    } catch (err: any) {
      console.error(err)
      showToast(err?.code === '23505' ? 'Esa hora ya fue tomada' : 'Error agendando la cita', 'error')
    } finally {
      setSavingBook(false)
    }
  }

  const blockedMap = new Map(blockouts.map((b: any) => [String(b.blocked_date), b.notes]))

  // Construir cada día con su horario, almuerzo, citas y cupos libres
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const iso = toLocalIso(date)
    const blocked = blockedMap.has(iso)
    // Un día puede tener varios bloques de atención
    const bloques = bloquesDelDia(availability, date.getDay())

    // Todas las citas del día (para mostrar), y las ACTIVAS (para ocupar)
    const dayAppts = appointments
      .filter((a) => String(a.appointment_date).substring(0, 10) === iso)
      .filter((a) => filtro === 'todo' || a.tipo === filtro || (!a.tipo && filtro === 'podologia'))
    const activas = appointments.filter(
      (a) => String(a.appointment_date).substring(0, 10) === iso && a.status !== 'cancelled'
    )

    // Cada cita ocupa su duración + el tiempo de preparación posterior
    const busy = activas.map((a) => {
      const t = toMin(String(a.appointment_date).substring(11, 16))
      return { start: t, end: t + (a.duration_minutes || 60) + bufferDe(a.tipo, buffers) }
    })
    const info = { bloques, busy }

    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const isToday = iso === todayIso

    // Cupos libres + cuántos minutos seguidos hay disponibles desde cada uno
    const freeSlots: { time: string; gap: number }[] = []
    if (bloques.length > 0 && !blocked) {
      for (const bloque of bloques) {
        for (let t = bloque.start; t + PASO_MIN <= bloque.end; t += PASO_MIN) {
          const cellEnd = t + PASO_MIN
          if (busy.some((b) => overlaps(t, cellEnd, b.start, b.end))) continue
          if (isToday && t <= nowMin) continue

          // Espacio libre hasta la próxima cita o el fin de ESTE bloque
          let limite = bloque.end
          for (const b of busy) if (b.start >= t) limite = Math.min(limite, b.start)

          freeSlots.push({ time: toHHMM(t), gap: limite - t })
        }
      }
    }

    // Minutos libres del día (para KPI/alerta de capacidad)
    const freeMin = freeSlots.length * PASO_MIN

    return {
      name: DAY_NAMES[i],
      date,
      iso,
      isToday,
      blocked,
      blockNote: blockedMap.get(iso),
      bloques,
      info,
      dayAppts,
      activas,
      freeSlots,
      freeMin,
    }
  })

  // ===== KPIs =====
  const weekAppts = appointments.filter((a) => a.status !== 'cancelled')
  const podSemana = weekAppts.filter((a) => a.tipo !== 'manicura').length
  const maniSemana = weekAppts.filter((a) => a.tipo === 'manicura').length
  const todayFreeMin = days.find((d) => d.isToday)?.freeMin ?? null
  const completadas = appointments.filter((a) => a.status === 'completed').length

  const term = bookSearch.toLowerCase().trim()
  const filteredPatients = patients.filter(
    (p) =>
      !term ||
      p.name?.toLowerCase().includes(term) ||
      p.rut?.toLowerCase().includes(term) ||
      p.phone?.includes(term)
  )

  return (
    <div>
      {/* Header + filtro */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="font-display text-3xl text-tinta font-medium">
          Agenda <span className="italic">semanal</span>
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => changeWeek(-7)} className="px-4 py-1.5 bg-marfil border border-arena rounded-full hover:bg-arena/50 font-semibold text-tinta transition">← Anterior</button>
          <button onClick={() => setWeekStart(mondayOf(new Date()))} className="px-4 py-1.5 bg-tinta text-marfil rounded-full hover:bg-tinta-suave font-semibold transition">Hoy</button>
          <button onClick={() => changeWeek(7)} className="px-4 py-1.5 bg-marfil border border-arena rounded-full hover:bg-arena/50 font-semibold transition text-tinta">Siguiente →</button>
        </div>
      </div>

      {/* Filtro por tipo */}
      <div className="flex gap-1 bg-marfil rounded-full border border-arena shadow-sm p-1 w-fit mb-4">
        {([['todo', '✨ Todo'], ['podologia', '🦶 Podología'], ['manicura', '💅 Manicura']] as const).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                filtro === key
                  ? key === 'manicura'
                    ? 'bg-[#a37cc4] text-marfil'
                    : 'bg-tinta text-marfil'
                  : 'text-tinta-suave hover:bg-rosa-palo/40'
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">🦶 Podología (semana)</p>
          <p className="text-3xl font-bold text-tinta">{podSemana}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">💅 Manicura (semana)</p>
          <p className="text-3xl font-bold text-[#a37cc4]">{maniSemana}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">🕐 Libre hoy</p>
          <p className="text-3xl font-bold text-salvia">
            {todayFreeMin == null ? '—' : `${Math.floor(todayFreeMin / 60)}h${todayFreeMin % 60 ? ' ' + (todayFreeMin % 60) + 'm' : ''}`}
          </p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">✅ Completadas (semana)</p>
          <p className="text-3xl font-bold text-salvia">{completadas}</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-2">
        Semana del {fmtShort(days[0].date)} al {fmtShort(days[6].date)} · Los cupos punteados están
        libres: haz click para agendar (podología 1h o manicura según servicio)
      </p>

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Cargando agenda...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((day) => {
            const isPast = day.iso < todayIso
            const isDimmed = isPast || (day.bloques.length === 0 && !day.blocked)
            const pendientes = day.dayAppts.filter((a) => a.status === 'scheduled').length
            return (
              <div
                key={day.iso}
                className={`bg-marfil rounded-2xl border shadow-sm min-h-32 ${isDimmed ? 'opacity-50 grayscale' : ''} ${
                  day.blocked ? 'border-rosa/50' : day.isToday ? 'border-arena ring-2 ring-tinta' : 'border-arena'
                }`}
              >
                <div
                  className={`sticky top-16 z-10 px-3 py-2 border-b border-arena/60 text-center rounded-t-2xl shadow-sm ${
                    day.blocked
                      ? 'bg-rosa text-marfil'
                      : day.isToday
                      ? 'bg-tinta text-marfil'
                      : 'bg-arena text-tinta'
                  }`}
                >
                  <p className={`text-xs font-semibold uppercase ${isPast ? 'line-through' : ''}`}>{day.name}</p>
                  <p className={`text-sm font-bold ${isPast ? 'line-through' : ''}`}>{fmtShort(day.date)}</p>
                  {pendientes > 0 && !day.blocked && !isPast && (
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${day.isToday ? 'bg-marfil/25 text-marfil' : 'bg-tinta/10 text-tinta'}`}>
                      {pendientes} cita{pendientes > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="p-2 space-y-1.5">
                  {day.blocked && (
                    <div className="bg-rosa-palo/60 border border-rosa/40 rounded-lg p-2 text-xs">
                      <p className="font-bold text-rosa">🚫 Día bloqueado</p>
                      {day.blockNote && <p className="text-tinta">{day.blockNote}</p>}
                      {day.activas.length > 0 && (
                        <p className="text-rosa font-semibold mt-1">⚠️ {day.activas.length} cita(s) requieren reagendarse</p>
                      )}
                    </div>
                  )}

                  {day.bloques.length === 0 && !day.blocked ? (
                    <p className="text-xs text-gray-400 text-center py-3">{isPast ? 'Día pasado' : 'Sin atención'}</p>
                  ) : (
                    <>
                      {/* Línea de tiempo: citas ACTIVAS + cupos libres, en orden */}
                      {[
                        ...day.dayAppts
                          .filter((a) => a.status !== 'cancelled')
                          .map((a) => ({ min: toMin(String(a.appointment_date).substring(11, 16)), kind: 'appt' as const, apt: a })),
                        ...day.freeSlots.map((s) => ({
                          min: toMin(s.time),
                          kind: 'free' as const,
                          time: s.time,
                          gap: s.gap,
                        })),
                      ]
                        .sort((a, b) => a.min - b.min)
                        .map((row) => {
                          if (row.kind === 'free') {
                            const corto = row.gap < 60
                            return (
                              <button
                                key={`free-${row.time}`}
                                onClick={() => setBookSlot({ date: day.iso, time: row.time, info: day.info })}
                                className={`w-full border border-dashed rounded-lg p-1.5 text-xs transition text-left ${
                                  corto
                                    ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                                    : 'border-arena text-gray-400 hover:border-tinta-suave hover:text-tinta hover:bg-rosa-palo/20'
                                }`}
                                title={
                                  corto
                                    ? `Solo caben ${row.gap} min (no alcanza una podología de 1 h)`
                                    : 'Agendar en este cupo'
                                }
                              >
                                + {row.time} disponible
                                {corto && <span className="font-bold"> · solo {row.gap} min</span>}
                              </button>
                            )
                          }
                          const apt = row.apt
                          const t = String(apt.appointment_date).substring(11, 16)
                          const endT = toHHMM(toMin(t) + (apt.duration_minutes || 60))
                          const isMani = apt.tipo === 'manicura'
                          return (
                            <div
                              key={apt.id}
                              className={`border-l-4 rounded-xl p-2 text-xs shadow-sm hover:shadow-md transition ${
                                day.blocked
                                  ? 'bg-rosa-palo/40 border-rosa text-tinta'
                                  : isMani && apt.status === 'scheduled'
                                  ? 'bg-[#f4eefa] border-[#a37cc4] text-tinta'
                                  : STATUS_STYLE[apt.status] || STATUS_STYLE.scheduled
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-bold">🕐 {t}–{endT}</p>
                                <span>{isMani ? '💅' : ''}{apt.status === 'completed' ? ' ✅' : ''}</span>
                              </div>
                              {isMani && apt.nail_services?.nombre && (
                                <p className="text-[10px] font-bold text-[#7c5a99]">{apt.nail_services.nombre}</p>
                              )}
                              <Link href={`/admin/patients/${apt.patients?.id ?? ''}`} className="flex items-center gap-1.5 mt-1 hover:underline" title={apt.patients?.name}>
                                <span className={`w-5 h-5 rounded-full ${colorFor(apt.patients?.name)} text-marfil flex items-center justify-center text-[8px] font-bold shrink-0`}>{initials(apt.patients?.name)}</span>
                                <span className="font-semibold truncate">{apt.patients?.name || 'Paciente'}</span>
                              </Link>
                              {day.blocked && apt.status === 'scheduled' && (
                                <Link href={`/admin/patients/${apt.patients?.id ?? ''}`} className="block mt-1 text-center bg-rosa text-marfil rounded px-1 py-0.5 font-bold hover:opacity-90">🔄 Reagendar</Link>
                              )}
                              {!day.blocked && apt.status === 'scheduled' && (
                                <div className="flex gap-1 mt-2">
                                  <button onClick={() => setStatus(apt.id, 'completed')} className="flex-1 bg-salvia text-marfil rounded-full px-1 py-0.5 font-bold hover:opacity-90 transition" title="Completada">✓</button>
                                  <button onClick={() => setCancelTarget(apt)} className="flex-1 bg-rosa text-marfil rounded-full px-1 py-0.5 font-bold hover:opacity-90 transition" title="Cancelar">✕</button>
                                </div>
                              )}
                            </div>
                          )
                        })}

                      {day.bloques.length > 0 && day.freeSlots.length === 0 && day.dayAppts.filter((a) => a.status !== 'cancelled').length === 0 && !day.blocked && (
                        <p className="text-xs text-gray-400 text-center py-3">{isPast ? 'Día pasado' : day.isToday ? 'Sin más cupos hoy' : 'Sin cupos'}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal cancelar */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-sm w-full p-8 text-center animate-fade-up">
            <div className="w-16 h-16 mx-auto rounded-full bg-rosa-palo flex items-center justify-center text-3xl">🕐</div>
            <h2 className="font-display text-2xl text-tinta font-medium mt-4">¿Cancelar la cita de <span className="italic">{cancelTarget.patients?.name}</span>?</h2>
            <p className="mt-3 text-sm text-foreground/75">
              {new Date(cancelTarget.appointment_date).toLocaleDateString('es-CL')} a las {String(cancelTarget.appointment_date).substring(11, 16)} hrs — la hora quedará liberada para otro paciente.
            </p>
            <button onClick={() => { setStatus(cancelTarget.id, 'cancelled'); setCancelTarget(null) }} className="mt-6 w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition">Sí, cancelar cita</button>
            <button onClick={() => setCancelTarget(null)} className="mt-3 w-full py-3 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition">Volver</button>
          </div>
        </div>
      )}

      {/* Modal agendar */}
      {bookSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-md w-full p-7 animate-fade-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl text-tinta font-medium">
              Agendar el <span className="italic">{new Date(bookSlot.date + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</span> a las {bookSlot.time}
            </h2>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setBookTipo('podologia')} className={`flex-1 py-2 rounded-full text-sm font-bold border transition ${bookTipo === 'podologia' ? 'bg-tinta text-marfil border-tinta' : 'bg-white text-tinta-suave border-arena hover:border-tinta-suave'}`}>🦶 Podología (1h)</button>
              <button onClick={() => setBookTipo('manicura')} className={`flex-1 py-2 rounded-full text-sm font-bold border transition ${bookTipo === 'manicura' ? 'bg-[#a37cc4] text-marfil border-[#a37cc4]' : 'bg-white text-tinta-suave border-arena hover:border-[#a37cc4]'}`}>💅 Manicura</button>
            </div>

            {bookTipo === 'manicura' && (
              <select value={bookServiceId} onChange={(e) => setBookServiceId(e.target.value)} className="w-full mt-3 px-4 py-2 border border-[#a37cc4]/40 rounded-xl bg-[#f4eefa] text-sm font-semibold text-tinta focus:outline-none focus:ring-2 focus:ring-[#a37cc4]">
                <option value="">— Elige el servicio —</option>
                {nailServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre} — ${Number(s.valor).toLocaleString('es-CL')} ({s.duracion_minutes} min)</option>
                ))}
              </select>
            )}

            <input type="text" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} placeholder="🔍 Buscar paciente por nombre, RUT o teléfono..." className="w-full mt-4 px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave" />

            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {filteredPatients.length === 0 ? (
                <p className="text-sm text-gray-400 p-3">No se encontró el paciente. Créalo primero en 👥 Pacientes.</p>
              ) : (
                filteredPatients.map((p) => (
                  <button key={p.id} onClick={() => setBookPatient(p.id)} className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition ${bookPatient === p.id ? 'bg-tinta text-marfil border-tinta' : 'bg-white border-arena hover:border-tinta-suave'}`}>
                    <span className="font-semibold">{p.name}</span>
                    <span className={bookPatient === p.id ? 'text-marfil/70' : 'text-gray-400'}> · {p.rut || 'sin RUT'}</span>
                  </button>
                ))
              )}
            </div>

            <input type="text" value={bookNotes} onChange={(e) => setBookNotes(e.target.value)} placeholder="Notas (opcional)" className="w-full mt-3 px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave" />

            <button onClick={confirmBook} disabled={savingBook || !bookPatient} className="mt-4 w-full bg-tinta text-marfil py-3 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50">{savingBook ? 'Agendando...' : '✔ Confirmar cita'}</button>
            <button onClick={() => { setBookSlot(null); setBookPatient(''); setBookSearch(''); setBookTipo('podologia'); setBookServiceId('') }} className="mt-2 w-full py-2.5 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
