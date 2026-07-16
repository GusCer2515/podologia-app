'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPatients, deletePatient, createPatientAdmin, getConvenios } from '@/lib/supabase'
import { showToast } from '@/components/toast'

const normRut = (s: any) => String(s ?? '').replace(/[^0-9kK]/g, '').toUpperCase()

const inputClass =
  'w-full px-3 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave'

const FORM_VACIO = {
  name: '',
  rut: '',
  phone: '',
  email: '',
  date_of_birth: '',
  insurance: '',
  cesfam: '',
  address: '',
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [convenios, setConvenios] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterConv, setFilterConv] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  // Modal nuevo paciente
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<any>(FORM_VACIO)
  const [savingNew, setSavingNew] = useState(false)

  const load = () => {
    Promise.all([getPatients(), getConvenios().catch(() => [])])
      .then(([pats, convs]) => {
        setPatients(pats || [])
        setConvenios(convs || [])
      })
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

  const set = (key: string) => (e: any) =>
    setForm((prev: any) => ({ ...prev, [key]: e.target.value }))

  const crearPaciente = async () => {
    if (!form.name.trim() || !form.rut.trim() || !form.email.trim()) {
      showToast('Nombre, RUT y email son obligatorios', 'error')
      return
    }
    // Anti-duplicados por RUT: si ya existe, avisar y no crear
    const rutNuevo = normRut(form.rut)
    const existente = patients.find((p) => p.rut && normRut(p.rut) === rutNuevo)
    if (existente) {
      showToast(`Ese RUT ya pertenece a ${existente.name} — abre su ficha`, 'error')
      return
    }
    setSavingNew(true)
    try {
      await createPatientAdmin({
        name: form.name.trim(),
        rut: form.rut.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim().toLowerCase(),
        date_of_birth: form.date_of_birth || null,
        insurance: form.insurance || null,
        cesfam: form.cesfam.trim() || null,
        address: form.address.trim() || null,
      })
      showToast('Paciente creado — ya puedes completar su ficha e historial')
      setShowNew(false)
      setForm(FORM_VACIO)
      load()
    } catch (err: any) {
      console.error(err)
      showToast(
        err?.code === '23505' ? 'Ese email ya está registrado en otro paciente' : 'Error creando el paciente',
        'error'
      )
    } finally {
      setSavingNew(false)
    }
  }

  const term = search.toLowerCase().trim()
  const filtered = patients.filter((p) => {
    const matchTexto =
      !term ||
      p.name?.toLowerCase().includes(term) ||
      p.rut?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.phone?.includes(term)
    const matchConv =
      !filterConv ||
      (filterConv === 'PARTICULAR' ? !p.insurance : p.insurance === filterConv)
    return matchTexto && matchConv
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl text-tinta font-medium">Pacientes</h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{patients.length} pacientes registrados</p>
          <button
            onClick={() => setShowNew(true)}
            className="bg-tinta text-marfil px-5 py-2 rounded-full font-bold hover:bg-tinta-suave transition"
          >
            + Nuevo paciente
          </button>
        </div>
      </div>

      {/* Búsqueda + filtro por convenio */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, RUT, email o teléfono..."
          className="flex-1 min-w-60 max-w-md px-4 py-2 border border-arena rounded-full focus:outline-none focus:ring-2 focus:ring-tinta-suave bg-marfil"
        />
        <select
          value={filterConv}
          onChange={(e) => setFilterConv(e.target.value)}
          className="px-4 py-2 border border-arena rounded-full bg-marfil text-sm font-semibold text-tinta focus:outline-none focus:ring-2 focus:ring-tinta-suave"
        >
          <option value="">Todos los convenios</option>
          <option value="PARTICULAR">Particular (sin convenio)</option>
          {convenios.map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Cargando pacientes...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 py-8 text-center bg-marfil rounded-2xl border border-arena shadow-sm">
          {term || filterConv
            ? 'No se encontraron pacientes con esos filtros'
            : 'Aún no hay pacientes registrados'}
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
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Convenio</th>
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
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        p.insurance ? 'bg-rosa-palo/70 text-tinta' : 'bg-arena/70 text-gray-600'
                      }`}
                    >
                      {p.insurance || 'Particular'}
                    </span>
                  </td>
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

      {/* ===== Modal: nuevo paciente ===== */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-lg w-full p-7 animate-fade-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl text-tinta font-medium mb-4">
              Nuevo <span className="italic">paciente</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-gray-600 sm:col-span-2">
                Nombre completo *
                <input value={form.name} onChange={set('name')} autoComplete="off" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                RUT * (ej: 12345678-9)
                <input value={form.rut} onChange={set('rut')} autoComplete="off" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Teléfono
                <input value={form.phone} onChange={set('phone')} autoComplete="off" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs font-semibold text-gray-600 sm:col-span-2">
                Email *
                <input type="email" value={form.email} onChange={set('email')} autoComplete="off" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Fecha de nacimiento
                <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Convenio / Previsión
                <select value={form.insurance} onChange={set('insurance')} className={`mt-1 ${inputClass}`}>
                  <option value="">— Sin convenio —</option>
                  {convenios.map((c) => (
                    <option key={c.id} value={c.nombre}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-600">
                CESFAM
                <input value={form.cesfam} onChange={set('cesfam')} autoComplete="off" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Domicilio
                <input value={form.address} onChange={set('address')} autoComplete="off" className={`mt-1 ${inputClass}`} />
              </label>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              💡 Cuando este paciente agende online con su RUT, el sistema lo reconocerá y
              asociará la cita a esta ficha con todo su historial.
            </p>

            <button
              onClick={crearPaciente}
              disabled={savingNew}
              className="mt-4 w-full bg-tinta text-marfil py-3 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
            >
              {savingNew ? 'Creando...' : '✔ Crear paciente'}
            </button>
            <button
              onClick={() => {
                setShowNew(false)
                setForm(FORM_VACIO)
              }}
              disabled={savingNew}
              className="mt-2 w-full py-2.5 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition"
            >
              Cancelar
            </button>
          </div>
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
