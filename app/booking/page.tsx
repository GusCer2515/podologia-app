'use client'

import { useState } from 'react'
import { createPatient, createAppointment } from '@/lib/supabase'

export default function BookingPage() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    rut: '',
    notes: ''
  })

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Crear paciente
      const patientData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        rut: formData.rut
      }
      const [patient] = await createPatient(patientData)
      
      // Crear cita
      const appointmentData = {
        patient_id: patient.id,
        appointment_date: \\T\\,
        duration_minutes: 30,
        notes: formData.notes
      }
      await createAppointment(appointmentData)
      
      alert('✅ Cita agendada correctamente')
      setFormData({ name: '', email: '', phone: '', date: '', time: '', rut: '', notes: '' })
    } catch (error) {
      alert('❌ Error al agendar cita')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 mt-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Agendar Cita</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Nombre completo"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          
          <input
            type="tel"
            name="phone"
            placeholder="Teléfono"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          
          <input
            type="text"
            name="rut"
            placeholder="RUT (ej: 12345678-9)"
            value={formData.rut}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          
          <input
            type="time"
            name="time"
            value={formData.time}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          
          <textarea
            name="notes"
            placeholder="Notas (opcional)"
            value={formData.notes}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
          />
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Agendando...' : 'Agendar Cita'}
          </button>
        </form>
      </div>
    </div>
  )
}
