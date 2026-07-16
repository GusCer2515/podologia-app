'use client'

import { useEffect, useState } from 'react'
import { rescheduleAppointment, updateAppointmentStatus } from '@/lib/supabase'
import { getAvailableSlots, todayLocalStr } from '@/lib/slots'
import { CLINIC, getClinicInfo, type ClinicInfo } from '@/lib/clinicConfig'
import { showToast } from '@/components/toast'

const fmtDia = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

const waPhone = (phone?: string): string => {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('56')) return digits
  if (digits.length === 9 && digits.startsWith('9')) return '56' + digits
  return digits
}

type Resultado = { tipo: 'reagendada' | 'cancelada'; date?: string; time?: string } | null

// Wizard: guía al admin para reagendar (o cancelar) una a una las
// citas de un día que acaba de bloquear, con aviso por WhatsApp
export default function ReagendarWizard({
  date,
  items,
  onClose,
}: {
  date: string
  items: any[]
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [msg, setMsg] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resultado, setResultado] = useState<Resultado>(null)
  const [clinic, setClinic] = useState<ClinicInfo>(CLINIC)

  useEffect(() => {
    getClinicInfo().then(setClinic).catch(() => {})
  }, [])

  const apt = items[index]
  const paciente = apt?.patients
  const horaOriginal = String(apt?.appointment_date ?? '').substring(11, 16)
  const esUltimo = index === items.length - 1

  const handleDate = async (value: string) => {
    setNewDate(value)
    setNewTime('')
    setSlots([])
    setMsg('')
    if (!value) return
    setLoadingSlots(true)
    try {
      const res = await getAvailableSlots(value)
      setSlots(res.slots)
      setMsg(res.message)
    } catch {
      setMsg('Error cargando horarios')
    } finally {
      setLoadingSlots(false)
    }
  }

  const reagendar = async () => {
    if (!newDate || !newTime) {
      showToast('Selecciona la nueva fecha y hora', 'error')
      return
    }
    setSaving(true)
    try {
      await rescheduleAppointment(apt.id, `${newDate}T${newTime}:00`)
      setResultado({ tipo: 'reagendada', date: newDate, time: newTime })
      showToast('Cita reagendada')
    } catch (err: any) {
      if (err?.code === '23505') {
        showToast('Esa hora ya fue tomada. Elige otra.', 'error')
        handleDate(newDate)
      } else {
        showToast('Error reagendando la cita', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const cancelar = async () => {
    setSaving(true)
    try {
      await updateAppointmentStatus(apt.id, 'cancelled')
      setResultado({ tipo: 'cancelada' })
      showToast('Cita cancelada')
    } catch {
      showToast('Error cancelando la cita', 'error')
    } finally {
      setSaving(false)
    }
  }

  const waLink = () => {
    const texto =
      resultado?.tipo === 'reagendada'
        ? `Hola ${paciente?.name} 👋 Te escribimos de ${clinic.brand}.\n\nTu hora del ${fmtDia(date)} a las ${horaOriginal} hrs fue reprogramada para el ${fmtDia(resultado.date!)} a las ${resultado.time} hrs.\n\n¡Te esperamos! 🌸`
        : `Hola ${paciente?.name} 👋 Te escribimos de ${clinic.brand}.\n\nLamentablemente debimos cancelar tu hora del ${fmtDia(date)} a las ${horaOriginal} hrs. Puedes agendar una nueva en nuestro sitio web o responder este mensaje.\n\nDisculpa las molestias 🌸`
    return `https://wa.me/${waPhone(paciente?.phone)}?text=${encodeURIComponent(texto)}`
  }

  const siguiente = () => {
    if (esUltimo) {
      onClose()
      return
    }
    setIndex((i) => i + 1)
    setNewDate('')
    setNewTime('')
    setSlots([])
    setMsg('')
    setResultado(null)
  }

  if (!apt) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
      <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-lg w-full p-7 animate-fade-up max-h-[90vh] overflow-y-auto">
        {/* Encabezado y progreso */}
        <p className="text-xs tracking-[0.25em] uppercase text-rosa font-bold">
          Día bloqueado: {fmtDia(date)}
        </p>
        <h2 className="font-display text-2xl text-tinta font-medium mt-1">
          Reagendar pacientes <span className="italic">afectados</span>
        </h2>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-1.5 bg-arena rounded-full overflow-hidden">
            <div
              className="h-full bg-tinta transition-all"
              style={{ width: `${((index + (resultado ? 1 : 0)) / items.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 font-semibold whitespace-nowrap">
            {index + 1} de {items.length}
          </p>
        </div>

        {/* Paciente actual */}
        <div className="mt-4 bg-white border border-arena rounded-2xl p-4">
          <p className="font-bold text-tinta">{paciente?.name}</p>
          <p className="text-sm text-gray-500">
            📞 {paciente?.phone || 'Sin teléfono'} · Cita original: {horaOriginal} hrs
          </p>
        </div>

        {resultado ? (
          /* ===== Paso completado: avisar por WhatsApp ===== */
          <div className="mt-4 text-center space-y-3">
            <p className="text-sm font-semibold text-salvia">
              {resultado.tipo === 'reagendada'
                ? `✅ Reagendada para el ${fmtDia(resultado.date!)} a las ${resultado.time} hrs`
                : '✅ Cita cancelada'}
            </p>
            <a
              href={waLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-salvia text-marfil py-3 rounded-full font-bold hover:opacity-90 transition"
            >
              💬 Avisar a {paciente?.name?.split(' ')[0]} por WhatsApp
            </a>
            <button
              onClick={siguiente}
              className="w-full bg-tinta text-marfil py-3 rounded-full font-bold hover:bg-tinta-suave transition"
            >
              {esUltimo ? '✔ Finalizar' : 'Siguiente paciente →'}
            </button>
          </div>
        ) : (
          /* ===== Elegir nueva fecha/hora ===== */
          <div className="mt-4 space-y-3">
            <label className="text-xs text-gray-500 block">
              Nueva fecha
              <input
                type="date"
                value={newDate}
                min={todayLocalStr()}
                onChange={(e) => handleDate(e.target.value)}
                className="block mt-1 px-3 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
              />
            </label>

            {newDate && (
              <div>
                {loadingSlots ? (
                  <p className="text-sm text-gray-500">Buscando horas...</p>
                ) : msg ? (
                  <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-xl">{msg}</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewTime(t)}
                        className={`px-2 py-1.5 rounded-lg text-sm font-semibold border transition ${
                          newTime === t
                            ? 'bg-tinta text-marfil border-tinta'
                            : 'bg-white text-foreground border-arena hover:border-tinta-suave'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={reagendar}
                disabled={saving || !newTime}
                className="flex-1 bg-tinta text-marfil py-2.5 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
              >
                {saving ? 'Guardando...' : '🔄 Reagendar'}
              </button>
              <button
                onClick={cancelar}
                disabled={saving}
                className="flex-1 bg-rosa text-marfil py-2.5 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                ✕ Cancelar cita
              </button>
              <button
                onClick={siguiente}
                disabled={saving}
                className="w-full py-2 rounded-full text-sm font-semibold text-tinta-suave hover:text-tinta transition"
              >
                Omitir por ahora →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
