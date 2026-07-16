'use client'

import { useState } from 'react'
import { adminCreateAppointment, rescheduleAppointment } from '@/lib/supabase'
import { getAvailableSlots, todayLocalStr } from '@/lib/slots'
import { showToast } from '@/components/toast'

// Agendar o reagendar una cita desde el panel admin
// - appointment = null  → nueva cita para el paciente
// - appointment = {...} → reagendar esa cita existente
export default function AdminScheduler({
  patientId,
  appointment,
  onDone,
  onCancel,
}: {
  patientId: string
  appointment: any | null
  onDone: () => void
  onCancel: () => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  // Hora manual: el admin puede agendar FUERA del horario configurado
  const [manual, setManual] = useState(false)
  const [manualTime, setManualTime] = useState('')

  const handleDate = async (value: string) => {
    setDate(value)
    setTime('')
    setSlots([])
    setMessage('')
    if (!value) return
    setLoadingSlots(true)
    try {
      const res = await getAvailableSlots(value)
      setSlots(res.slots)
      setMessage(res.message)
    } catch (err) {
      console.error(err)
      setMessage('Error cargando horarios. Intenta nuevamente.')
    } finally {
      setLoadingSlots(false)
    }
  }

  const confirm = async () => {
    const horaFinal = manual ? manualTime : time
    if (!date || !horaFinal) {
      showToast('Selecciona fecha y hora', 'error')
      return
    }
    setSaving(true)
    const datetime = `${date}T${horaFinal}:00`
    try {
      if (appointment) {
        await rescheduleAppointment(appointment.id, datetime)
        showToast(`Cita reagendada para el ${date} a las ${time}`)
      } else {
        await adminCreateAppointment(patientId, datetime, notes)
        showToast(`Cita agendada para el ${date} a las ${time}`)
      }
      onDone()
    } catch (err: any) {
      console.error(err)
      if (err?.code === '23505') {
        showToast('Esa hora ya fue tomada. Elige otra.', 'error')
        handleDate(date) // refrescar cupos
      } else {
        showToast('Error guardando la cita', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-tinta/20 p-5 space-y-4">
      <h3 className="font-bold text-tinta">
        {appointment
          ? `🔄 Reagendar cita del ${new Date(appointment.appointment_date).toLocaleDateString('es-CL')} a las ${String(appointment.appointment_date).substring(11, 16)}`
          : '📅 Agendar nueva cita para este paciente'}
      </h3>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500">
          Fecha
          <input
            type="date"
            value={date}
            min={todayLocalStr()}
            onChange={(e) => handleDate(e.target.value)}
            className="block mt-1 px-3 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />
        </label>

        {!appointment && (
          <label className="text-xs text-gray-500 flex-1 min-w-40">
            Notas (opcional)
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: agendada por teléfono"
              className="block mt-1 w-full px-3 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
            />
          </label>
        )}
      </div>

      {/* Cupos disponibles o hora manual */}
      {date && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600">
              {manual ? 'Hora manual (fuera de horario)' : 'Horas disponibles'}
            </p>
            <button
              type="button"
              onClick={() => {
                setManual(!manual)
                setTime('')
                setManualTime('')
              }}
              className="text-xs font-bold text-rosa hover:underline"
            >
              {manual ? '← Volver a cupos del horario' : '⏰ Agendar fuera de horario'}
            </button>
          </div>

          {manual ? (
            <div className="bg-rosa-palo/40 border border-rosa/30 rounded-xl p-3">
              <input
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="px-3 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
              />
              <p className="text-xs text-tinta mt-2">
                ⚠️ Hora especial fuera del horario configurado — el sistema igual evitará
                duplicados.
              </p>
            </div>
          ) : loadingSlots ? (
            <p className="text-sm text-gray-500">Buscando horas...</p>
          ) : message ? (
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-xl">{message}</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={`px-2 py-1.5 rounded-lg text-sm font-semibold border transition ${
                    time === t
                      ? 'bg-tinta text-marfil border-tinta'
                      : 'bg-white text-foreground border-arena hover:border-tinta-suave hover:bg-rosa-palo/40'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={saving || (manual ? !manualTime : !time)}
          className="bg-tinta text-marfil px-6 py-2 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
        >
          {saving ? 'Guardando...' : appointment ? 'Confirmar reagendamiento' : 'Confirmar cita'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-6 py-2 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
