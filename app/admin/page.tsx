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
} from '@/lib/supabase'
import { getAvailableSlots, todayLocalStr } from '@/lib/slots'
import { showToast } from '@/components/toast'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function mondayOf(d: Date): Date {
  const monday = new Date(d)
  const day = monday.getDay()
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day))
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

// Horas teóricas de un día según su configuración de horario
function genSlotTimes(config: any): string[] {
  if (!config) return []
  const [sh, sm] = String(config.start_time).split(':').map(Number)
  const [eh, em] = String(config.end_time).split(':').map(Number)
  const step = config.slot_duration_minutes || 30
  const out: string[] = []
  for (let mins = sh * 60 + sm; mins + step <= eh * 60 + em; mins += step) {
    out.push(
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    )
  }
  return out
}

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-blue-50 border-blue-400 text-blue-900',
  completed: 'bg-green-50 border-green-400 text-green-900',
  cancelled: 'bg-red-50 border-red-300 text-red-400 line-through',
}

export default function AdminAgendaPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [appointments, setAppointments] = useState<any[]>([])
  const [blockouts, setBlockouts] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [freeToday, setFreeToday] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal de agendar desde un cupo libre
  const [bookSlot, setBookSlot] = useState<{ date: string; time: string } | null>(null)
  const [bookPatient, setBookPatient] = useState('')
  const [bookSearch, setBookSearch] = useState('')
  const [bookNotes, setBookNotes] = useState('')
  const [savingBook, setSavingBook] = useState(false)

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

  // KPI: horas libres HOY + lista de pacientes (para agendar desde cupos)
  useEffect(() => {
    getAvailableSlots(todayLocalStr())
      .then((r) => setFreeToday(r.slots.length))
      .catch(() => setFreeToday(null))
    getPatients()
      .then((p) => setPatients(p || []))
      .catch(() => {})
  }, [])

  const changeWeek = (deltaDays: number) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + deltaDays)
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
    setSavingBook(true)
    try {
      await adminCreateAppointment(
        bookPatient,
        `${bookSlot.date}T${bookSlot.time}:00`,
        bookNotes || 'Agendada por administración'
      )
      showToast('Cita agendada')
      setBookSlot(null)
      setBookPatient('')
      setBookSearch('')
      setBookNotes('')
      loadWeek(weekStart)
    } catch (err: any) {
      console.error(err)
      showToast(
        err?.code === '23505' ? 'Esa hora ya fue tomada' : 'Error agendando la cita',
        'error'
      )
    } finally {
      setSavingBook(false)
    }
  }

  const blockedMap = new Map(blockouts.map((b: any) => [String(b.blocked_date), b.notes]))
  const now = new Date()

  // Días de la semana con sus entradas (citas + cupos libres)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const iso = toLocalIso(date)
    const dayAppts = appointments.filter(
      (a) => String(a.appointment_date).substring(0, 10) === iso
    )
    const config = availability.find((a: any) => a.day_of_week === date.getDay())
    const slotTimes = genSlotTimes(config)
    const apptTimes = new Set(dayAppts.map((a) => String(a.appointment_date).substring(11, 16)))
    const blocked = blockedMap.has(iso)

    // Entradas: unión de cupos teóricos + citas fuera de horario, ordenadas
    const allTimes = Array.from(
      new Set([...slotTimes, ...dayAppts.map((a) => String(a.appointment_date).substring(11, 16))])
    ).sort()

    const entries = allTimes.map((time) => ({
      time,
      apt: dayAppts.find((a) => String(a.appointment_date).substring(11, 16) === time) ?? null,
      isFree:
        !apptTimes.has(time) &&
        !blocked &&
        slotTimes.includes(time) &&
        (iso > todayIso || (iso === todayIso && new Date(`${iso}T${time}:00`) > now)),
    }))

    return {
      name: DAY_NAMES[i],
      date,
      iso,
      isToday: iso === todayIso,
      blocked,
      blockNote: blockedMap.get(iso),
      entries,
      appointments: dayAppts,
    }
  })

  const todayCount = appointments.filter(
    (a) => String(a.appointment_date).substring(0, 10) === todayIso && a.status === 'scheduled'
  ).length
  const weekCount = appointments.filter((a) => a.status !== 'cancelled').length
  const completedCount = appointments.filter((a) => a.status === 'completed').length

  // Filtro de pacientes en el modal
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl text-tinta font-medium">
          Agenda <span className="italic">semanal</span>
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeWeek(-7)}
            className="px-4 py-1.5 bg-marfil border border-arena rounded-full hover:bg-arena/50 font-semibold text-tinta transition"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setWeekStart(mondayOf(new Date()))}
            className="px-4 py-1.5 bg-tinta text-marfil rounded-full hover:bg-tinta-suave font-semibold transition"
          >
            Hoy
          </button>
          <button
            onClick={() => changeWeek(7)}
            className="px-4 py-1.5 bg-marfil border border-arena rounded-full hover:bg-arena/50 font-semibold transition text-tinta"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">Citas pendientes hoy</p>
          <p className="text-3xl font-bold text-tinta">{todayCount}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">🕐 Horas libres hoy</p>
          <p className="text-3xl font-bold text-salvia">{freeToday ?? '—'}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">Citas esta semana</p>
          <p className="text-3xl font-bold text-rosa">{weekCount}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">Completadas esta semana</p>
          <p className="text-3xl font-bold text-salvia">{completedCount}</p>
        </div>
      </div>

      {/* Calendario semanal */}
      <p className="text-sm text-gray-500 mb-2">
        Semana del {fmtShort(days[0].date)} al {fmtShort(days[6].date)} · Los cupos punteados
        están libres: haz click para agendar
      </p>

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Cargando agenda...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((day) => (
            <div
              key={day.iso}
              className={`bg-marfil rounded-2xl border shadow-sm min-h-32 ${
                day.blocked
                  ? 'border-rosa/50'
                  : day.isToday
                  ? 'border-arena ring-2 ring-tinta'
                  : 'border-arena'
              }`}
            >
              <div
                className={`px-3 py-2 border-b text-center rounded-t-2xl ${
                  day.blocked
                    ? 'bg-rosa/80 text-marfil'
                    : day.isToday
                    ? 'bg-tinta text-marfil'
                    : 'bg-arena/50 text-tinta'
                }`}
              >
                <p className="text-xs font-semibold uppercase">{day.name}</p>
                <p className="text-sm font-bold">{fmtShort(day.date)}</p>
              </div>

              <div className="p-2 space-y-1.5">
                {/* Alerta de día bloqueado */}
                {day.blocked && (
                  <div className="bg-rosa-palo/60 border border-rosa/40 rounded-lg p-2 text-xs">
                    <p className="font-bold text-rosa">🚫 Día bloqueado</p>
                    {day.blockNote && <p className="text-tinta">{day.blockNote}</p>}
                    {day.appointments.filter((a) => a.status === 'scheduled').length > 0 && (
                      <p className="text-rosa font-semibold mt-1">
                        ⚠️ {day.appointments.filter((a) => a.status === 'scheduled').length} cita(s)
                        requieren reagendarse
                      </p>
                    )}
                  </div>
                )}

                {day.entries.length === 0 && !day.blocked ? (
                  <p className="text-xs text-gray-400 text-center py-3">Sin atención</p>
                ) : (
                  day.entries.map(({ time, apt, isFree }) =>
                    apt ? (
                      <div
                        key={time}
                        className={`border-l-4 rounded p-2 text-xs ${
                          day.blocked && apt.status === 'scheduled'
                            ? 'bg-rosa-palo/40 border-rosa text-tinta'
                            : STATUS_STYLE[apt.status] || STATUS_STYLE.scheduled
                        }`}
                      >
                        <p className="font-bold">🕐 {time}</p>
                        <Link
                          href={`/admin/patients/${apt.patients?.id ?? ''}`}
                          className="font-semibold hover:underline block truncate"
                          title={apt.patients?.name}
                        >
                          {apt.patients?.name || 'Paciente'}
                        </Link>
                        {apt.patients?.phone && (
                          <p className="text-gray-500">{apt.patients.phone}</p>
                        )}
                        {day.blocked && apt.status === 'scheduled' && (
                          <Link
                            href={`/admin/patients/${apt.patients?.id ?? ''}`}
                            className="block mt-1 text-center bg-rosa text-marfil rounded px-1 py-0.5 font-bold hover:opacity-90"
                          >
                            🔄 Reagendar
                          </Link>
                        )}
                        {!day.blocked && apt.status === 'scheduled' && (
                          <div className="flex gap-1 mt-2">
                            <button
                              onClick={() => setStatus(apt.id, 'completed')}
                              className="flex-1 bg-green-600 text-white rounded px-1 py-0.5 hover:bg-green-700"
                              title="Marcar como completada"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('¿Cancelar esta cita?')) setStatus(apt.id, 'cancelled')
                              }}
                              className="flex-1 bg-red-500 text-white rounded px-1 py-0.5 hover:bg-red-600"
                              title="Cancelar cita"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ) : isFree ? (
                      <button
                        key={time}
                        onClick={() => setBookSlot({ date: day.iso, time })}
                        className="w-full border border-dashed border-arena rounded p-1.5 text-xs text-gray-400 hover:border-tinta-suave hover:text-tinta hover:bg-rosa-palo/20 transition text-left"
                        title="Agendar en este cupo"
                      >
                        + {time} disponible
                      </button>
                    ) : null
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Modal: agendar desde un cupo libre ===== */}
      {bookSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-md w-full p-7 animate-fade-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl text-tinta font-medium">
              Agendar el{' '}
              <span className="italic">
                {new Date(bookSlot.date + 'T00:00:00').toLocaleDateString('es-CL', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>{' '}
              a las {bookSlot.time}
            </h2>

            <input
              type="text"
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
              placeholder="🔍 Buscar paciente por nombre, RUT o teléfono..."
              className="w-full mt-4 px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
            />

            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {filteredPatients.length === 0 ? (
                <p className="text-sm text-gray-400 p-3">
                  No se encontró el paciente. Créalo primero en 👥 Pacientes.
                </p>
              ) : (
                filteredPatients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setBookPatient(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition ${
                      bookPatient === p.id
                        ? 'bg-tinta text-marfil border-tinta'
                        : 'bg-white border-arena hover:border-tinta-suave'
                    }`}
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className={bookPatient === p.id ? 'text-marfil/70' : 'text-gray-400'}>
                      {' '}
                      · {p.rut || 'sin RUT'}
                    </span>
                  </button>
                ))
              )}
            </div>

            <input
              type="text"
              value={bookNotes}
              onChange={(e) => setBookNotes(e.target.value)}
              placeholder="Notas (opcional)"
              className="w-full mt-3 px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
            />

            <button
              onClick={confirmBook}
              disabled={savingBook || !bookPatient}
              className="mt-4 w-full bg-tinta text-marfil py-3 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
            >
              {savingBook ? 'Agendando...' : '✔ Confirmar cita'}
            </button>
            <button
              onClick={() => {
                setBookSlot(null)
                setBookPatient('')
                setBookSearch('')
              }}
              className="mt-2 w-full py-2.5 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
