'use client'

import { useEffect, useState } from 'react'
import { waPhone, esWaValido } from '@/lib/phone'
import {
  getAllAvailability,
  saveDayBlocks,
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
import { getAppointmentsBetween } from '@/lib/supabase'
import ReagendarWizard from '@/components/ReagendarWizard'
import { clearBuffersCache } from '@/lib/slots'

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
  bloques: { start_time: string; end_time: string }[]
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
  // Los horarios quedan bloqueados: hay que desbloquear a propósito para editarlos
  const [horariosBloqueados, setHorariosBloqueados] = useState(true)
  // Tiempos de preparación entre atenciones
  const [bufPod, setBufPod] = useState('15')
  const [bufMan, setBufMan] = useState('10')
  const [savingBuffers, setSavingBuffers] = useState(false)
  // Horas fijas ofrecidas en el sitio público
  const [horasPublicas, setHorasPublicas] = useState(
    '08:30,09:00,09:15,10:45,11:45,15:30,16:00,16:45,17:45,18:45,19:45'
  )
  const [savingHorasPub, setSavingHorasPub] = useState(false)
  const [savingPrecio, setSavingPrecio] = useState(false)
  const [newBlockDate, setNewBlockDate] = useState('')
  const [newBlockNote, setNewBlockNote] = useState('')
  const [newConvenio, setNewConvenio] = useState('')
  const [newConvenioValor, setNewConvenioValor] = useState('25000')
  // Wizard de reagendamiento al bloquear un día con citas
  const [wizard, setWizard] = useState<{ date: string; items: any[] } | null>(null)

  const load = async () => {
    // Cada recurso se carga por separado: si uno falla, el resto funciona
    const [avail, blocks, convs, precio, bp, bm, hp] = await Promise.all([
      getAllAvailability().catch(() => []),
      getBlockouts().catch(() => []),
      getConvenios().catch(() => null), // null = tabla no existe aún
      getSetting('precio_particular').catch(() => null),
      getSetting('buffer_podologia').catch(() => null),
      getSetting('buffer_manicura').catch(() => null),
      getSetting('public_slots').catch(() => null),
    ])
    if (bp) setBufPod(bp)
    if (bm) setBufMan(bm)
    if (hp) setHorasPublicas(hp)

    const map: Record<number, DayConfig> = {}
    for (const d of DIAS) {
      const filas = (avail ?? [])
        .filter((a: any) => a.day_of_week === d.dow && a.is_active !== false)
        .map((a: any) => ({
          start_time: String(a.start_time).substring(0, 5),
          end_time: String(a.end_time).substring(0, 5),
        }))
        .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
      map[d.dow] = {
        is_active: filas.length > 0,
        bloques: filas.length > 0 ? filas : [{ start_time: '09:00', end_time: '18:00' }],
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

  // Editar un bloque puntual del día
  const setBloque = (dow: number, idx: number, campo: 'start_time' | 'end_time', valor: string) =>
    setDays((prev) => {
      const bloques = prev[dow].bloques.map((b, i) => (i === idx ? { ...b, [campo]: valor } : b))
      return { ...prev, [dow]: { ...prev[dow], bloques } }
    })

  const addBloque = (dow: number) =>
    setDays((prev) => {
      const ultimo = prev[dow].bloques[prev[dow].bloques.length - 1]
      const nuevo = ultimo
        ? { start_time: ultimo.end_time, end_time: '21:30' }
        : { start_time: '09:00', end_time: '13:00' }
      return { ...prev, [dow]: { ...prev[dow], bloques: [...prev[dow].bloques, nuevo] } }
    })

  const removeBloque = (dow: number, idx: number) =>
    setDays((prev) => ({
      ...prev,
      [dow]: { ...prev[dow], bloques: prev[dow].bloques.filter((_, i) => i !== idx) },
    }))

  const saveHours = async () => {
    // Validaciones: horas coherentes y bloques que no se pisen
    for (const d of DIAS) {
      const c = days[d.dow]
      if (!c?.is_active) continue
      if (c.bloques.length === 0) {
        showToast(`${d.nombre}: agrega al menos un bloque o desactiva el día`, 'error')
        return
      }
      for (const b of c.bloques) {
        if (b.start_time >= b.end_time) {
          showToast(`${d.nombre}: el bloque ${b.start_time}–${b.end_time} está invertido`, 'error')
          return
        }
      }
      const orden = [...c.bloques].sort((a, b) => a.start_time.localeCompare(b.start_time))
      for (let i = 1; i < orden.length; i++) {
        if (orden[i].start_time < orden[i - 1].end_time) {
          showToast(`${d.nombre}: hay bloques que se superponen`, 'error')
          return
        }
      }
    }

    setSavingHours(true)
    try {
      for (const d of DIAS) {
        const c = days[d.dow]
        if (!c) continue
        await saveDayBlocks(d.dow, c.is_active ? c.bloques : [])
      }
      showToast('Horarios guardados correctamente')
    } catch (err) {
      console.error(err)
      showToast('Error guardando los horarios', 'error')
    } finally {
      setSavingHours(false)
    }
  }

  const saveHorasPublicas = async () => {
    const lista = horasPublicas
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (lista.length === 0 || lista.some((h) => !/^\d{1,2}:\d{2}$/.test(h))) {
      showToast('Usa el formato HH:MM separado por comas (ej: 08:30,09:00)', 'error')
      return
    }
    setSavingHorasPub(true)
    try {
      const ordenadas = lista
        .map((h) => (h.length === 4 ? `0${h}` : h))
        .sort()
      await saveSetting('public_slots', ordenadas.join(','))
      setHorasPublicas(ordenadas.join(','))
      showToast('Horas del sitio público guardadas')
    } catch (err) {
      console.error(err)
      showToast('Error guardando (¿ejecutaste el SQL de fase 25?)', 'error')
    } finally {
      setSavingHorasPub(false)
    }
  }

  const saveBuffers = async () => {
    const p = parseInt(bufPod, 10)
    const m = parseInt(bufMan, 10)
    if (isNaN(p) || p < 0 || isNaN(m) || m < 0) {
      showToast('Ingresa minutos válidos', 'error')
      return
    }
    setSavingBuffers(true)
    try {
      await saveSetting('buffer_podologia', String(p))
      await saveSetting('buffer_manicura', String(m))
      clearBuffersCache()
      showToast('Tiempos de preparación guardados')
    } catch (err) {
      console.error(err)
      showToast('Error guardando (¿ejecutaste el SQL de fase 22?)', 'error')
    } finally {
      setSavingBuffers(false)
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

      // ¿Había citas agendadas ese día? → wizard de reagendamiento
      const appts = await getAppointmentsBetween(
        `${newBlockDate}T00:00:00`,
        `${newBlockDate}T23:59:59`
      ).catch(() => [])
      const activas = (appts ?? []).filter((a: any) => a.status === 'scheduled')
      if (activas.length > 0) {
        setWizard({ date: newBlockDate, items: activas })
      }

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

      {/* Wizard de reagendamiento tras bloquear un día con citas */}
      {wizard && (
        <ReagendarWizard
          date={wizard.date}
          items={wizard.items}
          onClose={() => setWizard(null)}
        />
      )}

      {/* ================= DATOS DE CONTACTO ================= */}
      <ContactosSection />

      {/* ================= HORARIOS ================= */}
      <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h2 className="font-display text-2xl text-tinta font-semibold">🕐 Horarios de atención</h2>
          <button
            onClick={() => setHorariosBloqueados(!horariosBloqueados)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              horariosBloqueados
                ? 'bg-arena text-tinta hover:bg-arena/70'
                : 'bg-rosa text-marfil hover:opacity-90'
            }`}
          >
            {horariosBloqueados ? '🔒 Bloqueado · desbloquear para editar' : '🔓 Editando · volver a bloquear'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Define qué días atiendes y en qué <strong>bloques de horario</strong>. Puedes tener
          varios bloques por día (ej: 08:30–13:00 y 15:30–21:00); el espacio entre ellos queda
          sin atención. Cada podología dura 1 hora; las manicuras usan la duración de su
          servicio. Esto controla las horas que ves tú y las que ven los pacientes en la web.
          {horariosBloqueados && (
            <span className="block mt-1 text-tinta font-semibold">
              🔒 Los horarios están protegidos para que no se cambien por accidente. Usa el botón
              de arriba si necesitas modificarlos.
            </span>
          )}
        </p>

        <div className="space-y-2">
          {DIAS.map((d) => {
            const c = days[d.dow]
            if (!c) return null
            return (
              <div
                key={d.dow}
                className={`px-4 py-3 rounded-xl border ${
                  c.is_active ? 'border-salvia/40 bg-white' : 'border-arena bg-arena/30 opacity-70'
                }`}
              >
                <div className="flex flex-wrap items-start gap-4">
                  <label className="flex items-center gap-2 w-32 cursor-pointer pt-1.5">
                    <input
                      type="checkbox"
                      checked={c.is_active}
                      onChange={(e) => setDay(d.dow, 'is_active', e.target.checked)}
                      disabled={horariosBloqueados}
                      className="w-4 h-4 accent-[#33506e] disabled:opacity-50"
                    />
                    <span className="font-semibold text-tinta text-sm">{d.nombre}</span>
                  </label>

                  {c.is_active ? (
                    <div className="flex-1 space-y-2">
                      {c.bloques.map((b, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-tinta-suave w-16">
                            Bloque {idx + 1}
                          </span>
                          <input
                            type="time"
                            value={b.start_time}
                            onChange={(e) => setBloque(d.dow, idx, 'start_time', e.target.value)}
                            disabled={horariosBloqueados}
                            className={`${inputClass} disabled:bg-arena/40 disabled:text-gray-500`}
                          />
                          <span className="text-gray-400 text-sm">a</span>
                          <input
                            type="time"
                            value={b.end_time}
                            onChange={(e) => setBloque(d.dow, idx, 'end_time', e.target.value)}
                            disabled={horariosBloqueados}
                            className={`${inputClass} disabled:bg-arena/40 disabled:text-gray-500`}
                          />
                          {c.bloques.length > 1 && !horariosBloqueados && (
                            <button
                              onClick={() => removeBloque(d.dow, idx)}
                              className="text-rosa/70 hover:text-rosa hover:bg-rosa-palo/50 rounded-full px-2 py-1 text-sm transition"
                              title="Quitar este bloque"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      ))}
                      {!horariosBloqueados && (
                      <button
                        onClick={() => addBloque(d.dow)}
                        className="text-xs font-bold text-tinta border border-dashed border-arena rounded-full px-4 py-1.5 hover:border-tinta-suave hover:bg-rosa-palo/20 transition"
                      >
                        + Agregar bloque
                      </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 pt-1.5">Sin atención</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={saveHours}
          disabled={savingHours || horariosBloqueados}
          className="mt-5 bg-tinta text-marfil px-8 py-2.5 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
        >
          {savingHours ? 'Guardando...' : '💾 Guardar horarios'}
        </button>

        {/* Horas fijas que se ofrecen en el sitio público */}
        <div className="mt-6 pt-5 border-t border-arena">
          <p className="font-bold text-tinta text-sm">🌐 Horas que ven los pacientes en la web</p>
          <p className="text-xs text-gray-500 mb-3">
            Lista fija de horas de inicio que se ofrecen en el sitio (podología). De estas, el
            paciente solo verá las que estén realmente libres ese día. Sepáralas con coma.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <input
              type="text"
              value={horasPublicas}
              onChange={(e) => setHorasPublicas(e.target.value)}
              disabled={horariosBloqueados}
              placeholder="08:30,09:00,10:45,15:30..."
              className={`flex-1 min-w-72 ${inputClass} disabled:bg-arena/40 disabled:text-gray-500`}
            />
            <button
              onClick={saveHorasPublicas}
              disabled={savingHorasPub || horariosBloqueados}
              className="bg-salvia text-marfil px-6 py-2 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {savingHorasPub ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Tiempo de preparación entre atenciones */}
        <div className="mt-6 pt-5 border-t border-arena">
          <p className="font-bold text-tinta text-sm">🧼 Tiempo de preparación entre atenciones</p>
          <p className="text-xs text-gray-500 mb-3">
            Minutos que quedan reservados después de cada atención para limpiar y preparar la
            consulta. Nadie puede tomar hora en ese rato.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-500">
              🦶 Después de podología
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={bufPod}
                  onChange={(e) => setBufPod(e.target.value)}
                  className={`w-20 ${inputClass}`}
                />
                <span className="text-tinta font-semibold">min</span>
              </div>
            </label>
            <label className="text-xs text-gray-500">
              💅 Después de manicura
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={bufMan}
                  onChange={(e) => setBufMan(e.target.value)}
                  className={`w-20 ${inputClass}`}
                />
                <span className="text-tinta font-semibold">min</span>
              </div>
            </label>
            <button
              onClick={saveBuffers}
              disabled={savingBuffers}
              className="bg-salvia text-marfil px-6 py-2 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {savingBuffers ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
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
    // Sin el +56 completo, los enlaces de WhatsApp del sitio abren un chat
    // equivocado en vez del de la clínica
    if (!esWaValido(info.phone)) {
      showToast('El teléfono debe ser un celular chileno, ej: +56944187670', 'error')
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
          phone: '+' + waPhone(phone),
          email: email.trim().toLowerCase(),
          notifyEmail: ((info as any).notifyEmail || '').trim().toLowerCase(),
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
              <span className={`block mt-1 font-normal ${esWaValido(info.phone) ? 'text-gray-400' : 'text-rosa'}`}>
                {esWaValido(info.phone)
                  ? `Los botones de WhatsApp del sitio abrirán wa.me/${waPhone(info.phone)}`
                  : 'Debe incluir el +56, si no los botones de WhatsApp abrirán un chat equivocado'}
              </span>
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Correo del negocio (público)
              <input value={info.email} onChange={set('email')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Instagram (con @)
              <input value={info.instagram} onChange={set('instagram')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-xs font-semibold text-gray-600 sm:col-span-2">
              📬 Correo para avisos de reserva (donde llegan las notificaciones de nuevas horas)
              <input
                value={(info as any).notifyEmail || ''}
                onChange={set('notifyEmail' as any)}
                placeholder="Si lo dejas vacío, se usa el correo del negocio"
                className={`mt-1 ${inputClass}`}
              />
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
