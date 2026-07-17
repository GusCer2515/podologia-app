'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getNailServices,
  addNailService,
  updateNailService,
  deleteNailService,
  getAppointmentsBetween,
} from '@/lib/supabase'
import { showToast } from '@/components/toast'

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

const inputClass =
  'px-3 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave'

export default function NailsPage() {
  const [services, setServices] = useState<any[]>([])
  const [citasMes, setCitasMes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tablesOk, setTablesOk] = useState(true)
  // Nuevo servicio
  const [nombre, setNombre] = useState('')
  const [valor, setValor] = useState('15000')
  const [duracion, setDuracion] = useState('60')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const d = new Date()
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const [svcs, appts] = await Promise.all([
      getNailServices().catch(() => null),
      getAppointmentsBetween(`${month}-01T00:00:00`, `${month}-${last}T23:59:59`).catch(() => []),
    ])
    setTablesOk(svcs !== null)
    setServices(svcs ?? [])
    setCitasMes((appts ?? []).filter((a: any) => a.tipo === 'manicura'))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const crear = async () => {
    if (!nombre.trim()) {
      showToast('Escribe el nombre del servicio', 'error')
      return
    }
    const v = parseInt(valor, 10)
    if (isNaN(v) || v < 0) {
      showToast('Valor inválido', 'error')
      return
    }
    setSaving(true)
    try {
      await addNailService({
        nombre: nombre.trim(),
        valor: v,
        duracion_minutes: parseInt(duracion, 10) || 60,
      })
      showToast('Servicio agregado')
      setNombre('')
      setValor('15000')
      load()
    } catch (err) {
      console.error(err)
      showToast('Error agregando el servicio', 'error')
    } finally {
      setSaving(false)
    }
  }

  const realizadas = citasMes.filter((a) => a.status === 'completed')
  const agendadas = citasMes.filter((a) => a.status === 'scheduled')
  const ingresoMes = realizadas.reduce((s, a) => s + (a.valor ?? 0), 0)
  const proyeccion = agendadas.reduce((s, a) => s + (a.valor ?? 0), 0)

  if (loading) return <p className="text-gray-500 py-8 text-center">Cargando Nails...</p>

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-tinta font-medium">
          💅 Nails <span className="italic">· manicura</span>
        </h1>
        <Link
          href="/admin"
          className="bg-[#a37cc4] text-marfil px-5 py-2 rounded-full font-bold hover:opacity-90 transition shadow-lg shadow-[#a37cc4]/25"
        >
          📅 Agendar manicura en la Agenda
        </Link>
      </div>

      {!tablesOk && (
        <div className="bg-rosa-palo/60 border border-rosa/40 rounded-2xl px-5 py-4 text-sm text-tinta">
          ⚠️ <strong>Falta un paso:</strong> ejecuta{' '}
          <code className="bg-white px-2 py-0.5 rounded">supabase/fase17_nails_redes.sql</code> en
          el SQL Editor de Supabase.
        </div>
      )}

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">💅 Realizadas este mes</p>
          <p className="text-3xl font-bold text-[#a37cc4]">{realizadas.length}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">💵 Ingresos del mes</p>
          <p className="text-3xl font-bold text-salvia">{fmtCLP(ingresoMes)}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">📅 Agendadas</p>
          <p className="text-3xl font-bold text-tinta">{agendadas.length}</p>
        </div>
        <div className="bg-marfil p-4 rounded-2xl border border-arena shadow-sm">
          <p className="text-sm text-gray-500">📈 Proyección</p>
          <p className="text-3xl font-bold text-rosa">{fmtCLP(proyeccion)}</p>
        </div>
      </div>

      {/* Cómo funciona */}
      <div className="bg-[#f4eefa] border border-[#a37cc4]/30 rounded-2xl px-5 py-4 text-sm text-tinta">
        💡 <strong>Las manicuras se agendan desde 📅 Agenda</strong> (click en un cupo libre →
        elige tipo 💅 Manicura → servicio → paciente). Solo tú puedes agendarlas — el sitio
        público únicamente permite reservar podología. Los ingresos aparecen en 💰 Finanzas con
        el filtro 💅.
      </div>

      {/* ===== Servicios ===== */}
      <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
        <h2 className="font-display text-2xl text-tinta font-semibold mb-1">✨ Servicios de manicura</h2>
        <p className="text-sm text-gray-500 mb-5">
          Crea, edita o elimina tus servicios con sus valores. Aparecen al agendar una manicura.
        </p>

        {/* Agregar servicio */}
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <label className="text-xs text-gray-500 flex-1 min-w-44">
            Nombre del servicio
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crear()}
              placeholder="Ej: Esmaltado permanente francés"
              className={`block mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-gray-500">
            Valor
            <div className="flex items-center gap-1 mt-1">
              <span className="text-tinta font-bold">$</span>
              <input type="number" min={0} step={1000} value={valor} onChange={(e) => setValor(e.target.value)} className={`w-28 ${inputClass}`} />
            </div>
          </label>
          <label className="text-xs text-gray-500">
            Duración
            <select value={duracion} onChange={(e) => setDuracion(e.target.value)} className={`block mt-1 ${inputClass}`}>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
          </label>
          <button
            onClick={crear}
            disabled={saving}
            className="bg-[#a37cc4] text-marfil px-6 py-2 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            + Agregar
          </button>
        </div>

        {/* Grilla de servicios */}
        {services.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay servicios registrados</p>
        ) : (
          <div className="bg-white rounded-xl border border-arena overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-arena/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-bold text-tinta">Servicio</th>
                  <th className="px-4 py-2.5 text-left font-bold text-tinta">Valor</th>
                  <th className="px-4 py-2.5 text-left font-bold text-tinta">Duración</th>
                  <th className="px-4 py-2.5 text-right font-bold text-tinta">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <ServiceRow key={s.id} service={s} reload={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// Fila editable de servicio (nombre, valor y duración)
function ServiceRow({ service, reload }: { service: any; reload: () => void }) {
  const [nombre, setNombre] = useState(service.nombre ?? '')
  const [valor, setValor] = useState(String(service.valor ?? 0))
  const [duracion, setDuracion] = useState(String(service.duracion_minutes ?? 60))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const changed =
    nombre !== (service.nombre ?? '') ||
    valor !== String(service.valor ?? 0) ||
    duracion !== String(service.duracion_minutes ?? 60)

  const save = async () => {
    const v = parseInt(valor, 10)
    if (!nombre.trim()) {
      showToast('El nombre no puede quedar vacío', 'error')
      return
    }
    if (isNaN(v) || v < 0) {
      showToast('Valor inválido', 'error')
      return
    }
    try {
      await updateNailService(service.id, {
        nombre: nombre.trim(),
        valor: v,
        duracion_minutes: parseInt(duracion, 10) || 60,
      })
      showToast('Servicio actualizado')
      reload()
    } catch {
      showToast('Error actualizando', 'error')
    }
  }

  const toggle = async () => {
    try {
      await updateNailService(service.id, { is_active: !service.is_active })
      showToast(service.is_active ? 'Servicio desactivado' : 'Servicio activado')
      reload()
    } catch {
      showToast('Error actualizando', 'error')
    }
  }

  const remove = async () => {
    try {
      await deleteNailService(service.id)
      showToast('Servicio eliminado')
      reload()
    } catch {
      showToast('No se pudo eliminar (tiene citas asociadas) — desactívalo en su lugar', 'error')
      setConfirmDelete(false)
    }
  }

  return (
    <tr className={`border-t border-arena/60 ${!service.is_active ? 'opacity-50' : ''}`}>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span>💅</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-48 px-3 py-1.5 border border-arena rounded-xl bg-white text-sm font-semibold text-tinta focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />
        </div>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <span className="text-tinta font-bold">$</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-28 px-3 py-1.5 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />
        </div>
      </td>
      <td className="px-4 py-2">
        <select
          value={duracion}
          onChange={(e) => setDuracion(e.target.value)}
          className="px-3 py-1.5 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
        >
          <option value="30">30 min</option>
          <option value="60">60 min</option>
          <option value="90">90 min</option>
          <option value="120">120 min</option>
          <option value="150">150 min</option>
        </select>
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap">
        {changed && (
          <button
            onClick={save}
            className="bg-salvia text-marfil px-4 py-1 rounded-full text-xs font-bold hover:opacity-90 transition mr-2"
          >
            Guardar
          </button>
        )}
        <button
          onClick={toggle}
          className="bg-arena text-tinta px-3 py-1 rounded-full text-xs font-bold hover:bg-arena/70 transition mr-2"
        >
          {service.is_active ? '👁 Desactivar' : '👁 Activar'}
        </button>
        {confirmDelete ? (
          <>
            <button
              onClick={remove}
              className="bg-rosa text-marfil px-3 py-1 rounded-full text-xs font-bold hover:opacity-90 transition mr-1"
            >
              ¿Seguro?
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-gray-400 text-xs font-bold hover:text-tinta"
            >
              No
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-rosa/70 hover:text-rosa text-sm transition"
            title="Eliminar servicio"
          >
            🗑
          </button>
        )}
      </td>
    </tr>
  )
}
