'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  getAttentionsBetween,
  getAppointmentsBetween,
  getConvenios,
  getSetting,
} from '@/lib/supabase'
import Conciliacion from '@/components/Conciliacion'

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Último día del mes (YYYY-MM-DD)
function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` }
}

export default function FinancePage() {
  const [month, setMonth] = useState(currentMonth())
  const [attentions, setAttentions] = useState<any[]>([])
  const [scheduled, setScheduled] = useState<any[]>([])
  const [convenios, setConvenios] = useState<any[]>([])
  const [precioParticular, setPrecioParticular] = useState(30000)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    const { start, end } = monthRange(m)
    const [atts, appts, convs, precio] = await Promise.all([
      getAttentionsBetween(start, end).catch(() => []),
      getAppointmentsBetween(`${start}T00:00:00`, `${end}T23:59:59`).catch(() => []),
      getConvenios().catch(() => []),
      getSetting('precio_particular').catch(() => null),
    ])
    setAttentions(atts ?? [])
    setScheduled((appts ?? []).filter((a: any) => a.status === 'scheduled'))
    setConvenios(convs ?? [])
    if (precio) setPrecioParticular(parseInt(precio, 10) || 30000)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(month)
  }, [month, load])

  // Valor según convenio del paciente (o particular)
  const valueFor = (insurance?: string | null): number => {
    if (insurance) {
      const conv = convenios.find((c) => c.nombre === insurance)
      if (conv?.valor) return conv.valor
    }
    return precioParticular
  }

  const valorAtencion = (a: any): number => a.valor ?? valueFor(a.patients?.insurance)

  // ===== Cálculos =====
  const ingresoReal = attentions.reduce((sum, a) => sum + valorAtencion(a), 0)
  const proyeccion = scheduled.reduce((sum, a) => sum + valueFor(a.patients?.insurance), 0)

  // Desglose por convenio: SIEMPRE se muestran todos los convenios
  // registrados + la fila PARTICULAR (con su valor unitario configurado)
  const grupos: Record<string, { valor: number; cantidad: number; total: number }> = {}
  grupos['PARTICULAR (sin convenio)'] = { valor: precioParticular, cantidad: 0, total: 0 }
  for (const c of convenios) {
    grupos[c.nombre] = { valor: c.valor ?? precioParticular, cantidad: 0, total: 0 }
  }
  for (const a of attentions) {
    const key = a.patients?.insurance || 'PARTICULAR (sin convenio)'
    if (!grupos[key]) grupos[key] = { valor: valueFor(a.patients?.insurance), cantidad: 0, total: 0 }
    grupos[key].cantidad++
    grupos[key].total += valorAtencion(a)
  }

  const nombreMes = new Date(month + '-01T00:00:00').toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl text-tinta font-medium">
          Finanzas <span className="italic">e ingresos</span>
        </h1>
        <label className="text-sm text-gray-500">
          Mes:{' '}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 border border-arena rounded-xl bg-marfil text-sm text-tinta font-semibold focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />
        </label>
      </div>

      {loading ? (
        <p className="text-gray-500 py-8 text-center">Calculando ingresos...</p>
      ) : (
        <div className="space-y-6">
          {/* ===== Tarjetas resumen ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-marfil p-5 rounded-2xl border border-arena shadow-sm">
              <p className="text-sm text-gray-500">💵 Ingresos realizados ({nombreMes})</p>
              <p className="text-3xl font-bold text-salvia mt-1">{fmtCLP(ingresoReal)}</p>
              <p className="text-xs text-gray-400 mt-1">{attentions.length} atenciones registradas</p>
            </div>
            <div className="bg-marfil p-5 rounded-2xl border border-arena shadow-sm">
              <p className="text-sm text-gray-500">📅 Proyección (citas agendadas)</p>
              <p className="text-3xl font-bold text-tinta mt-1">{fmtCLP(proyeccion)}</p>
              <p className="text-xs text-gray-400 mt-1">{scheduled.length} citas pendientes del mes</p>
            </div>
            <div className="bg-tinta p-5 rounded-2xl shadow-sm">
              <p className="text-sm text-marfil/70">📈 Total estimado del mes</p>
              <p className="text-3xl font-bold text-marfil mt-1">{fmtCLP(ingresoReal + proyeccion)}</p>
              <p className="text-xs text-marfil/60 mt-1">realizado + proyectado</p>
            </div>
          </div>

          {/* ===== Desglose por convenio ===== */}
          <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
            <h2 className="font-display text-2xl text-tinta font-semibold mb-4">
              🤝 Ingresos por convenio
            </h2>
            {attentions.length === 0 && convenios.length === 0 ? (
              <p className="text-sm text-gray-400">
                No hay atenciones registradas este mes. Registra atenciones (con su valor) en la
                ficha de cada paciente y aparecerán aquí.
              </p>
            ) : (
              <div className="bg-white rounded-xl border border-arena overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-arena/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-bold text-tinta">Convenio</th>
                      <th className="px-4 py-2.5 text-right font-bold text-tinta">Valor atención</th>
                      <th className="px-4 py-2.5 text-right font-bold text-tinta">Atenciones</th>
                      <th className="px-4 py-2.5 text-right font-bold text-tinta">Total del mes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(grupos)
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([nombre, g]) => (
                        <tr key={nombre} className="border-t border-arena/60">
                          <td className="px-4 py-2.5 font-semibold text-tinta">{nombre}</td>
                          <td className="px-4 py-2.5 text-right text-tinta">{fmtCLP(g.valor)}</td>
                          <td className="px-4 py-2.5 text-right">{g.cantidad}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-salvia">
                            {fmtCLP(g.total)}
                          </td>
                        </tr>
                      ))}
                    <tr className="border-t-2 border-tinta/20 bg-arena/30">
                      <td className="px-4 py-2.5 font-bold text-tinta">TOTAL</td>
                      <td className="px-4 py-2.5"></td>
                      <td className="px-4 py-2.5 text-right font-bold">{attentions.length}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-tinta">
                        {fmtCLP(ingresoReal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ===== Detalle de atenciones del mes ===== */}
          <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
            <h2 className="font-display text-2xl text-tinta font-semibold mb-4">
              📝 Detalle de atenciones — {nombreMes}
            </h2>
            {attentions.length === 0 ? (
              <p className="text-sm text-gray-400">Sin atenciones este mes</p>
            ) : (
              <div className="bg-white rounded-xl border border-arena overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-arena/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-bold text-tinta">Fecha</th>
                      <th className="px-4 py-2.5 text-left font-bold text-tinta">Paciente</th>
                      <th className="px-4 py-2.5 text-left font-bold text-tinta">Convenio</th>
                      <th className="px-4 py-2.5 text-right font-bold text-tinta">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentions.map((a) => (
                      <tr key={a.id} className="border-t border-arena/60 hover:bg-rosa-palo/20">
                        <td className="px-4 py-2.5">
                          {new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-tinta">
                          {a.patients?.name || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {a.patients?.insurance || 'Particular'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold">
                          {fmtCLP(valorAtencion(a))}
                          {a.valor == null && (
                            <span className="text-xs text-gray-400 font-normal" title="Valor estimado según convenio (la atención no registró valor)">
                              {' '}*
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              * Valor estimado según convenio (atenciones antiguas sin valor registrado)
            </p>
          </section>

          {/* ===== Conciliación bancaria ===== */}
          <Conciliacion />
        </div>
      )}
    </div>
  )
}
