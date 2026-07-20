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
  createPatientAdmin,
  getConvenios,
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

const normRut = (s: any) => String(s ?? '').replace(/[^0-9kK]/g, '').toUpperCase()

const PACIENTE_VACIO = { name: '', rut: '', phone: '', email: '', insurance: '' }

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
const dur = (m: number) => {
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

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

  // Modal de agendar: se abre sobre un RANGO libre y dentro se elige la hora
  const [bookSlot, setBookSlot] = useState<{
    date: string
    rangeStart: number
    rangeEnd: number
    info: any
  } | null>(null)
  const [bookTime, setBookTime] = useState('')
  const [bookPatient, setBookPatient] = useState('')
  const [bookSearch, setBookSearch] = useState('')
  const [bookNotes, setBookNotes] = useState('')
  const [bookTipo, setBookTipo] = useState<'podologia' | 'manicura'>('podologia')
  const [bookServiceId, setBookServiceId] = useState('')
  const [savingBook, setSavingBook] = useState(false)
  // Alta rápida de paciente sin salir de la agenda
  const [convenios, setConvenios] = useState<any[]>([])
  const [showNuevoPaciente, setShowNuevoPaciente] = useState(false)
  const [nuevoPaciente, setNuevoPaciente] = useState({ ...PACIENTE_VACIO })
  const [creandoPaciente, setCreandoPaciente] = useState(false)
  // El admin confirma agendar sin tiempo de preparación
  const [aceptaAjustado, setAceptaAjustado] = useState(false)
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
    getConvenios().then((c) => setConvenios(c || [])).catch(() => {})
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

  // Duración y preparación del servicio elegido en el modal
  const servicioSel = nailServices.find((s) => s.id === bookServiceId)
  const duracionSel = bookTipo === 'manicura' ? servicioSel?.duracion_minutes ?? 60 : 60
  const prepSel = bookTipo === 'manicura' ? buffers.manicura : buffers.podologia

  // Horas válidas para el servicio elegido EN TODO EL DÍA.
  // Así, si el servicio no cabe en el tramo donde hiciste click, igual se
  // ofrecen los demás horarios libres de la jornada.
  // estado 'ok' = cabe con preparación · 'ajustado' = la atención cabe pero
  // queda sin tiempo de preparación (solo el admin puede forzarlo)
  const horasDia: { min: number; hhmm: string; enTramo: boolean; estado: 'ok' | 'ajustado' }[] = []
  if (bookSlot) {
    const ahora = new Date()
    const nowMin = ahora.getHours() * 60 + ahora.getMinutes()
    const esHoy = bookSlot.date === todayIso
    for (const b of bookSlot.info.bloques) {
      for (let t = b.start; t + duracionSel <= b.end; t += PASO_MIN) {
        if (esHoy && t <= nowMin) continue
        const fin = t + duracionSel
        // La atención en sí NO puede pisar otra cita
        if (bookSlot.info.busyRaw.some((x: any) => overlaps(t, fin, x.start, x.end))) continue
        const chocaPrep = bookSlot.info.busy.some((x: any) =>
          overlaps(t, fin + prepSel, x.start, x.end)
        )
        horasDia.push({
          min: t,
          hhmm: toHHMM(t),
          enTramo: t >= bookSlot.rangeStart && fin <= bookSlot.rangeEnd,
          estado: chocaPrep ? 'ajustado' : 'ok',
        })
      }
    }
    horasDia.sort((a, b) => a.min - b.min)
  }
  const horasPosibles = horasDia.map((h) => h.hhmm)
  const cabeEnTramo = horasDia.some((h) => h.enTramo && h.estado === 'ok')
  const horaSel = horasDia.find((h) => h.hhmm === bookTime)
  const esAjustado = horaSel?.estado === 'ajustado'

  // Al cambiar el servicio, elegir la mejor hora disponible (prefiere las 'ok')
  useEffect(() => {
    if (!bookSlot) return
    setAceptaAjustado(false)
    if (horasDia.length === 0) {
      setBookTime('')
    } else if (!horasPosibles.includes(bookTime)) {
      const mejor =
        horasDia.find((h) => h.enTramo && h.estado === 'ok') ??
        horasDia.find((h) => h.estado === 'ok') ??
        horasDia.find((h) => h.enTramo) ??
        horasDia[0]
      setBookTime(mejor.hhmm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSlot, duracionSel])

  const cerrarModal = () => {
    setBookSlot(null)
    setBookTime('')
    setBookPatient('')
    setBookSearch('')
    setBookNotes('')
    setBookTipo('podologia')
    setBookServiceId('')
    setShowNuevoPaciente(false)
    setNuevoPaciente({ ...PACIENTE_VACIO })
  }

  // Abre el formulario de alta rápida aprovechando lo ya escrito en el
  // buscador: si son dígitos va al RUT, si no al nombre
  const abrirNuevoPaciente = () => {
    const t = bookSearch.trim()
    const soloDigitos = /^[0-9kK.\-\s]+$/.test(t)
    setNuevoPaciente({
      ...PACIENTE_VACIO,
      name: t && !soloDigitos ? t : '',
      rut: t && soloDigitos ? t : '',
    })
    setShowNuevoPaciente(true)
  }

  // Crea el paciente y lo deja seleccionado, sin salir de la agenda
  const crearPacienteRapido = async () => {
    const nombre = nuevoPaciente.name.trim()
    const rut = nuevoPaciente.rut.trim()
    if (!nombre || !rut) {
      showToast('Nombre y RUT son obligatorios', 'error')
      return
    }
    const yaExiste = patients.find((p) => p.rut && normRut(p.rut) === normRut(rut))
    if (yaExiste) {
      // No se crea un duplicado: se selecciona el que ya estaba
      setBookPatient(yaExiste.id)
      setShowNuevoPaciente(false)
      setBookSearch(yaExiste.name)
      showToast(`Ese RUT ya es de ${yaExiste.name}. Lo dejé seleccionado.`, 'error')
      return
    }

    setCreandoPaciente(true)
    try {
      // El correo es obligatorio en la base. Si no lo tiene a mano, se
      // genera uno interno a partir del RUT (se corrige luego en su ficha)
      const email =
        nuevoPaciente.email.trim().toLowerCase() || `${normRut(rut).toLowerCase()}@sincorreo.local`

      const creado = await createPatientAdmin({
        name: nombre,
        rut,
        phone: nuevoPaciente.phone.trim() || null,
        email,
        insurance: nuevoPaciente.insurance || null,
      })

      setPatients((prev) => [...prev, creado])
      setBookPatient(creado.id)
      setBookSearch(nombre)
      setShowNuevoPaciente(false)
      setNuevoPaciente({ ...PACIENTE_VACIO })
      showToast(`${nombre} creado y seleccionado`)
    } catch (err: any) {
      console.error(err)
      showToast(
        err?.code === '23505'
          ? 'Ya existe un paciente con ese RUT o correo'
          : 'Error creando el paciente',
        'error'
      )
    } finally {
      setCreandoPaciente(false)
    }
  }

  const confirmBook = async () => {
    if (!bookSlot || !bookPatient) {
      showToast('Selecciona el paciente', 'error')
      return
    }
    if (bookTipo === 'manicura' && !bookServiceId) {
      showToast('Selecciona el servicio de manicura', 'error')
      return
    }
    if (!bookTime) {
      showToast('Selecciona la hora de inicio', 'error')
      return
    }

    const info = bookSlot.info
    const startMin = toMin(bookTime)
    const endMin = startMin + duracionSel
    const endConPrep = endMin + prepSel

    if (!info.bloques.some((b: any) => startMin >= b.start && endMin <= b.end)) {
      showToast(
        `El servicio de ${dur(duracionSel)} no cabe en el bloque (terminaría ${toHHMM(endMin)})`,
        'error'
      )
      return
    }
    // La atención nunca puede pisar otra cita
    if (info.busyRaw.some((b: any) => overlaps(startMin, endMin, b.start, b.end))) {
      showToast(`Ese horario choca con otra cita (terminaría ${toHHMM(endMin)})`, 'error')
      return
    }
    // Si solo choca la preparación, el admin debe confirmarlo
    const chocaPrep = info.busy.some((b: any) => overlaps(startMin, endConPrep, b.start, b.end))
    if (chocaPrep && !aceptaAjustado) {
      showToast('Marca la casilla para agendar sin tiempo de preparación', 'error')
      return
    }

    setSavingBook(true)
    try {
      const nuevoId = await adminCreateAppointment(
        bookPatient,
        `${bookSlot.date}T${bookTime}:00`,
        bookNotes || 'Agendada por administración',
        bookTipo === 'manicura'
          ? {
              tipo: 'manicura',
              nail_service_id: bookServiceId,
              valor: servicioSel?.valor ?? null,
              duration_minutes: duracionSel,
            }
          : { tipo: 'podologia', duration_minutes: 60 }
      )

      // Correo de confirmación al paciente (no en sobrecupos: son casos
      // acordados aparte, y no se envía el aviso interno a la clínica)
      if (nuevoId && !chocaPrep) {
        fetch('/api/notify-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: nuevoId,
            date: bookSlot.date,
            time: bookTime,
            soloPaciente: true,
          }),
        }).catch(() => {})
      }

      showToast(bookTipo === 'manicura' ? 'Manicura agendada 💅' : 'Cita agendada')
      cerrarModal()
      loadWeek(weekStart)
    } catch (err: any) {
      console.error(err)
      showToast(err?.code === '23505' ? 'Esa hora ya fue tomada' : 'Error agendando la cita', 'error')
    } finally {
      setSavingBook(false)
    }
  }

  const blockedMap = new Map(blockouts.map((b: any) => [String(b.blocked_date), b.notes]))

  // ===== Construcción de cada día =====
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const iso = toLocalIso(date)
    const blocked = blockedMap.has(iso)
    const bloques = bloquesDelDia(availability, date.getDay())

    const dayAppts = appointments
      .filter((a) => String(a.appointment_date).substring(0, 10) === iso)
      .filter((a) => filtro === 'todo' || a.tipo === filtro || (!a.tipo && filtro === 'podologia'))
    const activas = appointments.filter(
      (a) => String(a.appointment_date).substring(0, 10) === iso && a.status !== 'cancelled'
    )

    // Cada cita ocupa su duración + preparación posterior
    const busy = activas
      .map((a) => {
        const t = toMin(String(a.appointment_date).substring(11, 16))
        return { start: t, end: t + (a.duration_minutes || 60) + bufferDe(a.tipo, buffers) }
      })
      .sort((a, b) => a.start - b.start)

    // Ocupación REAL (sin preparación): permite al admin apretar una cita
    const busyRaw = activas
      .map((a) => {
        const t = toMin(String(a.appointment_date).substring(11, 16))
        return { start: t, end: t + (a.duration_minutes || 60) }
      })
      .sort((a, b) => a.start - b.start)

    const info = { bloques, busy, busyRaw }

    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const isToday = iso === todayIso

    // RANGOS libres continuos dentro de cada bloque (en vez de mil casillas)
    const freeRanges: { start: number; end: number }[] = []
    if (bloques.length > 0 && !blocked) {
      for (const bloque of bloques) {
        let cursor = bloque.start
        if (isToday) cursor = Math.max(cursor, Math.ceil(nowMin / PASO_MIN) * PASO_MIN)
        for (const b of busy) {
          if (b.end <= cursor) continue
          if (b.start >= bloque.end) break
          if (b.start > cursor) {
            const fin = Math.min(b.start, bloque.end)
            if (fin - cursor >= PASO_MIN) freeRanges.push({ start: cursor, end: fin })
          }
          cursor = Math.max(cursor, b.end)
        }
        if (bloque.end - cursor >= PASO_MIN) freeRanges.push({ start: cursor, end: bloque.end })
      }
    }

    const freeMin = freeRanges.reduce((s, r) => s + (r.end - r.start), 0)

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
      freeRanges,
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
      {/* Header */}
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
            {todayFreeMin == null ? '—' : dur(todayFreeMin)}
          </p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">✅ Completadas (semana)</p>
          <p className="text-3xl font-bold text-salvia">{completadas}</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-2">
        Semana del {fmtShort(days[0].date)} al {fmtShort(days[6].date)} · Los tramos verdes están
        libres: haz click para agendar dentro de ese rango
      </p>

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Cargando agenda...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((day) => {
            const isPast = day.iso < todayIso
            const isDimmed = isPast || (day.bloques.length === 0 && !day.blocked)
            const pendientes = day.dayAppts.filter((a) => a.status === 'scheduled').length

            // Línea de tiempo: citas activas + rangos libres, en orden
            const filas = [
              ...day.dayAppts
                .filter((a) => a.status !== 'cancelled')
                .map((a) => ({
                  min: toMin(String(a.appointment_date).substring(11, 16)),
                  kind: 'appt' as const,
                  apt: a,
                })),
              ...day.freeRanges.map((r) => ({ min: r.start, kind: 'free' as const, range: r })),
            ].sort((a, b) => a.min - b.min)

            return (
              <div
                key={day.iso}
                className={`bg-marfil rounded-2xl border shadow-sm min-h-32 ${isDimmed ? 'opacity-50 grayscale' : ''} ${
                  day.blocked ? 'border-rosa/50' : day.isToday ? 'border-arena ring-2 ring-tinta' : 'border-arena'
                }`}
              >
                <div
                  className={`sticky top-16 z-10 px-3 py-2 border-b border-arena/60 text-center rounded-t-2xl shadow-sm ${
                    day.blocked ? 'bg-rosa text-marfil' : day.isToday ? 'bg-tinta text-marfil' : 'bg-arena text-tinta'
                  }`}
                >
                  <p className={`text-xs font-semibold uppercase ${isPast ? 'line-through' : ''}`}>{day.name}</p>
                  <p className={`text-sm font-bold ${isPast ? 'line-through' : ''}`}>{fmtShort(day.date)}</p>
                  {day.bloques.length > 0 && !day.blocked && (
                    <p className="text-[10px] opacity-80 mt-0.5">
                      {day.bloques.map((b) => `${toHHMM(b.start)}–${toHHMM(b.end)}`).join(' · ')}
                    </p>
                  )}
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
                      {filas.map((row) => {
                        if (row.kind === 'free') {
                          const largo = row.range.end - row.range.start
                          return (
                            <button
                              key={`free-${row.range.start}`}
                              onClick={() =>
                                setBookSlot({
                                  date: day.iso,
                                  rangeStart: row.range.start,
                                  rangeEnd: row.range.end,
                                  info: day.info,
                                })
                              }
                              className="w-full border border-dashed border-salvia/50 bg-salvia/5 rounded-lg px-2 py-2 text-xs text-left hover:bg-salvia/15 hover:border-salvia transition"
                              title="Agendar dentro de este tramo"
                            >
                              <span className="block font-bold text-salvia">
                                {toHHMM(row.range.start)} – {toHHMM(row.range.end)}
                              </span>
                              <span className="block text-gray-500">{dur(largo)} libre · + agendar</span>
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

                      {filas.length === 0 && !day.blocked && (
                        <p className="text-xs text-gray-400 text-center py-3">
                          {isPast ? 'Día pasado' : day.isToday ? 'Sin más cupos hoy' : 'Día completo'}
                        </p>
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
              {new Date(cancelTarget.appointment_date).toLocaleDateString('es-CL')} a las {String(cancelTarget.appointment_date).substring(11, 16)} hrs — la hora quedará liberada.
            </p>
            <button onClick={() => { setStatus(cancelTarget.id, 'cancelled'); setCancelTarget(null) }} className="mt-6 w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition">Sí, cancelar cita</button>
            <button onClick={() => setCancelTarget(null)} className="mt-3 w-full py-3 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition">Volver</button>
          </div>
        </div>
      )}

      {/* Modal agendar dentro del tramo libre */}
      {bookSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-2xl w-full p-7 animate-fade-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl text-tinta font-medium">
              Agendar el{' '}
              <span className="italic">
                {new Date(bookSlot.date + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </h2>
            <p className="text-sm text-gray-500">
              Tramo libre: <strong className="text-salvia">{toHHMM(bookSlot.rangeStart)} – {toHHMM(bookSlot.rangeEnd)}</strong>
            </p>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setBookTipo('podologia')} className={`flex-1 py-2 rounded-full text-sm font-bold border transition ${bookTipo === 'podologia' ? 'bg-tinta text-marfil border-tinta' : 'bg-white text-tinta-suave border-arena hover:border-tinta-suave'}`}>🦶 Podología (1h)</button>
              <button onClick={() => setBookTipo('manicura')} className={`flex-1 py-2 rounded-full text-sm font-bold border transition ${bookTipo === 'manicura' ? 'bg-[#a37cc4] text-marfil border-[#a37cc4]' : 'bg-white text-tinta-suave border-arena hover:border-[#a37cc4]'}`}>💅 Manicura</button>
            </div>

            {bookTipo === 'manicura' && (
              <select value={bookServiceId} onChange={(e) => setBookServiceId(e.target.value)} className="w-full mt-3 px-4 py-2 border border-[#a37cc4]/40 rounded-xl bg-[#f4eefa] text-sm font-semibold text-tinta focus:outline-none focus:ring-2 focus:ring-[#a37cc4]">
                <option value="">— Elige el servicio —</option>
                {nailServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} — ${Number(s.valor).toLocaleString('es-CL')} ({dur(s.duracion_minutes)})
                  </option>
                ))}
              </select>
            )}

            {/* Hora de inicio: todas las del día donde cabe el servicio */}
            <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave mt-4 mb-2">
              Hora de inicio ({dur(duracionSel)} + {prepSel} min de preparación)
            </p>
            {horasDia.length === 0 ? (
              <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-xl">
                No queda ningún espacio de {dur(duracionSel)} este día. Elige otro servicio u otro
                día.
              </p>
            ) : (
              <>
                {!cabeEnTramo && (
                  <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-2">
                    En el tramo {toHHMM(bookSlot.rangeStart)}–{toHHMM(bookSlot.rangeEnd)} no caben{' '}
                    {dur(duracionSel)}, pero sí en estos horarios del día 👇
                  </p>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto">
                  {horasDia.map((h) => (
                    <button
                      key={h.hhmm}
                      onClick={() => {
                        setBookTime(h.hhmm)
                        setAceptaAjustado(false)
                      }}
                      title={
                        h.estado === 'ajustado'
                          ? 'Cabe justo, sin tiempo de preparación'
                          : h.enTramo
                          ? 'Dentro del tramo que elegiste'
                          : 'Otro horario libre del día'
                      }
                      className={`px-2 py-1.5 rounded-lg text-sm font-semibold border transition ${
                        bookTime === h.hhmm
                          ? 'bg-tinta text-marfil border-tinta'
                          : h.estado === 'ajustado'
                          ? 'bg-yellow-50 text-yellow-800 border-yellow-300 hover:border-yellow-500'
                          : h.enTramo
                          ? 'bg-salvia/10 text-tinta border-salvia/50 hover:border-salvia'
                          : 'bg-white text-foreground border-arena hover:border-tinta-suave'
                      }`}
                    >
                      {h.hhmm}
                      {h.estado === 'ajustado' && <span className="block text-[9px] leading-none">justo</span>}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {bookTime && `Terminaría a las ${toHHMM(toMin(bookTime) + duracionSel)}. `}
                  🟢 dentro del tramo · 🟡 cabe justo, sin preparación
                </p>

                {/* Confirmación para agendar sin tiempo de preparación */}
                {esAjustado && (
                  <label className="mt-3 flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aceptaAjustado}
                      onChange={(e) => setAceptaAjustado(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-[#d9a441]"
                    />
                    <span className="text-xs text-yellow-900">
                      <strong>Agendar sin tiempo de preparación.</strong> A las {bookTime} la
                      atención cabe justo hasta{' '}
                      {toHHMM(toMin(bookTime) + duracionSel)}, pero quedarás sin los {prepSel} min
                      para limpiar antes de la siguiente cita. Confirmo que quiero agendarla igual.
                    </span>
                  </label>
                )}
              </>
            )}

            <input type="text" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} placeholder="🔍 Buscar paciente por nombre, RUT o teléfono..." className="w-full mt-4 px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave" />

            {!showNuevoPaciente && (
              <>
                <div className="mt-2 max-h-52 overflow-y-auto space-y-1">
                  {filteredPatients.length === 0 ? (
                    <div className="text-center py-4 px-3 bg-arena/30 rounded-xl border border-dashed border-arena">
                      <p className="text-sm text-gray-500">
                        {bookSearch.trim()
                          ? 'Ningún paciente coincide con esa búsqueda.'
                          : 'Aún no hay pacientes registrados.'}
                      </p>
                      <button
                        onClick={abrirNuevoPaciente}
                        className="mt-2 bg-salvia text-marfil px-5 py-2 rounded-full text-sm font-bold hover:opacity-90 transition"
                      >
                        ➕ Crear paciente nuevo
                      </button>
                    </div>
                  ) : (
                    filteredPatients.map((p) => (
                      <button key={p.id} onClick={() => setBookPatient(p.id)} className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition ${bookPatient === p.id ? 'bg-tinta text-marfil border-tinta' : 'bg-white border-arena hover:border-tinta-suave'}`}>
                        <span className="font-semibold">{p.name}</span>
                        <span className={bookPatient === p.id ? 'text-marfil/70' : 'text-gray-400'}> · {p.rut || 'sin RUT'}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Siempre a mano: el paciente podría estar guardado con otro nombre */}
                {filteredPatients.length > 0 && (
                  <button
                    onClick={abrirNuevoPaciente}
                    className="mt-2 w-full text-sm font-bold text-salvia hover:underline"
                  >
                    ➕ ¿Es un paciente nuevo? Créalo aquí mismo
                  </button>
                )}
              </>
            )}

            {/* ===== Alta rapida de paciente ===== */}
            {showNuevoPaciente && (
              <div className="mt-3 bg-salvia/10 border-2 border-salvia/40 rounded-2xl p-4 space-y-2.5 animate-fade-up">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-tinta text-sm">➕ Nuevo paciente</p>
                  <button
                    onClick={() => setShowNuevoPaciente(false)}
                    className="text-xs text-gray-500 hover:text-tinta font-semibold"
                  >
                    ← Volver a la búsqueda
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={nuevoPaciente.name}
                    onChange={(e) => setNuevoPaciente((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nombre completo *"
                    className="w-full px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-salvia"
                  />
                  <input
                    type="text"
                    value={nuevoPaciente.rut}
                    onChange={(e) => setNuevoPaciente((p) => ({ ...p, rut: e.target.value }))}
                    placeholder="RUT *"
                    className="w-full px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-salvia"
                  />
                  <input
                    type="tel"
                    value={nuevoPaciente.phone}
                    onChange={(e) => setNuevoPaciente((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Teléfono"
                    className="w-full px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-salvia"
                  />
                  <input
                    type="email"
                    value={nuevoPaciente.email}
                    onChange={(e) => setNuevoPaciente((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Correo (opcional)"
                    className="w-full px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-salvia"
                  />
                </div>
                <select
                  value={nuevoPaciente.insurance}
                  onChange={(e) => setNuevoPaciente((p) => ({ ...p, insurance: e.target.value }))}
                  className="w-full px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-salvia"
                >
                  <option value="">— Particular (sin convenio) —</option>
                  {convenios.map((c) => (
                    <option key={c.id} value={c.nombre}>
                      {c.nombre}
                    </option>
                  ))}
                </select>

                <button
                  onClick={crearPacienteRapido}
                  disabled={creandoPaciente}
                  className="w-full bg-salvia text-marfil py-2.5 rounded-full text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
                >
                  {creandoPaciente ? 'Creando...' : '✔ Crear y seleccionar'}
                </button>
                <p className="text-[11px] text-gray-500 text-center">
                  Sin correo se genera uno interno. Su ficha clínica se completa después en 👥 Pacientes.
                </p>
              </div>
            )}

            <input type="text" value={bookNotes} onChange={(e) => setBookNotes(e.target.value)} placeholder="Notas (opcional)" className="w-full mt-3 px-4 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave" />

            <button
              onClick={confirmBook}
              disabled={savingBook || !bookPatient || !bookTime || (esAjustado && !aceptaAjustado)}
              className="mt-4 w-full bg-tinta text-marfil py-3 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
            >
              {savingBook
                ? 'Agendando...'
                : esAjustado && !aceptaAjustado
                ? 'Marca la casilla para continuar'
                : bookTime
                ? `✔ Confirmar a las ${bookTime}`
                : 'Selecciona la hora'}
            </button>
            <button onClick={cerrarModal} className="mt-2 w-full py-2.5 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
