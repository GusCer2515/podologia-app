'use client'

import { useState } from 'react'
import { bookAppointment, getAvailability, getBlockouts, getOccupiedSlots } from '@/lib/supabase'

export default function BookingPage() {
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slots, setSlots] = useState<string[]>([])
  const [dayMessage, setDayMessage] = useState('')
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

  // Carga las horas REALMENTE disponibles para la fecha elegida
  const loadSlots = async (date: string) => {
    setSlots([])
    setDayMessage('')
    if (!date) return
    setLoadingSlots(true)

    try {
      const [availability, blockouts, occupied] = await Promise.all([
        getAvailability(),
        getBlockouts(),
        getOccupiedSlots(date)
      ])

      // ¿Día bloqueado? (feriado, vacaciones, etc.)
      if ((blockouts ?? []).some((b: any) => b.blocked_date === date)) {
        setDayMessage('⛔ Ese día no hay atención (feriado o día bloqueado). Elige otra fecha.')
        return
      }

      // ¿Hay horario configurado para ese día de la semana?
      const dayOfWeek = new Date(date + 'T00:00:00').getDay()
      const config = (availability ?? []).find((a: any) => a.day_of_week === dayOfWeek)
      if (!config) {
        setDayMessage('⛔ Ese día no hay atención. Elige otra fecha.')
        return
      }

      // Horas ya tomadas ese día (ej: "10:00", "15:30")
      const occupiedTimes = new Set(
        occupied.map((o) => String(o.slot).substring(11, 16))
      )

      // Generar cupos desde hora inicio a hora fin
      const [sh, sm] = String(config.start_time).split(':').map(Number)
      const [eh, em] = String(config.end_time).split(':').map(Number)
      const step = config.slot_duration_minutes || 30
      const now = new Date()
      const isToday = date === todayStr

      const generated: string[] = []
      for (let mins = sh * 60 + sm; mins + step <= eh * 60 + em; mins += step) {
        const h = String(Math.floor(mins / 60)).padStart(2, '0')
        const m = String(mins % 60).padStart(2, '0')
        const time = `${h}:${m}`

        // Saltar horas ocupadas
        if (occupiedTimes.has(time)) continue

        // Si es hoy, saltar horas que ya pasaron
        if (isToday && new Date(`${date}T${time}:00`) <= now) continue

        generated.push(time)
      }

      if (generated.length === 0) {
        setDayMessage('😔 No quedan horas disponibles ese día. Elige otra fecha.')
      }
      setSlots(generated)
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
      alert('⚠️ Selecciona una hora disponible')
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
        alert(`✅ Cita agendada correctamente para el ${formData.date} a las ${formData.time}`)
        setFormData({ name: '', email: '', phone: '', rut: '', date: '', time: '', notes: '' })
        setSlots([])
      } else {
        alert(`⚠️ ${result.error}`)
        // Refrescar cupos por si alguien tomó la hora mientras tanto
        loadSlots(formData.date)
        setFormData(prev => ({ ...prev, time: '' }))
      }
    } catch (error) {
      alert('❌ Error al agendar cita. Intenta nuevamente.')
      console.error(error)
    } finally {
      setLoading(false)
    }
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
    </div>
  )
}
