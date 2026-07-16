'use client'

import { useEffect, useState } from 'react'
import {
  getAllAvailability,
  saveAvailability,
  getBlockouts,
  addBlockout,
  deleteBlockout,
  getConvenios,
  addConvenio,
  updateConvenio,
  deleteConvenio,
  getSetting,
  saveSetting,
} from '@/lib/supabase'
import { showToast } from '@/components/toast'
import { CLINIC, getClinicInfo, clearClinicInfoCache, type ClinicInfo } from '@/lib/clinicConfig'

// day_of_week: 0=Domingo ... 6=Sábado (orden visual Lun→Dom)
const DIAS = [
  { dow: 1, nombre: 'Lunes' },
  { dow: 2, nombre: 'Martes' },
  { dow: 3, nombre: 'Miércoles' },
  { dow: 4, nombre: 'Jueves' },
  { dow: 5, nombre: 'Viernes' },
  { dow: 6, nombre: 'Sábado' },
  { dow: 0, nombre: 'Domingo' },
]

type DayConfig = {
  is_active: boolean
  start_time: string
  end_time: string
  slot_duration_minutes: number
}

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

export default function SettingsPage() {
  const [days, setDays] = useState<Record<number, DayConfig>>({})
  const [blockouts, setBlockouts] = useState<any[]>([])
  const [convenios, setConvenios] = useState<any[]>([])
  const [conveniosOk, setConveniosOk] = useState(true)
  const [precioParticular, setPrecioParticular] = useState('30000')
  const [loading, setLoading] = useState(true)
  const [savingHours, setSavingHours] = useState(false)
  const [savingPrecio, setSavingPrecio] = useState(false)
  const [newBlockDate, setNewBlockDate] = useState('')
  const [newBlockNote, setNewBlockNote] = useState('')
  const [newConvenio, setNewConvenio] = useState('')
  const [newConvenioValor, setNewConvenioValor] = useState('25000')

  const load = async () => {
    // Cada recurso se carga por separado: si uno falla, el resto funciona
    const [avail, blocks, convs, precio] = await Promise.all([
      getAllAvailability().catch(() => []),
      getBlockouts().catch(() => []),
      getConvenios().catch(() => null), // null = tabla no existe aún
      getSetting('precio_particular').catch(() => null),
    ])

    const map: Record<number, DayConfig> = {}
    for (const d of DIAS) {
      const row = (avail ?? []).find((a: any) => a.day_of_week === d.dow)
      map[d.dow] = {
        is_active: row?.is_active ?? false,
        start_time: row?.start_time?.substring(0, 5) ?? '09:00',
        end_time: row?.end_time?.substring(0, 5) ?? '18:00',
        slot_duration_minutes: row?.slot_duration_minutes ?? 30,
      }
    }
    setDays(map)
    setBlockouts(blocks ?? [])
    setConveniosOk(convs !== null)
    setConvenios(convs ?? [])
    if (precio) setPrecioParticular(precio)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setDay = (dow: number, field: keyof DayConfig, value: any) =>
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }))

  const saveHours = async () => {
    for (const d of DIAS) {
      const c = days[d.dow]
      if (c?.is_active && c.start_time >= c.end_time) {
        showToast(`${d.nombre}: la hora de inicio debe ser antes que la de término`, 'error')
        return
      }
    }
    setSavingHours(true)
    try {
      for (const d of DIAS) {
        const c = days[d.dow]
        if (!c) continue
        await saveAvailability(d.dow, {
          is_active: c.is_active,
          start_time: c.start_time,
          end_time: c.end_time,
          slot_duration_minutes: c.slot_duration_minutes,
        })
      }
      showToast('Horarios guardados correctamente')
    } catch (err) {
      console.error(err)
      showToast('Error guardando los horarios', 'error')
    } finally {
      setSavingHours(false)
    }
  }

  const savePrecioParticular = async () => {
    const valor = parseInt(precioParticular, 10)
    if (isNaN(valor) || valor <= 0) {
      showToast('Ingresa un valor válido', 'error')
      return
    }
    setSavingPrecio(true)
    try {
      await saveSetting('precio_particular', String(valor))
      showToast('Valor particular guardado')
    } catch (err) {
      console.error(err)
      showToast('Error guardando el valor (¿ejecutaste el SQL de fase 7?)', 'error')
    } finally {
      setSavingPrecio(false)
    }
  }

  const handleAddBlockout = async () => {
    if (!newBlockDate) {
      showToast('Selecciona la fecha a bloquear', 'error')
      return
    }
    try {
      await addBlockout({ blocked_date: newBlockDate, notes: newBlockNote || null })
      showToast('Día bloqueado')
      setNewBlockDate('')
      setNewBlockNote('')
      load()
    } catch (err) {
      console.error(err)
      showToast('Error bloqueando el día', 'error')
    }
  }

  const handleDeleteBlockout = async (id: string) => {
    try {
      await deleteBlockout(id)
      showToast('Bloqueo eliminado')
      load()
    } catch (err) {
      console.error(err)
      showToast('Error eliminando el bloqueo', 'error')
    }
  }

  const handleAddConvenio = async () => {
    const nombre = newConvenio.trim().toUpperCase()
    const valor = parseInt(newConvenioValor, 10)
    if (!nombre) {
      showToast('Escribe el nombre del convenio', 'error')
      return
    }
    if (isNaN(valor) || valor <= 0) {
      showToast('Ingresa un valor válido para el convenio', 'error')
      return
    }
    try {
      await addConvenio(nombre, valor)
      showToast('Convenio agregado')
      setNewConvenio('')
      setNewConvenioValor('25000')
      load()
    } catch (err: any) {
      console.error(err)
      const msg = String(err?.message || '')
      if (err?.code === '23505') {
        showToast('Ese convenio ya existe', 'error')
      } else if (err?.code === '42703' || msg.includes('valor')) {
        showToast('Falta actualizar la BD: ejecuta supabase/fase7_convenios.sql en Supabase', 'error')
      } else if (err?.code === '42P01') {
        showToast('La tabla convenios no existe: ejecuta supabase/fase7_convenios.sql', 'error')
      } else {
        showToast(`Error agregando convenio: ${msg || 'desconocido'}`, 'error')
      }
    }
  }

  const handleUpdateConvenioValor = async (id: string, valorStr: string) => {
    const valor = parseInt(valorStr, 10)
    if (isNaN(valor) || valor <= 0) {
      showToast('Valor inválido', 'error')
      return
    }
    try {
      await updateConvenio(id, { valor })
      showToast('Valor del convenio actualizado')
      load()
    } catch (err) {
      console.error(err)
      showToast('Error actualizando el valor', 'error')
    }
  }

  const handleDeleteConvenio = async (id: string) => {
    try {
      await deleteConvenio(id)
      showToast('Convenio eliminado')
      load()
    } catch (err) {
      console.error(err)
      showToast('Error eliminando el convenio', 'error')
    }
  }

  if (loading) return <p className="text-gray-500 py-8 text-center">Cargando configuración...</p>

  const inputClass =
    'px-3 py-1.5 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave'

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="font-display text-3xl text-tinta font-medium">
        Configuración <span className="italic">del negocio</span>
      </h1>

      {/* Aviso si falta el SQL */}
      {!conveniosOk && (
        <div className="bg-rosa-palo/60 border border-rosa/40 rounded-2xl px-5 py-4 text-sm text-tinta">
          ⚠️ <strong>Falta un paso:</strong> ejecuta el script{' '}
          <code className="bg-white px-2 py-0.5 rounded">supabase/fase7_convenios.sql</code> en el
          SQL Editor de Supabase para activar Convenios y Valores.
        </div>
      )}

      {/* ================= DATOS DE CONTACTO ================= */}
      <ContactosSection />

      {/* ================= HORARIOS ================= */}
      <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
        <h2 className="font-display text-2xl text-tinta font-semibold mb-1">🕐 Horarios de atención</h2>
        <p className="text-sm text-gray-500 mb-5">
          Define qué días atiendes y en qué horario. Esto controla las horas que ven los
          pacientes al agendar.
        </p>

        <div className="space-y-2">
          {DIAS.map((d) => {
            const c = days[d.dow]
            if (!c) return null
            return (
              <div
                key={d.dow}
                className={`flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border ${
                  c.is_active ? 'border-salvia/40 bg-white' : 'border-arena bg-arena/30 opacity-70'
                }`}
              >
                <label className="flex items-center gap-2 w-32 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.is_active}
                    onChange={(e) => setDay(d.dow, 'is_active', e.target.checked)}
                    className="w-4 h-4 accent-[#33506e]"
                  />
                  <span className="font-semibold text-tinta text-sm">{d.nombre}</span>
                </label>

                {c.is_active ? (
                  <>
                    <label className="text-xs text-gray-500">
                      Desde{' '}
                      <input
                        type="time"
                        value={c.start_time}
                        onChange={(e) => setDay(d.dow, 'start_time', e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Hasta{' '}
                      <input
                        type="time"
                        value={c.end_time}
                        onChange={(e) => setDay(d.dow, 'end_time', e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Duración cita{' '}
                      <select
                        value={c.slot_duration_minutes}
                        onChange={(e) => setDay(d.dow, 'slot_duration_minutes', Number(e.target.value))}
                        className={inputClass}
                      >
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <span className="text-sm text-gray-400">Sin atención</span>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={saveHours}
          disabled={savingHours}
          className="mt-5 bg-tinta text-marfil px-8 py-2.5 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
        >
          {savingHours ? 'Guardando...' : '💾 Guardar horarios'}
        </button>
      </section>

      {/* ================= VALORES DE ATENCIÓN ================= */}
      <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
        <h2 className="font-display text-2xl text-tinta font-semibold mb-1">💰 Valores de atención</h2>
        <p className="text-sm text-gray-500 mb-5">
          Estos valores se usarán al registrar atenciones y para el flujo de caja.
        </p>

        <div className="flex flex-wrap items-end gap-3 bg-white border border-arena rounded-xl px-4 py-3">
          <label className="text-xs text-gray-500">
            Atención particular (sin convenio)
            <div className="flex items-center gap-1 mt-1">
              <span className="text-tinta font-bold">$</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={precioParticular}
                onChange={(e) => setPrecioParticular(e.target.value)}
                className={`w-32 ${inputClass}`}
              />
            </div>
          </label>
          <button
            onClick={savePrecioParticular}
            disabled={savingPrecio}
            className="bg-tinta text-marfil px-6 py-2 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
          >
            {savingPrecio ? 'Guardando...' : 'Guardar'}
          </button>
          <p className="text-xs text-gray-400 w-full">
            Valor actual: <strong className="text-tinta">{fmtCLP(parseInt(precioParticular, 10) || 0)}</strong>
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          💡 El valor de cada convenio se edita en la sección Convenios (abajo).
        </p>
      </section>

      {/* ================= DÍAS BLOQUEADOS ================= */}
      <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
        <h2 className="font-display text-2xl text-tinta font-semibold mb-1">🚫 Días bloqueados</h2>
        <p className="text-sm text-gray-500 mb-5">
          Feriados, vacaciones o días puntuales sin atención (aunque el día de semana esté activo).
        </p>

        <div className="flex flex-wrap items-end gap-3 mb-5">
          <label className="text-xs text-gray-500">
            Fecha
            <input
              type="date"
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
              className={`block mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-xs text-gray-500 flex-1 min-w-40">
            Motivo (opcional)
            <input
              type="text"
              value={newBlockNote}
              onChange={(e) => setNewBlockNote(e.target.value)}
              placeholder="Ej: Feriado, vacaciones..."
              className={`block mt-1 w-full ${inputClass}`}
            />
          </label>
          <button
            onClick={handleAddBlockout}
            className="bg-rosa text-marfil px-6 py-2 rounded-full font-bold hover:opacity-90 transition"
          >
            Bloquear día
          </button>
        </div>

        {blockouts.length === 0 ? (
          <p className="text-sm text-gray-400">No hay días bloqueados</p>
        ) : (
          <div className="space-y-1.5">
            {blockouts
              .slice()
              .sort((a, b) => String(b.blocked_date).localeCompare(String(a.blocked_date)))
              .map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-4 py-2 rounded-xl bg-white border border-arena text-sm"
                >
                  <span>
                    <strong className="text-tinta">
                      {new Date(b.blocked_date + 'T00:00:00').toLocaleDateString('es-CL', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </strong>
                    {b.notes ? ` — ${b.notes}` : ''}
                  </span>
                  <button
                    onClick={() => handleDeleteBlockout(b.id)}
                    className="text-rosa hover:bg-rosa-palo/50 rounded-full px-2 py-1 transition"
                    title="Eliminar bloqueo"
                  >
                    🗑
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ================= CONVENIOS ================= */}
      <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
        <h2 className="font-display text-2xl text-tinta font-semibold mb-1">🤝 Convenios / Previsión</h2>
        <p className="text-sm text-gray-500 mb-5">
          Cada convenio tiene su valor de atención. Aparecen como opciones en la ficha del paciente.
        </p>

        <div className="flex flex-wrap items-end gap-3 mb-5">
          <label className="text-xs text-gray-500 flex-1 min-w-44">
            Nombre del convenio
            <input
              type="text"
              value={newConvenio}
              onChange={(e) => setNewConvenio(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddConvenio()}
              placeholder="Ej: FONASA, CONVENIO DMH..."
              className={`block mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-gray-500">
            Valor atención
            <div className="flex items-center gap-1 mt-1">
              <span className="text-tinta font-bold">$</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={newConvenioValor}
                onChange={(e) => setNewConvenioValor(e.target.value)}
                className={`w-28 ${inputClass}`}
              />
            </div>
          </label>
          <button
            onClick={handleAddConvenio}
            className="bg-tinta text-marfil px-6 py-2 rounded-full font-bold hover:bg-tinta-suave transition"
          >
            + Agregar
          </button>
        </div>

        {convenios.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay convenios registrados</p>
        ) : (
          <div className="bg-white rounded-xl border border-arena overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-arena/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-bold text-tinta">Convenio</th>
                  <th className="px-4 py-2.5 text-left font-bold text-tinta">Valor atención</th>
                  <th className="px-4 py-2.5 text-right font-bold text-tinta">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {convenios.map((c) => (
                  <ConvenioRow
                    key={c.id}
                    convenio={c}
                    onSave={handleUpdateConvenioValor}
                    onDelete={handleDeleteConvenio}
                    inputClass={inputClass}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// Sección de datos de contacto del negocio (sitio, WhatsApp, PDFs)
function ContactosSection() {
  const [info, setInfo] = useState<ClinicInfo>(CLINIC)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getClinicInfo()
      .then(setInfo)
      .finally(() => setLoaded(true))
  }, [])

  const set = (key: keyof ClinicInfo) => (e: any) =>
    setInfo((prev) => ({ ...prev, [key]: e.target.value }))

  const guardar = async () => {
    if (!info.phone.trim() || !info.email.trim()) {
      showToast('Teléfono y correo son obligatorios', 'error')
      return
    }
    setSaving(true)
    try {
      const { professional, rut, instagram, phone, email } = info
      await saveSetting(
        'clinic_info',
        JSON.stringify({
          professional: professional.trim(),
          rut: rut.trim(),
          instagram: instagram.trim().startsWith('@') ? instagram.trim() : `@${instagram.trim()}`,
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
        })
      )
      clearClinicInfoCache()
      showToast('Datos de contacto actualizados')
    } catch (err) {
      console.error(err)
      showToast('Error guardando los datos (¿ejecutaste fase13?)', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave'

  return (
    <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
      <h2 className="font-display text-2xl text-tinta font-semibold mb-1">📞 Datos del negocio</h2>
      <p className="text-sm text-gray-500 mb-5">
        Estos datos se muestran en el sitio público, los mensajes de WhatsApp y los PDFs de
        recetas e indicaciones.
      </p>

      {!loaded ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-gray-600">
              Nombre de la profesional
              <input value={info.professional} onChange={set('professional')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              RUT de la profesional
              <input value={info.rut} onChange={set('rut')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Teléfono / WhatsApp (con +56)
              <input value={info.phone} onChange={set('phone')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Correo del negocio
              <input value={info.email} onChange={set('email')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Instagram (con @)
              <input value={info.instagram} onChange={set('instagram')} className={`mt-1 ${inputClass}`} />
            </label>
          </div>

          <button
            onClick={guardar}
            disabled={saving}
            className="mt-5 bg-tinta text-marfil px-8 py-2.5 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar datos de contacto'}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Los PDFs ya emitidos no cambian (quedan como se firmaron); los nuevos usarán estos datos.
          </p>
        </>
      )}
    </section>
  )
}

// Fila de convenio con valor editable (fila de tabla)
function ConvenioRow({
  convenio,
  onSave,
  onDelete,
  inputClass,
}: {
  convenio: any
  onSave: (id: string, valor: string) => void
  onDelete: (id: string) => void
  inputClass: string
}) {
  const [valor, setValor] = useState(String(convenio.valor ?? 25000))
  const changed = valor !== String(convenio.valor ?? 25000)

  return (
    <tr className="border-t border-arena/60 hover:bg-rosa-palo/20">
      <td className="px-4 py-2 font-semibold text-tinta">{convenio.nombre}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <span className="text-tinta font-bold">$</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={`w-28 ${inputClass}`}
          />
          {changed && (
            <button
              onClick={() => onSave(convenio.id, valor)}
              className="ml-2 bg-salvia text-marfil px-4 py-1 rounded-full text-xs font-bold hover:opacity-90 transition"
            >
              Guardar
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        <button
          onClick={() => onDelete(convenio.id)}
          className="text-rosa hover:bg-rosa-palo/50 rounded-full px-2.5 py-1 transition text-sm font-semibold"
          title="Eliminar convenio"
        >
          🗑 Eliminar
        </button>
      </td>
    </tr>
  )
}
