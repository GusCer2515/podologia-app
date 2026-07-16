'use client'

import { useState, useEffect } from 'react'
import { bookAppointment } from '@/lib/supabase'
import { getAvailableSlots } from '@/lib/slots'
import { CLINIC, getClinicInfo, type ClinicInfo } from '@/lib/clinicConfig'

type ModalState =
  | { type: 'success'; date: string; time: string; name: string }
  | { type: 'error'; message: string }
  | null

export default function BookingPage() {
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slots, setSlots] = useState<string[]>([])
  const [dayMessage, setDayMessage] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [clinic, setClinic] = useState<ClinicInfo>(CLINIC)

  useEffect(() => {
    getClinicInfo().then(setClinic).catch(() => {})
  }, [])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    rut: '',
    date: '',
    time: '',
    notes: ''
  })

  // Fecha de hoy en formato local YYYY-MM-DD (para el min del calendario)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (e: any) => {
    const date = e.target.value
    setFormData(prev => ({ ...prev, date, time: '' }))
    loadSlots(date)
  }

  // Carga las horas REALMENTE disponibles (lógica compartida con el admin)
  const loadSlots = async (date: string) => {
    setSlots([])
    setDayMessage('')
    if (!date) return
    setLoadingSlots(true)

    try {
      const res = await getAvailableSlots(date)
      setSlots(res.slots)
      setDayMessage(res.message)
    } catch (error) {
      console.error(error)
      setDayMessage('Error cargando horarios. Intenta nuevamente.')
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    if (!formData.time) {
      setModal({ type: 'error', message: 'Selecciona una hora disponible antes de continuar.' })
      return
    }

    setLoading(true)
    try {
      // Agendar vía RPC seguro (valida disponibilidad en la BD)
      const result = await bookAppointment({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        rut: formData.rut,
        datetime: `${formData.date}T${formData.time}:00`,
        notes: formData.notes
      })

      if (result.success) {
        // Enviar correos de confirmación automáticamente (paciente + clínica)
        fetch('/api/notify-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: result.appointment_id,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            date: formData.date,
            time: formData.time,
          }),
        }).catch(() => {}) // si falla el correo, la reserva igual queda hecha

        setModal({ type: 'success', date: formData.date, time: formData.time, name: formData.name })
        setFormData({ name: '', email: '', phone: '', rut: '', date: '', time: '', notes: '' })
        setSlots([])
      } else {
        setModal({ type: 'error', message: result.error || 'No se pudo agendar la hora.' })
        // Refrescar cupos por si alguien tomó la hora mientras tanto
        loadSlots(formData.date)
        setFormData(prev => ({ ...prev, time: '' }))
      }
    } catch (error) {
      setModal({ type: 'error', message: 'Ocurrió un problema de conexión. Intenta nuevamente.' })
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Fecha legible en español (ej: "viernes 17 de julio")
  const fmtFecha = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

  // Respaldo por WhatsApp: el paciente envía su confirmación a la clínica
  const waRespaldo = (m: { date: string; time: string; name: string }) => {
    const msg =
      `Hola 👋 Soy ${m.name}.\n` +
      `Confirmo mi hora agendada en ${clinic.brand} para el ${fmtFecha(m.date)} a las ${m.time} hrs. ✅`
    return `https://wa.me/${clinic.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="min-h-screen bg-crema p-4">
      <div className="max-w-md mx-auto pt-6 pb-2">
        <a href="/" className="text-sm text-tinta-suave hover:text-tinta transition">
          ← Volver al inicio
        </a>
      </div>
      <div className="max-w-md mx-auto bg-marfil rounded-3xl shadow-lg shadow-tinta/10 border border-arena p-7 mt-2">
        <p className="text-xs tracking-[0.25em] uppercase text-rosa font-bold mb-2">
          Vida de Colores
        </p>
        <h1 className="font-display text-4xl text-tinta font-medium mb-6">
          Agendar <span className="italic">tu hora</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Nombre completo"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />

          <input
            type="tel"
            name="phone"
            placeholder="Teléfono"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />

          <input
            type="text"
            name="rut"
            placeholder="RUT (ej: 12345678-9)"
            value={formData.rut}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Fecha de la cita
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleDateChange}
              min={todayStr}
              required
              className="w-full px-4 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
            />
          </div>

          {/* Selector de horas disponibles */}
          {formData.date && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Horas disponibles
              </label>

              {loadingSlots ? (
                <p className="text-gray-500 text-sm">Buscando horas disponibles...</p>
              ) : dayMessage ? (
                <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">{dayMessage}</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, time }))}
                      className={`px-2 py-2 rounded-lg text-sm font-semibold border transition ${
                        formData.time === time
                          ? 'bg-tinta text-marfil border-tinta'
                          : 'bg-white text-foreground border-arena hover:border-tinta-suave hover:bg-rosa-palo/40'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <textarea
            name="notes"
            placeholder="Notas (opcional)"
            value={formData.notes}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
            rows={3}
          />

          <button
            type="submit"
            disabled={loading || !formData.time}
            className="w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition shadow-lg shadow-rosa/25 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? 'Agendando...' : formData.time ? `Agendar Cita a las ${formData.time}` : 'Selecciona fecha y hora'}
          </button>
        </form>
      </div>

      {/* ============ MODAL de confirmación / error ============ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-sm w-full p-8 text-center animate-fade-up">
            {modal.type === 'success' ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-rosa-palo flex items-center justify-center text-3xl">
                  🌸
                </div>
                <h2 className="font-display text-3xl text-tinta font-medium mt-4">
                  ¡Tu hora está <span className="italic">reservada!</span>
                </h2>
                <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
                  Te esperamos el <strong className="text-tinta">{fmtFecha(modal.date)}</strong>
                  <br />a las <strong className="text-tinta">{modal.time} hrs</strong>.
                </p>
                <p className="mt-3 text-xs text-foreground/60 bg-arena/50 rounded-xl px-4 py-2">
                  📧 Te enviamos la confirmación a tu correo.
                </p>
                <a
                  href={waRespaldo(modal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block w-full bg-salvia text-marfil py-3 rounded-full font-bold hover:opacity-90 transition"
                >
                  💬 Confirmar también por WhatsApp
                </a>
                <button
                  onClick={() => setModal(null)}
                  className="mt-3 w-full py-3 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition"
                >
                  Cerrar
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-arena flex items-center justify-center text-3xl">
                  🕐
                </div>
                <h2 className="font-display text-3xl text-tinta font-medium mt-4">
                  No pudimos <span className="italic">agendar</span>
                </h2>
                <p className="mt-3 text-sm text-foreground/75 leading-relaxed">{modal.message}</p>
                <button
                  onClick={() => setModal(null)}
                  className="mt-6 w-full bg-tinta text-marfil py-3 rounded-full font-bold hover:bg-tinta-suave transition"
                >
                  Entendido
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
