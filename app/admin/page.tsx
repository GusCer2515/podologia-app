'use client'

import { useEffect, useState } from 'react'
import { getAppointments, getPatients } from '@/lib/supabase'

export default function AdminPage() {
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [appts, pats] = await Promise.all([
        getAppointments(),
        getPatients()
      ])
      setAppointments(appts || [])
      setPatients(pats || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Panel de Administración</h1>
        
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Citas */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Citas ({appointments.length})
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {appointments.length === 0 ? (
                  <p className="text-gray-500">No hay citas</p>
                ) : (
                  appointments.map((apt: any) => (
                    <div key={apt.id} className="bg-blue-50 p-3 rounded border-l-4 border-blue-500">
                      <p className="font-semibold">{new Date(apt.appointment_date).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(apt.appointment_date).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-gray-500">Estado: {apt.status}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pacientes */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Pacientes ({patients.length})
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {patients.length === 0 ? (
                  <p className="text-gray-500">No hay pacientes</p>
                ) : (
                  patients.map((patient: any) => (
                    <div key={patient.id} className="bg-green-50 p-3 rounded border-l-4 border-green-500">
                      <p className="font-semibold">{patient.name}</p>
                      <p className="text-sm text-gray-600">{patient.email}</p>
                      <p className="text-sm text-gray-600">{patient.phone}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
