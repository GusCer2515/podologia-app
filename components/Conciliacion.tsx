'use client'

import { useState } from 'react'
import {
  getAttentionsBetween,
  updateAttention,
  getConvenios,
  getSetting,
} from '@/lib/supabase'
import { showToast } from '@/components/toast'

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

// ============ Normalizadores ============
const normRut = (s: any) => String(s ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
const normName = (s: any) =>
  String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const parseMonto = (s: any) => parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10) || 0
// "01/06/2026" -> "2026-06-01"
const parseFecha = (s: any): string | null => {
  const m = String(s ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
const daysDiff = (a: string, b: string) =>
  Math.abs(new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000

interface Transfer {
  fecha: string
  rut: string
  nombre: string
  monto: number
  idTransfer: string
  match: any | null // atención conciliada
  matchTipo: 'rut' | 'nombre' | 'monto' | null
}

export default function Conciliacion() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [sinPago, setSinPago] = useState<any[]>([])
  const [processing, setProcessing] = useState(false)
  const [processed, setProcessed] = useState(false)
  const [rango, setRango] = useState('')

  const handleFile = async (file: File | null) => {
    if (!file) return
    setProcessing(true)
    setProcessed(false)

    try {
      // 1. Leer el Excel EN EL NAVEGADOR (los datos bancarios no salen de aquí)
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })

      // 2. Encontrar la fila de encabezados (contiene "Fecha" y "Monto")
      const headerIdx = rows.findIndex(
        (r) =>
          Array.isArray(r) &&
          r.some((c) => String(c ?? '').includes('Fecha')) &&
          r.some((c) => String(c ?? '').includes('Monto'))
      )
      if (headerIdx === -1) {
        showToast('No se reconoce el formato de la cartola', 'error')
        return
      }
      const header = rows[headerIdx].map((c) => String(c ?? ''))
      const col = (txt: string) => header.findIndex((h) => h.includes(txt))
      const iFecha = col('Fecha')
      const iRut = col('Rut')
      const iMonto = col('Monto')
      const iEstado = col('Estado')
      const iNombre = col('Nombre')
      const iId = col('ID')

      // 3. Extraer solo transferencias RECIBIDAS
      const parsed: Transfer[] = []
      for (const row of rows.slice(headerIdx + 1)) {
        if (!Array.isArray(row)) continue
        const fecha = parseFecha(row[iFecha])
        const monto = parseMonto(row[iMonto])
        const estado = String(row[iEstado] ?? '')
        if (!fecha || !monto || !estado.toLowerCase().includes('recibida')) continue
        parsed.push({
          fecha,
          rut: normRut(row[iRut]),
          nombre: String(row[iNombre] ?? '').trim(),
          monto,
          idTransfer: String(row[iId] ?? ''),
          match: null,
          matchTipo: null,
        })
      }

      if (parsed.length === 0) {
        showToast('No se encontraron transferencias recibidas en el archivo', 'error')
        return
      }

      // 4. Cargar atenciones del período de la cartola (± 7 días)
      const fechas = parsed.map((t) => t.fecha).sort()
      const min = new Date(fechas[0] + 'T00:00:00')
      min.setDate(min.getDate() - 7)
      const max = new Date(fechas[fechas.length - 1] + 'T00:00:00')
      max.setDate(max.getDate() + 7)
      const toIso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const [attentions, convenios, precio] = await Promise.all([
        getAttentionsBetween(toIso(min), toIso(max)),
        getConvenios().catch(() => []),
        getSetting('precio_particular').catch(() => null),
      ])
      const precioParticular = parseInt(precio ?? '30000', 10) || 30000
      const valorDe = (a: any): number => {
        if (a.valor) return a.valor
        const conv = (convenios ?? []).find((c: any) => c.nombre === a.patients?.insurance)
        return conv?.valor ?? precioParticular
      }

      // 5. Cruce: RUT → nombre → monto+fecha
      const usadas = new Set<string>()
      const disponibles = () => (attentions ?? []).filter((a: any) => !usadas.has(a.id))

      for (const t of parsed) {
        // a) Por RUT del paciente (lo más confiable)
        let candidato = disponibles().find(
          (a: any) => a.patients?.rut && normRut(a.patients.rut) === t.rut
        )
        let tipo: Transfer['matchTipo'] = candidato ? 'rut' : null

        // b) Por nombre (nombre y primer apellido presentes)
        if (!candidato) {
          const tNombre = normName(t.nombre)
          candidato = disponibles().find((a: any) => {
            const p = normName(a.patients?.name)
            if (!p || !tNombre) return false
            const partes = p.split(' ').filter((x) => x.length > 2)
            return partes.length >= 2 && partes.slice(0, 2).every((parte) => tNombre.includes(parte))
          })
          if (candidato) tipo = 'nombre'
        }

        // c) Por monto exacto + fecha cercana (± 5 días)
        if (!candidato) {
          candidato = disponibles()
            .filter((a: any) => valorDe(a) === t.monto && daysDiff(a.fecha, t.fecha) <= 5)
            .sort((a: any, b: any) => daysDiff(a.fecha, t.fecha) - daysDiff(b.fecha, t.fecha))[0]
          if (candidato) tipo = 'monto'
        }

        if (candidato) {
          usadas.add(candidato.id)
          t.match = candidato
          t.matchTipo = tipo
        }
      }

      setTransfers(parsed)
      setSinPago((attentions ?? []).filter((a: any) => !usadas.has(a.id)))
      setRango(
        `${new Date(fechas[0] + 'T00:00:00').toLocaleDateString('es-CL')} — ${new Date(
          fechas[fechas.length - 1] + 'T00:00:00'
        ).toLocaleDateString('es-CL')}`
      )
      setProcessed(true)
      showToast(`Cartola procesada: ${parsed.length} transferencias recibidas`)
    } catch (err) {
      console.error(err)
      showToast('Error leyendo el archivo. ¿Es la cartola del banco?', 'error')
    } finally {
      setProcessing(false)
    }
  }

  const toggleBoleta = async (t: Transfer) => {
    if (!t.match) return
    const nuevo = !t.match.boleta_emitida
    try {
      await updateAttention(t.match.id, { boleta_emitida: nuevo })
      t.match.boleta_emitida = nuevo
      setTransfers([...transfers])
      showToast(nuevo ? 'Boleta marcada como emitida' : 'Marca de boleta quitada')
    } catch (err) {
      console.error(err)
      showToast('Error guardando la marca', 'error')
    }
  }

  const conciliadas = transfers.filter((t) => t.match)
  const sinMatch = transfers.filter((t) => !t.match)
  const totalRecibido = transfers.reduce((s, t) => s + t.monto, 0)

  const TIPO_LABEL: Record<string, string> = {
    rut: '🎯 por RUT',
    nombre: '👤 por nombre',
    monto: '💲 por monto/fecha',
  }

  return (
    <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
      <h2 className="font-display text-2xl text-tinta font-semibold mb-1">
        🏦 Conciliación bancaria
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Sube la cartola de transferencias del banco (.xls) y se cruzará automáticamente con las
        atenciones registradas. <strong>El archivo se procesa solo en este navegador</strong> — los
        datos bancarios no se suben a ningún servidor.
      </p>

      <input
        type="file"
        accept=".xls,.xlsx,.csv"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        className="block text-sm text-gray-600 file:mr-3 file:px-5 file:py-2.5 file:rounded-full file:border-0 file:bg-tinta file:text-marfil file:font-bold file:cursor-pointer mb-4"
      />

      {processing && <p className="text-sm text-gray-500">Procesando cartola...</p>}

      {processed && (
        <div className="space-y-5">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-arena rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-tinta">{transfers.length}</p>
              <p className="text-xs text-gray-500">Transferencias ({rango})</p>
            </div>
            <div className="bg-white border border-arena rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-salvia">{conciliadas.length}</p>
              <p className="text-xs text-gray-500">Conciliadas</p>
            </div>
            <div className="bg-white border border-arena rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-rosa">{sinMatch.length}</p>
              <p className="text-xs text-gray-500">Sin match</p>
            </div>
            <div className="bg-white border border-arena rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-tinta">{fmtCLP(totalRecibido)}</p>
              <p className="text-xs text-gray-500">Total recibido</p>
            </div>
          </div>

          {/* Tabla de transferencias */}
          <div className="bg-white rounded-xl border border-arena overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-arena/50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold text-tinta">Fecha</th>
                  <th className="px-3 py-2.5 text-left font-bold text-tinta">Transferencia de</th>
                  <th className="px-3 py-2.5 text-right font-bold text-tinta">Monto</th>
                  <th className="px-3 py-2.5 text-left font-bold text-tinta">Atención conciliada</th>
                  <th className="px-3 py-2.5 text-center font-bold text-tinta">Boleta</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr
                    key={i}
                    className={`border-t border-arena/60 ${!t.match ? 'bg-rosa-palo/25' : ''}`}
                  >
                    <td className="px-3 py-2">
                      {new Date(t.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-tinta">{t.nombre || '—'}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{fmtCLP(t.monto)}</td>
                    <td className="px-3 py-2">
                      {t.match ? (
                        <span>
                          ✅ {t.match.patients?.name} ·{' '}
                          {new Date(t.match.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
                          <span className="text-xs text-gray-400"> {TIPO_LABEL[t.matchTipo!]}</span>
                        </span>
                      ) : (
                        <span className="text-rosa font-semibold">Sin atención asociada</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {t.match && (
                        <input
                          type="checkbox"
                          checked={!!t.match.boleta_emitida}
                          onChange={() => toggleBoleta(t)}
                          className="w-4 h-4 accent-[#7d8f6f] cursor-pointer"
                          title="Marcar boleta emitida"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Atenciones sin pago detectado */}
          {sinPago.length > 0 && (
            <div>
              <h3 className="font-bold text-tinta text-sm mb-2">
                ⚠️ Atenciones del período SIN transferencia detectada ({sinPago.length})
              </h3>
              <div className="bg-white rounded-xl border border-arena overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-arena/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-tinta">Fecha</th>
                      <th className="px-3 py-2 text-left font-bold text-tinta">Paciente</th>
                      <th className="px-3 py-2 text-left font-bold text-tinta">Convenio</th>
                      <th className="px-3 py-2 text-right font-bold text-tinta">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sinPago.map((a: any) => (
                      <tr key={a.id} className="border-t border-arena/60">
                        <td className="px-3 py-2">
                          {new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
                        </td>
                        <td className="px-3 py-2 font-semibold text-tinta">
                          {a.patients?.name || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {a.patients?.insurance || 'Particular'}
                        </td>
                        <td className="px-3 py-2 text-right">{fmtCLP(a.valor ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Pueden ser pagos en efectivo, por otro medio, o transferencias de otra cuenta.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
