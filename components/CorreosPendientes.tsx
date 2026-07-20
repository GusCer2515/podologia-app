'use client'

// Citas futuras que quedaron sin correo de confirmación.
// El envío NUNCA es automático: se revisa la lista y se envía a propósito,
// porque son correos reales a pacientes reales.

import { useEffect, useState, useCallback } from 'react'
import { getPendingConfirmations } from '@/lib/supabase'
import { showToast } from '@/components/toast'

const emailValido = (e?: string) => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

interface Pendiente {
  id: string
  appointment_date: string
  tipo: string
  servicio: string | null
  patient_name: string
  patient_email: string
}

export default function CorreosPendientes() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [abierto, setAbierto] = useState(false)
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  const [enviando, setEnviando] = useState(false)
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 })

  const cargar = useCallback(() => {
    getPendingConfirmations()
      .then((data) => {
        setPendientes(data)
        // Se preseleccionan solo los que tienen correo válido
        const m: Record<string, boolean> = {}
        for (const p of data) m[p.id] = emailValido(p.patient_email)
        setMarcados(m)
      })
      .catch(() => setPendientes([]))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (pendientes.length === 0) return null

  const seleccionados = pendientes.filter((p) => marcados[p.id] && emailValido(p.patient_email))
  const sinCorreo = pendientes.filter((p) => !emailValido(p.patient_email))

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  const hora = (iso: string) => String(iso).substring(11, 16)
  const servicioDe = (p: Pendiente) =>
    p.tipo === 'manicura' ? `💅 ${p.servicio || 'Manicura'}` : '🦶 Podología'

  const enviarTodos = async () => {
    setEnviando(true)
    setProgreso({ hechos: 0, total: seleccionados.length })
    let ok = 0
    const fallidos: string[] = []

    // Uno por uno: así se ve el avance y no se satura el servicio de correo
    for (const p of seleccionados) {
      try {
        const res = await fetch('/api/notify-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: p.id, soloPaciente: true }),
        })
        const data = await res.json()
        if (data?.ok) ok++
        else fallidos.push(p.patient_name)
      } catch {
        fallidos.push(p.patient_name)
      }
      setProgreso((prev) => ({ ...prev, hechos: prev.hechos + 1 }))
    }

    setEnviando(false)
    setAbierto(false)
    cargar()

    if (fallidos.length === 0) {
      showToast(`${ok} correo${ok === 1 ? '' : 's'} de confirmación enviado${ok === 1 ? '' : 's'}`)
    } else {
      showToast(`${ok} enviados · ${fallidos.length} fallaron (${fallidos.slice(0, 2).join(', ')}…)`, 'error')
    }
  }

  return (
    <>
      {/* Aviso discreto sobre la agenda */}
      <div className="mb-4 bg-[#d9a441]/10 border border-[#d9a441]/40 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta">
          📧 <strong>{pendientes.length} cita{pendientes.length === 1 ? '' : 's'} futura
          {pendientes.length === 1 ? '' : 's'}</strong> sin correo de confirmación enviado.
        </p>
        <button
          onClick={() => setAbierto(true)}
          className="bg-[#d9a441] text-white px-5 py-2 rounded-full text-sm font-bold hover:opacity-90 transition"
        >
          Revisar y enviar
        </button>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-2xl w-full p-7 animate-fade-up max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-2xl text-tinta font-semibold">
              📧 Enviar confirmaciones pendientes
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Son correos reales a pacientes. Revisa la lista y desmarca los que no quieras
              avisar. Solo aparecen las citas <strong>futuras</strong>: avisar de una hora que
              ya pasó solo confundiría al paciente.
            </p>

            <div className="mt-4 space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {pendientes.map((p) => {
                const valido = emailValido(p.patient_email)
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm transition ${
                      !valido
                        ? 'bg-arena/40 border-arena opacity-70'
                        : marcados[p.id]
                        ? 'bg-salvia/10 border-salvia/50 cursor-pointer'
                        : 'bg-white border-arena cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!valido}
                      checked={!!marcados[p.id] && valido}
                      onChange={() => setMarcados((m) => ({ ...m, [p.id]: !m[p.id] }))}
                      className="w-4 h-4 accent-[#7d8f6f]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-tinta truncate">
                        {p.patient_name}{' '}
                        <span className="font-normal text-gray-500">· {servicioDe(p)}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {fmt(p.appointment_date)} · {hora(p.appointment_date)} hrs ·{' '}
                        {valido ? (
                          p.patient_email
                        ) : (
                          <span className="text-rosa font-semibold">sin correo válido</span>
                        )}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>

            {sinCorreo.length > 0 && (
              <p className="mt-3 text-xs text-gray-500 bg-arena/40 rounded-xl px-4 py-2">
                ⚠️ {sinCorreo.length} paciente{sinCorreo.length === 1 ? '' : 's'} sin correo
                válido. Agrégalo en su ficha y vuelve aquí, o avísale por WhatsApp.
              </p>
            )}

            {enviando && (
              <p className="mt-3 text-sm text-tinta font-semibold text-center">
                Enviando {progreso.hechos} de {progreso.total}...
              </p>
            )}

            <button
              onClick={enviarTodos}
              disabled={enviando || seleccionados.length === 0}
              className="mt-4 w-full bg-salvia text-marfil py-3 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {enviando
                ? 'Enviando...'
                : seleccionados.length === 0
                ? 'No hay nada seleccionado'
                : `📧 Enviar ${seleccionados.length} correo${seleccionados.length === 1 ? '' : 's'}`}
            </button>
            <button
              onClick={() => setAbierto(false)}
              disabled={enviando}
              className="mt-2 w-full py-2.5 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
