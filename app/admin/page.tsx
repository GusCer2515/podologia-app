'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getAppointmentsBetween, updateAppointmentStatus } from '@/lib/supabase'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Lunes de la semana de una fecha dada
function mondayOf(d: Date): Date {
  const monday = new Date(d)
  const day = monday.getDay() // 0=Dom, 1=Lun...
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

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-blue-50 border-blue-400 text-blue-900',
  completed: 'bg-green-50 border-green-400 text-green-900',
  cancelled: 'bg-red-50 border-red-300 text-red-400 line-through',
}

export default function AdminAgendaPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadWeek = useCallback(async (start: Date) => {
    setLoading(true)
    try {
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const data = await getAppointmentsBetween(
        `${toLocalIso(start)}T00:00:00`,
        `${toLocalIso(end)}T00:00:00`
      )
      setAppointments(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWeek(weekStart)
  }, [weekStart, loadWeek])

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
      alert('Error actualizando la cita')
      console.error(err)
    }
  }

  // Días de la semana (Lun-Dom) con sus citas
  const todayIso = toLocalIso(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const iso = toLocalIso(date)
    return {
      name: DAY_NAMES[i],
      date,
      iso,
      isToday: iso === todayIso,
      appointments: appointments.filter(
        (a) => String(a.appointment_date).substring(0, 10) === iso
      ),
    }
  })

  const todayCount = appointments.filter(
    (a) => String(a.appointment_date).substring(0, 10) === todayIso && a.status === 'scheduled'
  ).length
  const weekCount = appointments.filter((a) => a.status !== 'cancelled').length
  const completedCount = appointments.filter((a) => a.status === 'completed').length

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📅 Agenda Semanal</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeWeek(-7)}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setWeekStart(mondayOf(new Date()))}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Hoy
          </button>
          <button
            onClick={() => changeWeek(7)}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Citas pendientes hoy</p>
          <p className="text-3xl font-bold text-blue-600">{todayCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Citas esta semana</p>
          <p className="text-3xl font-bold text-indigo-600">{weekCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Completadas esta semana</p>
          <p className="text-3xl font-bold text-green-600">{completedCount}</p>
        </div>
      </div>

      {/* Calendario semanal */}
      <p className="text-sm text-gray-500 mb-2">
        Semana del {fmtShort(days[0].date)} al {fmtShort(days[6].date)}
      </p>

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Cargando agenda...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((day) => (
            <div
              key={day.iso}
              className={`bg-white rounded-lg shadow min-h-32 ${
                day.isToday ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div
                className={`px-3 py-2 border-b text-center rounded-t-lg ${
                  day.isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'
                }`}
              >
                <p className="text-xs font-semibold uppercase">{day.name}</p>
                <p className="text-sm font-bold">{fmtShort(day.date)}</p>
              </div>

              <div className="p-2 space-y-2">
                {day.appointments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">Sin citas</p>
                ) : (
                  day.appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className={`border-l-4 rounded p-2 text-xs ${
                        STATUS_STYLE[apt.status] || STATUS_STYLE.scheduled
                      }`}
                    >
                      <p className="font-bold">
                        🕐 {String(apt.appointment_date).substring(11, 16)}
                      </p>
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

                      {apt.status === 'scheduled' && (
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
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
