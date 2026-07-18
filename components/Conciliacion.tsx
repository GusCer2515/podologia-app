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
const parseFecha = (s: any): string | null => {
  const m = String(s ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
const daysDiff = (a: string, b: string) =>
  Math.abs(new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000
const fmtDia = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('es-CL')

interface Transfer {
  key: string
  fecha: string
  rut: string
  nombre: string
  monto: number
}

export default function Conciliacion() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [attentions, setAttentions] = useState<any[]>([])
  const [sugerencias, setSugerencias] = useState<Record<string, string>>({})
  const [valores, setValores] = useState<{ convenios: any[]; particular: number }>({
    convenios: [],
    particular: 30000,
  })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processed, setProcessed] = useState(false)
  const [exportando, setExportando] = useState(false)

  // ============ Lectura de la cartola (100% en el navegador) ============
  const handleFile = async (file: File | null) => {
    if (!file) return
    setProcessing(true)
    setProcessed(false)
    setSelectedKey(null)

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })

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

      const parsed: Transfer[] = []
      for (const row of rows.slice(headerIdx + 1)) {
        if (!Array.isArray(row)) continue
        const fecha = parseFecha(row[iFecha])
        const monto = parseMonto(row[iMonto])
        const estado = String(row[iEstado] ?? '')
        if (!fecha || !monto || !estado.toLowerCase().includes('recibida')) continue
        const idT = String(row[iId] ?? '').trim()
        parsed.push({
          key: idT || `${fecha}|${monto}|${normName(row[iNombre])}`,
          fecha,
          rut: normRut(row[iRut]),
          nombre: String(row[iNombre] ?? '').trim(),
          monto,
        })
      }

      if (parsed.length === 0) {
        showToast('No se encontraron transferencias recibidas en el archivo', 'error')
        return
      }

      // Atenciones del período (± 7 días)
      const fechas = parsed.map((t) => t.fecha).sort()
      const min = new Date(fechas[0] + 'T00:00:00')
      min.setDate(min.getDate() - 7)
      const max = new Date(fechas[fechas.length - 1] + 'T00:00:00')
      max.setDate(max.getDate() + 7)
      const toIso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const [atts, convs, precio] = await Promise.all([
        getAttentionsBetween(toIso(min), toIso(max)),
        getConvenios().catch(() => []),
        getSetting('precio_particular').catch(() => null),
      ])
      const particular = parseInt(precio ?? '30000', 10) || 30000
      setValores({ convenios: convs ?? [], particular })

      // Sugerencias automáticas solo para lo aún no vinculado
      const sugs: Record<string, string> = {}
      const attsLibres = () =>
        (atts ?? []).filter((a: any) => !a.transfer_id && !Object.keys(sugs).includes(a.id))

      for (const t of parsed) {
        if (Object.values(sugs).includes(t.key)) continue
        let cand = attsLibres().find(
          (a: any) => a.patients?.rut && normRut(a.patients.rut) === t.rut
        )
        if (!cand) {
          const tN = normName(t.nombre)
          cand = attsLibres().find((a: any) => {
            const p = normName(a.patients?.name)
            const partes = p.split(' ').filter((x) => x.length > 2)
            return partes.length >= 2 && partes.slice(0, 2).every((parte) => tN.includes(parte))
          })
        }
        if (cand) sugs[cand.id] = t.key
      }

      setTransfers(parsed)
      setAttentions(atts ?? [])
      setSugerencias(sugs)
      setProcessed(true)
      showToast(`Cartola procesada: ${parsed.length} transferencias recibidas`)
    } catch (err) {
      console.error(err)
      showToast('Error leyendo el archivo. ¿Es la cartola del banco?', 'error')
    } finally {
      setProcessing(false)
    }
  }

  // ============ Helpers ============
  const valorDe = (a: any): number => {
    if (a.valor) return a.valor
    const conv = valores.convenios.find((c: any) => c.nombre === a.patients?.insurance)
    return conv?.valor ?? valores.particular
  }
  const transferByKey = (key: string | null) => transfers.find((t) => t.key === key)
  // Atenciones asociadas a una transferencia (puede ser MÁS DE UNA)
  const attsDe = (key: string) => attentions.filter((a) => a.transfer_id === key)
  const sumaDe = (key: string) => attsDe(key).reduce((s, a) => s + valorDe(a), 0)

  // Estado de cobertura de una transferencia
  const estadoTransfer = (t: Transfer) => {
    const n = attsDe(t.key).length
    if (n === 0) return 'libre'
    const suma = sumaDe(t.key)
    if (suma === t.monto) return 'completa'
    if (suma < t.monto) return 'parcial'
    return 'excedida'
  }

  // ============ Vincular / desvincular ============
  const vincular = async (t: Transfer, att: any) => {
    try {
      await updateAttention(att.id, {
        transfer_id: t.key,
        transfer_fecha: t.fecha,
        transfer_nombre: t.nombre,
        transfer_monto: t.monto,
      })
      setAttentions((prev) =>
        prev.map((a) =>
          a.id === att.id
            ? { ...a, transfer_id: t.key, transfer_fecha: t.fecha, transfer_nombre: t.nombre, transfer_monto: t.monto }
            : a
        )
      )
      setSugerencias((prev) => {
        const next = { ...prev }
        delete next[att.id]
        return next
      })
      showToast(`Conciliado: ${t.nombre.trim()} → ${att.patients?.name}`)
    } catch (err) {
      console.error(err)
      showToast('Error guardando la conciliación', 'error')
    }
  }

  const desvincular = async (att: any) => {
    try {
      await updateAttention(att.id, {
        transfer_id: null,
        transfer_fecha: null,
        transfer_nombre: null,
        transfer_monto: null,
      })
      setAttentions((prev) =>
        prev.map((a) =>
          a.id === att.id
            ? { ...a, transfer_id: null, transfer_fecha: null, transfer_nombre: null, transfer_monto: null }
            : a
        )
      )
      showToast('Conciliación deshecha')
    } catch (err) {
      console.error(err)
      showToast('Error deshaciendo la conciliación', 'error')
    }
  }

  const aceptarSugerencia = (att: any) => {
    const t = transferByKey(sugerencias[att.id])
    if (t) vincular(t, att)
  }

  const aceptarTodas = async () => {
    for (const [attId, key] of Object.entries(sugerencias)) {
      const att = attentions.find((a) => a.id === attId)
      const t = transferByKey(key)
      if (att && t) await vincular(t, att)
    }
  }

  const toggleBoleta = async (att: any) => {
    const nuevo = !att.boleta_emitida
    try {
      await updateAttention(att.id, { boleta_emitida: nuevo })
      setAttentions((prev) => prev.map((a) => (a.id === att.id ? { ...a, boleta_emitida: nuevo } : a)))
      showToast(nuevo ? 'Boleta marcada como emitida' : 'Marca de boleta quitada')
    } catch (err) {
      console.error(err)
      showToast('Error guardando la marca', 'error')
    }
  }

  // ============ Exportar cartola pintada ============
  const exportar = async () => {
    setExportando(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Conciliación')

      ws.columns = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Transferencia de', key: 'nombre', width: 34 },
        { header: 'Monto $', key: 'monto', width: 12 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Atenciones asociadas', key: 'pacientes', width: 40 },
        { header: 'Total asociado $', key: 'total', width: 15 },
        { header: 'Boleta emitida', key: 'boleta', width: 14 },
      ]
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }

      const COLOR: Record<string, string> = {
        completa: 'FF92D050', // verde (igual que pintas a mano)
        parcial: 'FFFFE699', // amarillo
        excedida: 'FFFF9999', // rojo suave
        libre: '',
      }
      const LABEL: Record<string, string> = {
        completa: 'Conciliada',
        parcial: 'Parcial',
        excedida: 'Excede',
        libre: 'Pendiente',
      }

      for (const t of transfers) {
        const est = estadoTransfer(t)
        const asociadas = attsDe(t.key)
        const row = ws.addRow({
          fecha: fmtDia(t.fecha),
          nombre: t.nombre,
          monto: t.monto,
          estado: LABEL[est],
          pacientes: asociadas.map((a) => a.patients?.name ?? '—').join(' + '),
          total: sumaDe(t.key) || '',
          boleta: asociadas.length
            ? asociadas.every((a) => a.boleta_emitida)
              ? 'Sí'
              : 'Pendiente'
            : '',
        })
        row.getCell('monto').numFmt = '#,##0'
        row.getCell('total').numFmt = '#,##0'
        if (COLOR[est]) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR[est] } }
          })
        }
      }

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cartola-conciliada-${new Date().toISOString().substring(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Cartola descargada con las filas pintadas 🟩')
    } catch (err) {
      console.error(err)
      showToast('Error generando el Excel', 'error')
    } finally {
      setExportando(false)
    }
  }

  const conciliadasCount = attentions.filter((a) => a.transfer_id).length
  const totalRecibido = transfers.reduce((s, t) => s + t.monto, 0)
  const completas = transfers.filter((t) => estadoTransfer(t) === 'completa').length

  const ESTILO_TRANSFER: Record<string, string> = {
    libre: 'bg-white border-arena hover:border-tinta-suave cursor-grab',
    completa: 'bg-salvia/10 border-salvia/50',
    parcial: 'bg-yellow-50 border-yellow-300 cursor-grab',
    excedida: 'bg-rosa-palo/40 border-rosa/50',
  }

  return (
    <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
      <h2 className="font-display text-2xl text-tinta font-semibold mb-1">
        🏦 Conciliación bancaria
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Sube la cartola del banco y asocia cada transferencia con su atención:{' '}
        <strong>arrastra una transferencia sobre la atención</strong> (o haz click en la
        transferencia y luego en “Asociar aquí”). Una misma transferencia puede cubrir{' '}
        <strong>varias atenciones</strong> (ej: alguien que paga por sí misma y por su mamá). El
        archivo se procesa solo en este navegador.
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
              <p className="text-xs text-gray-500">Transferencias</p>
            </div>
            <div className="bg-white border border-arena rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-salvia">{completas}</p>
              <p className="text-xs text-gray-500">Cuadradas</p>
            </div>
            <div className="bg-white border border-arena rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-rosa">{conciliadasCount}</p>
              <p className="text-xs text-gray-500">Atenciones asociadas</p>
            </div>
            <div className="bg-white border border-arena rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-tinta">{fmtCLP(totalRecibido)}</p>
              <p className="text-xs text-gray-500">Total recibido</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.keys(sugerencias).length > 0 && (
              <button
                onClick={aceptarTodas}
                className="bg-salvia text-marfil px-5 py-2 rounded-full text-sm font-bold hover:opacity-90 transition"
              >
                ✨ Aceptar las {Object.keys(sugerencias).length} sugerencias automáticas
              </button>
            )}
            <button
              onClick={exportar}
              disabled={exportando}
              className="bg-tinta text-marfil px-5 py-2 rounded-full text-sm font-bold hover:bg-tinta-suave transition disabled:opacity-50"
            >
              {exportando ? 'Generando...' : '📥 Descargar cartola pintada'}
            </button>
          </div>

          {/* ============ DOS PANELES EN PARALELO ============ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Panel izquierdo: transferencias */}
            <div>
              <h3 className="font-bold text-tinta text-sm mb-2">
                💸 Transferencias del banco
              </h3>
              <div className="space-y-1.5 max-h-[34rem] overflow-y-auto pr-1">
                {transfers.map((t) => {
                  const est = estadoTransfer(t)
                  const asociadas = attsDe(t.key)
                  const suma = sumaDe(t.key)
                  const selected = selectedKey === t.key
                  const restante = t.monto - suma
                  return (
                    <div
                      key={t.key}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', t.key)}
                      onClick={() => setSelectedKey(selected ? null : t.key)}
                      className={`px-3 py-2 rounded-xl border text-sm transition ${
                        selected ? 'bg-rosa-palo/60 border-rosa ring-2 ring-rosa cursor-pointer' : ESTILO_TRANSFER[est]
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-tinta truncate">{t.nombre || '—'}</p>
                        <p className="font-bold whitespace-nowrap">{fmtCLP(t.monto)}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {fmtDia(t.fecha)}
                        {asociadas.length > 0 && (
                          <span className={est === 'completa' ? 'text-salvia font-semibold' : 'text-yellow-700 font-semibold'}>
                            {' '}· {asociadas.length} atención{asociadas.length > 1 ? 'es' : ''} ({fmtCLP(suma)})
                            {est === 'parcial' && ` · faltan ${fmtCLP(restante)}`}
                            {est === 'excedida' && ` · excede ${fmtCLP(-restante)}`}
                            {est === 'completa' && ' ✅'}
                          </span>
                        )}
                        {selected && (
                          <span className="text-rosa font-semibold"> · seleccionada, elige la atención →</span>
                        )}
                      </p>
                      {asociadas.length > 0 && (
                        <p className="text-[11px] text-gray-500 truncate">
                          → {asociadas.map((a) => a.patients?.name).join(' + ')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Panel derecho: atenciones */}
            <div>
              <h3 className="font-bold text-tinta text-sm mb-2">
                🩺 Atenciones del período — suelta la transferencia aquí
              </h3>
              <div className="space-y-1.5 max-h-[34rem] overflow-y-auto pr-1">
                {attentions.length === 0 ? (
                  <p className="text-sm text-gray-400 bg-white border border-arena rounded-xl p-4">
                    No hay atenciones registradas en el período de la cartola.
                  </p>
                ) : (
                  attentions.map((a) => {
                    const sugerida = transferByKey(sugerencias[a.id])
                    return (
                      <div
                        key={a.id}
                        onDragOver={(e) => !a.transfer_id && e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (a.transfer_id) return
                          const t = transferByKey(e.dataTransfer.getData('text/plain'))
                          if (t) vincular(t, a)
                        }}
                        className={`px-3 py-2 rounded-xl border text-sm transition ${
                          a.transfer_id
                            ? 'bg-salvia/10 border-salvia/40'
                            : sugerida
                            ? 'bg-yellow-50 border-yellow-300'
                            : 'bg-white border-arena border-dashed'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-tinta truncate">{a.patients?.name}</p>
                          <p className="font-bold whitespace-nowrap">{fmtCLP(valorDe(a))}</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {fmtDia(a.fecha)} · {a.patients?.insurance || 'Particular'}
                        </p>

                        {a.transfer_id ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-salvia font-semibold">
                              ✅ Pagada por {a.transfer_nombre?.trim()} ({fmtCLP(a.transfer_monto ?? 0)})
                            </span>
                            <label className="flex items-center gap-1 cursor-pointer font-semibold text-tinta">
                              <input
                                type="checkbox"
                                checked={!!a.boleta_emitida}
                                onChange={() => toggleBoleta(a)}
                                className="w-3.5 h-3.5 accent-[#7d8f6f]"
                              />
                              Boleta emitida
                            </label>
                            <button
                              onClick={() => desvincular(a)}
                              className="text-rosa hover:underline font-semibold"
                            >
                              🔓 Deshacer
                            </button>
                          </div>
                        ) : sugerida ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-yellow-700">
                              ✨ Sugerencia: {sugerida.nombre.trim()} ({fmtCLP(sugerida.monto)})
                            </span>
                            <button
                              onClick={() => aceptarSugerencia(a)}
                              className="bg-salvia text-marfil px-3 py-0.5 rounded-full font-bold hover:opacity-90 transition"
                            >
                              ✔ Aceptar
                            </button>
                          </div>
                        ) : selectedKey ? (
                          <button
                            onClick={() => {
                              const t = transferByKey(selectedKey)
                              if (t) vincular(t, a)
                            }}
                            className="mt-1.5 bg-tinta text-marfil px-3 py-0.5 rounded-full text-xs font-bold hover:bg-tinta-suave transition"
                          >
                            ⬇ Asociar aquí
                          </button>
                        ) : (
                          <p className="mt-1 text-xs text-gray-400">Sin pago asociado</p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            💡 Para una transferencia que cubre a 2 personas: haz click en ella y luego en
            “Asociar aquí” en cada atención. Quedará en amarillo (parcial) hasta que la suma
            calce con el monto, y ahí pasa a verde ✅.
          </p>
        </div>
      )}
    </section>
  )
}
