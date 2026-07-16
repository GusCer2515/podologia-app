'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPatients } from '@/lib/supabase'

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPatients()
      .then((data) => setPatients(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const term = search.toLowerCase().trim()
  const filtered = patients.filter(
    (p) =>
      !term ||
      p.name?.toLowerCase().includes(term) ||
      p.rut?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.phone?.includes(term)
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👥 Pacientes</h1>
        <p className="text-sm text-gray-500">{patients.length} pacientes registrados</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Buscar por nombre, RUT, email o teléfono..."
        className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Cargando pacientes...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 py-8 text-center bg-white rounded-lg shadow">
          {term ? 'No se encontraron pacientes con esa búsqueda' : 'Aún no hay pacientes registrados'}
        </p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">RUT</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Teléfono</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Email</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Ingreso</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-blue-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.rut || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.fecha_ingreso
                      ? new Date(p.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-CL')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/patients/${p.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                    >
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
