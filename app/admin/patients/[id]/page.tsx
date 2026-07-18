'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getPatient, updatePatient, getPatientAppointments, getConvenios } from '@/lib/supabase'
import ClinicalRecordForm from '@/components/ClinicalRecordForm'
import AttentionsTab from '@/components/AttentionsTab'
import DocumentsTab from '@/components/DocumentsTab'
import AdminScheduler from '@/components/AdminScheduler'
import { showToast } from '@/components/toast'

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

// Avatar con iniciales y color según el nombre (igual que en la lista)
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

export default function PatientDetailPage() {
  const params = useParams()
  const patientId = String(params.id)

  const [tab, setTab] = useState('info')
  const [patient, setPatient] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [convenios, setConvenios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})
  // Agendador admin: false = cerrado, null = nueva cita, objeto = reagendar esa cita
  const [scheduler, setScheduler] = useState<any>(false)
  const [citasFiltro, setCitasFiltro] = useState<'todo' | 'podologia' | 'manicura'>('todo')

  const reloadAppointments = () => {
    getPatientAppointments(patientId)
      .then((appts) => setAppointments(appts || []))
      .catch(console.error)
  }

  useEffect(() => {
    // Cada recurso por separado: si convenios falla, el paciente igual carga
    Promise.all([
      getPatient(patientId),
      getPatientAppointments(patientId).catch(() => []),
      getConvenios().catch(() => []),
    ])
      .then(([p, appts, convs]) => {
        setPatient(p)
        setForm(p)
        setAppointments(appts || [])
        setConvenios(convs || [])
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
      showToast('Datos del paciente guardados')
    } catch (err) {
      showToast('Error guardando los datos', 'error')
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
      {/* Header + Tabs: fijos al hacer scroll */}
      <div className="sticky top-0 z-20 bg-crema -mx-6 px-6 pt-2 pb-3 mb-6 border-b border-arena/60">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
          <div>
            <Link href="/admin/patients" className="text-sm text-tinta-suave hover:text-tinta transition">
              ← Volver a pacientes
            </Link>
            <div className="flex items-center gap-3 mt-1.5">
              <span
                className={`w-12 h-12 rounded-full ${colorFor(patient.name)} text-marfil flex items-center justify-center text-base font-bold shrink-0 shadow-sm`}
              >
                {initials(patient.name)}
              </span>
              <div>
                <h1 className="font-display text-3xl text-tinta font-medium leading-tight">
                  {patient.name}
                </h1>
                <p className="text-sm text-gray-500">
                  {patient.rut || 'Sin RUT'} · {patient.phone || 'Sin teléfono'} · {patient.email}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold self-start mt-1 ${
                  patient.insurance
                    ? 'bg-rosa-palo/70 text-tinta border border-rosa/30'
                    : 'bg-arena/70 text-gray-600 border border-arena'
                }`}
              >
                {patient.insurance || 'Particular'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 bg-marfil rounded-full border border-arena shadow-sm p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                tab === t.key ? 'bg-tinta text-marfil' : 'text-tinta-suave hover:bg-rosa-palo/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Información */}
      {tab === 'info' && (
        <div className="bg-marfil rounded-2xl border border-arena shadow-sm p-6 max-w-2xl animate-fade-up">
          <h2 className="font-display text-2xl text-tinta font-semibold mb-4">📋 Datos del Paciente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5">Nombre</label>
              <input name="name" value={form.name || ''} onChange={handleField} autoComplete="off"
                className="w-full px-3 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5">RUT</label>
              <input name="rut" value={form.rut || ''} onChange={handleField} autoComplete="off"
                className="w-full px-3 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5">Teléfono</label>
              <input name="phone" value={form.phone || ''} onChange={handleField} autoComplete="off"
                className="w-full px-3 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5">Email</label>
              <input name="email" value={form.email || ''} onChange={handleField} autoComplete="off"
                className="w-full px-3 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5">Fecha de nacimiento</label>
              <input type="date" name="date_of_birth" value={form.date_of_birth || ''} onChange={handleField} autoComplete="off"
                className="w-full px-3 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5">CESFAM</label>
              <input name="cesfam" value={form.cesfam || ''} onChange={handleField} autoComplete="off"
                className="w-full px-3 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5">Domicilio</label>
              <input name="address" value={form.address || ''} onChange={handleField} autoComplete="off"
                className="w-full px-3 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5">Convenio / Previsión</label>
              <select
                name="insurance"
                value={form.insurance || ''}
                onChange={handleField} autoComplete="off"
                className="w-full px-3 py-2 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
              >
                <option value="">— Sin convenio —</option>
                {/* Si el valor actual no está en la lista, se conserva */}
                {form.insurance && !convenios.some((c) => c.nombre === form.insurance) && (
                  <option value={form.insurance}>{form.insurance}</option>
                )}
                {convenios.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Los convenios se administran en ⚙️ Configuración
              </p>
            </div>
          </div>

          <button
            onClick={saveInfo}
            disabled={saving}
            className="mt-6 bg-tinta text-marfil px-6 py-2 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Tab: Citas */}
      {tab === 'citas' && (
        <div className="space-y-4 max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl text-tinta font-semibold">
              📅 Citas ({appointments.filter((a) => citasFiltro === 'todo' || (a.tipo ?? 'podologia') === citasFiltro).length})
            </h2>
            <button
              onClick={() => setScheduler(scheduler === null ? false : null)}
              className="bg-tinta text-marfil px-4 py-2 rounded-full font-bold hover:bg-tinta-suave transition"
            >
              {scheduler === null ? 'Cancelar' : '+ Agendar cita'}
            </button>
          </div>

          {/* Filtro por tipo */}
          <div className="flex gap-1 bg-marfil rounded-full border border-arena shadow-sm p-1 w-fit">
            {([['todo', 'Todas'], ['podologia', '🦶 Podología'], ['manicura', '💅 Manicura']] as const).map(
              ([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCitasFiltro(key)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                    citasFiltro === key
                      ? key === 'manicura'
                        ? 'bg-[#a37cc4] text-marfil'
                        : 'bg-tinta text-marfil'
                      : 'text-tinta-suave hover:bg-rosa-palo/40'
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {/* Agendador admin (nueva cita o reagendamiento) */}
          {scheduler !== false && (
            <AdminScheduler
              patientId={patientId}
              appointment={scheduler}
              onDone={() => {
                setScheduler(false)
                reloadAppointments()
              }}
              onCancel={() => setScheduler(false)}
            />
          )}

          {(() => {
            const filtradas = appointments.filter(
              (a) => citasFiltro === 'todo' || (a.tipo ?? 'podologia') === citasFiltro
            )
            return (
              <div className="bg-marfil rounded-2xl border border-arena shadow-sm overflow-x-auto">
                {filtradas.length === 0 ? (
                  <p className="text-gray-500 py-8 text-center">Sin citas con ese filtro</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-arena/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-tinta whitespace-nowrap">Fecha</th>
                        <th className="px-3 py-3 text-left text-sm font-bold text-tinta whitespace-nowrap">Hora</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-tinta w-64">Tipo</th>
                        <th className="px-3 py-3 text-left text-sm font-bold text-tinta whitespace-nowrap">Estado</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-tinta">Notas</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((a) => (
                        <tr key={a.id} className="border-t border-arena/60 hover:bg-rosa-palo/20">
                          <td className="px-4 py-3 text-sm whitespace-nowrap">{new Date(a.appointment_date).toLocaleDateString('es-CL')}</td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">{String(a.appointment_date).substring(11, 16)}</td>
                          <td className="px-4 py-3 text-sm">
                            {a.tipo === 'manicura' ? (
                              <span className="inline-block whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-[#a37cc4]/15 text-[#7c5a99]">
                                💅 {a.nail_services?.nombre || 'Manicura'}
                              </span>
                            ) : (
                              <span className="inline-block whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-tinta/10 text-tinta">
                                🦶 Podología
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold ${a.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : a.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {STATUS_LABEL[a.status] || a.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 min-w-40">{a.notes || '—'}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {(a.status === 'scheduled' || a.status === 'cancelled') && (
                              <button onClick={() => setScheduler(a)} className="bg-rosa-palo/60 text-tinta px-3 py-1 rounded-full text-xs font-bold hover:bg-rosa-palo transition" title={a.status === 'cancelled' ? 'Volver a agendar' : 'Cambiar fecha/hora'}>🔄 Reagendar</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Tab: Ficha Clínica */}
      {tab === 'ficha' && <ClinicalRecordForm patientId={patientId} />}

      {/* Tab: Atenciones */}
      {tab === 'atenciones' && <AttentionsTab patient={patient} />}

      {/* Tab: Documentos */}
      {tab === 'documentos' && <DocumentsTab patient={patient} />}
    </div>
  )
}
