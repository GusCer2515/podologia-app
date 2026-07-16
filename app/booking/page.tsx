'use client'

import { useState } from 'react'
import { createPatient, createAppointment, checkAppointmentAvailability } from '@/lib/supabase'

export default function BookingPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    rut: '',
    insurance: 'FONASA',
    appointmentDate: '',
    appointmentTime: '09:00'
  })

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Validar que los campos estén llenos
      if (!formData.name || !formData.email || !formData.phone || !formData.appointmentDate) {
        throw new Error('Por favor completa todos los campos')
      }

      // Construir fecha y hora
      const appointmentDateTime = `${formData.appointmentDate}T${formData.appointmentTime}:00`

      // Verificar disponibilidad
      const isAvailable = await checkAppointmentAvailability(appointmentDateTime)
      if (!isAvailable) {
        throw new Error('Esa hora no está disponible. Intenta con otra.')
      }

      // Crear paciente
      const patient = await createPatient({
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        rut: formData.rut,
        insurance: formData.insurance
      })

      // Crear cita
      await createAppointment({
        patient_id: patient[0].id,
        appointment_date: appointmentDateTime,
        duration_minutes: 30,
        status: 'scheduled'
      })

      setSuccess(true)
      setFormData({
        name: '',
        email: '',
        phone: '',
        rut: '',
        insurance: 'FONASA',
        appointmentDate: '',
        appointmentTime: '09:00'
      })

      // Mensaje de éxito
      alert('✅ Cita agendada correctamente. Revisa tu email para confirmar.')
    } catch (err: any) {
      setError(err.message || 'Error al agendar la cita')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <a href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Volver al inicio
          </a>
          <h1 className="text-3xl font-bold text-blue-900">
            🗓️ Agendar Hora
          </h1>
        </div>
      </header>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg">
          
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">
              ✅ Cita agendada correctamente
            </div>
          )}

          {/* Nombre */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Nombre Completo *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Juan Pérez"
              required
            />
          </div>

          {/* Email */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="juan@email.com"
              required
            />
          </div>

          {/* Teléfono */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Teléfono *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+56912345678"
              required
            />
          </div>

          {/* RUT */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              RUT (opcional)
            </label>
            <input
              type="text"
              name="rut"
              value={formData.rut}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="18.483.447-2"
            />
          </div>

          {/* Convenio */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Tipo de Convenio *
            </label>
            <select
              name="insurance"
              value={formData.insurance}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="FONASA">FONASA</option>
              <option value="ISAPRE">ISAPRE</option>
              <option value="PARTICULAR">Particular</option>
            </select>
          </div>

          {/* Fecha */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Fecha de Cita *
            </label>
            <input
              type="date"
              name="appointmentDate"
              value={formData.appointmentDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Hora */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Hora de Cita *
            </label>
            <select
              name="appointmentTime"
              value={formData.appointmentTime}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['09:00', '09:30', '10:00', '10:30', '11:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>

          {/* Botón Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {loading ? 'Agendando...' : 'Confirmar Cita'}
          </button>
        </form>
      </section>
    </div>
  )
}
