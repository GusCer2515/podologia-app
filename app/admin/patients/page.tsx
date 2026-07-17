'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPatients, deletePatient, createPatientAdmin, getConvenios } from '@/lib/supabase'
import { showToast } from '@/components/toast'

const normRut = (s: any) => String(s ?? '').replace(/[^0-9kK]/g, '').toUpperCase()

// Avatar con iniciales y color según el nombre
const AVATAR_COLORS = ['bg-tinta', 'bg-rosa', 'bg-salvia', 'bg-[#d9a441]', 'bg-tinta-suave']
const initials = (name?: string) =>
  String(name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
const colorFor = (name?: string) =>
  AVATAR_COLORS[(String(name ?? 'A').charCodeAt(0) + String(name ?? 'A').length) % AVATAR_COLORS.length]

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
        <h1 className="font-display text-3xl text-tinta font-medium">
          Pacientes <span className="italic">de la consulta</span>
        </h1>
        <button
          onClick={() => setShowNew(true)}
          className="bg-tinta text-marfil px-5 py-2 rounded-full font-bold hover:bg-tinta-suave transition shadow-lg shadow-tinta/20"
        >
          + Nuevo paciente
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">👥 Total pacientes</p>
          <p className="text-3xl font-bold text-tinta">{patients.length}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">🤝 Con convenio</p>
          <p className="text-3xl font-bold text-rosa">
            {patients.filter((p) => p.insurance).length}
          </p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">💵 Particulares</p>
          <p className="text-3xl font-bold text-salvia">
            {patients.filter((p) => !p.insurance).length}
          </p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">🌱 Nuevos este mes</p>
          <p className="text-3xl font-bold text-tinta-suave">
            {
              patients.filter((p) =>
                String(p.fecha_ingreso ?? '').startsWith(
                  new Date().toISOString().substring(0, 7)
                )
              ).length
            }
          </p>
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
        <div className="bg-marfil rounded-2xl border border-arena shadow-sm overflow-x-auto animate-fade-up">
          <table className="w-full">
            <thead className="bg-arena/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-tinta">Paciente</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-tinta">RUT</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-tinta">Teléfono</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-tinta">Convenio</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-tinta">Ingreso</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-arena/60 hover:bg-rosa-palo/25 transition-colors group"
                >
                  <td className="px-4 py-3">
                    <Link href={`/admin/patients/${p.id}`} className="flex items-center gap-3">
                      <span
                        className={`w-10 h-10 rounded-full ${colorFor(p.name)} text-marfil flex items-center justify-center text-sm font-bold shrink-0 shadow-sm`}
                      >
                        {initials(p.name)}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-tinta group-hover:text-rosa transition">
                          {p.name}
                        </span>
                        <span className="block text-xs text-gray-400">{p.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.rut || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.phone ? `📞 ${p.phone}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        p.insurance
                          ? 'bg-rosa-palo/70 text-tinta border border-rosa/30'
                          : 'bg-arena/70 text-gray-600 border border-arena'
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
                      className="inline-block bg-tinta text-marfil text-xs font-bold px-4 py-1.5 rounded-full hover:bg-tinta-suave transition mr-2"
                    >
                      Ver ficha →
                    </Link>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="text-rosa/60 hover:text-rosa hover:bg-rosa-palo/50 rounded-full px-2 py-1 text-sm transition"
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
