'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPatients, deletePatient } from '@/lib/supabase'
import { showToast } from '@/components/toast'

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    getPatients()
      .then((data) => setPatients(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePatient(deleteTarget.id)
      showToast(`Paciente ${deleteTarget.name} eliminado`)
      setDeleteTarget(null)
      load()
    } catch (err) {
      console.error(err)
      showToast('Error eliminando el paciente', 'error')
    } finally {
      setDeleting(false)
    }
  }

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
        <h1 className="font-display text-3xl text-tinta font-medium">Pacientes</h1>
        <p className="text-sm text-gray-500">{patients.length} pacientes registrados</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Buscar por nombre, RUT, email o teléfono..."
        className="w-full max-w-md px-4 py-2 border border-arena rounded-full mb-6 focus:outline-none focus:ring-2 focus:ring-tinta-suave bg-marfil"
      />

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Cargando pacientes...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 py-8 text-center bg-marfil rounded-2xl border border-arena shadow-sm">
          {term ? 'No se encontraron pacientes con esa búsqueda' : 'Aún no hay pacientes registrados'}
        </p>
      ) : (
        <div className="bg-marfil rounded-2xl border border-arena shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-arena/50">
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
                <tr key={p.id} className="border-t border-gray-100 hover:bg-rosa-palo/30">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.rut || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.fecha_ingreso
                      ? new Date(p.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-CL')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/patients/${p.id}`}
                      className="text-tinta hover:text-rosa text-sm font-semibold mr-4"
                    >
                      Ver ficha →
                    </Link>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="text-rosa hover:bg-rosa-palo/50 rounded-full px-2 py-1 text-sm transition"
                      title="Eliminar paciente"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-sm w-full p-8 text-center animate-fade-up">
            <div className="w-16 h-16 mx-auto rounded-full bg-rosa-palo flex items-center justify-center text-3xl">
              🗑
            </div>
            <h2 className="font-display text-2xl text-tinta font-medium mt-4">
              ¿Eliminar a <span className="italic">{deleteTarget.name}</span>?
            </h2>
            <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
              Se eliminarán también sus <strong>citas, ficha clínica, atenciones y
              documentos</strong>.
              <br />
              <strong className="text-rosa">Esta acción no se puede deshacer.</strong>
            </p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="mt-6 w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar paciente'}
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="mt-3 w-full py-3 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
