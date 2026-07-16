'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getPatient, updatePatient, getPatientAppointments } from '@/lib/supabase'

const TABS = [
  { key: 'info', label: '📋 Información' },
  { key: 'citas', label: '📅 Citas' },
  { key: 'ficha', label: '🩺 Ficha Clínica' },
  { key: 'atenciones', label: '📝 Atenciones' },
  { key: 'documentos', label: '📄 Documentos' },
]

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

export default function PatientDetailPage() {
  const params = useParams()
  const patientId = String(params.id)

  const [tab, setTab] = useState('info')
  const [patient, setPatient] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    Promise.all([getPatient(patientId), getPatientAppointments(patientId)])
      .then(([p, appts]) => {
        setPatient(p)
        setForm(p)
        setAppointments(appts || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [patientId])

  const handleField = (e: any) => {
    const { name, value } = e.target
    setForm((prev: any) => ({ ...prev, [name]: value }))
  }

  const saveInfo = async () => {
    setSaving(true)
    try {
      await updatePatient(patientId, {
        name: form.name,
        rut: form.rut,
        phone: form.phone,
        email: form.email,
        date_of_birth: form.date_of_birth || null,
        address: form.address,
        cesfam: form.cesfam,
        insurance: form.insurance,
      })
      setPatient(form)
      alert('✅ Datos guardados')
    } catch (err) {
      alert('❌ Error guardando datos')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500 py-8 text-center">Cargando paciente...</p>
  }

  if (!patient) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Paciente no encontrado</p>
        <Link href="/admin/patients" className="text-blue-600 font-semibold">
          ← Volver a pacientes
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/patients" className="text-sm text-blue-600 hover:underline">
          ← Volver a pacientes
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">{patient.name}</h1>
        <p className="text-sm text-gray-500">
          {patient.rut || 'Sin RUT'} · {patient.phone || 'Sin teléfono'} · {patient.email}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-lg shadow p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-blue-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Información */}
      {tab === 'info' && (
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Datos del Paciente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Nombre</label>
              <input name="name" value={form.name || ''} onChange={handleField}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">RUT</label>
              <input name="rut" value={form.rut || ''} onChange={handleField}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Teléfono</label>
              <input name="phone" value={form.phone || ''} onChange={handleField}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
              <input name="email" value={form.email || ''} onChange={handleField}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Fecha de nacimiento</label>
              <input type="date" name="date_of_birth" value={form.date_of_birth || ''} onChange={handleField}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">CESFAM</label>
              <input name="cesfam" value={form.cesfam || ''} onChange={handleField}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Domicilio</label>
              <input name="address" value={form.address || ''} onChange={handleField}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Convenio / Previsión</label>
              <input name="insurance" value={form.insurance || ''} onChange={handleField}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <button
            onClick={saveInfo}
            disabled={saving}
            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Tab: Citas */}
      {tab === 'citas' && (
        <div className="bg-white rounded-lg shadow overflow-x-auto max-w-2xl">
          {appointments.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">Este paciente no tiene citas</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Hora</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Notas</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-sm">
                      {new Date(a.appointment_date).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {String(a.appointment_date).substring(11, 16)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          a.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-800'
                            : a.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tabs en construcción */}
      {(tab === 'ficha' || tab === 'atenciones' || tab === 'documentos') && (
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-2xl">
          <p className="text-4xl mb-3">🚧</p>
          <p className="text-gray-600 font-semibold">Esta sección viene en la próxima fase</p>
          <p className="text-sm text-gray-400 mt-1">
            {tab === 'ficha' && 'Ficha clínica podológica completa (Fase 3b)'}
            {tab === 'atenciones' && 'Registro de atenciones y procedimientos (Fase 3b)'}
            {tab === 'documentos' && 'Recetas e indicaciones en PDF + envío por WhatsApp (Fase 4)'}
          </p>
        </div>
      )}
    </div>
  )
}
