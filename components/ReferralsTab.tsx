'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getReferrals,
  createReferral,
  deleteReferral,
  uploadDocumentPdf,
  getDocumentSignedUrl,
  getClinicalRecord,
  getAttentions,
} from '@/lib/supabase'
import { SelectField, TextField, TextAreaField } from '@/components/fields'
import { CLINIC, getClinicInfo, type ClinicInfo } from '@/lib/clinicConfig'
import { showToast } from '@/components/toast'
import {
  antecedentesDe,
  evaluacionPieDe,
  diagnosticoDe,
  tratamientoDe,
  recomendacionesDe,
} from '@/lib/referralSummary'

const DESTINATARIOS = [
  'Médico especialista',
  'Traumatólogo',
  'Diabetólogo',
  'Dermatólogo',
  'Kinesiólogo / Terapia',
  'Colega Podólogo',
  'A quien corresponda',
]

function computeAge(dateOfBirth?: string): string {
  if (!dateOfBirth) return ''
  const birth = new Date(dateOfBirth + 'T00:00:00')
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return `${age} años`
}

function waPhone(phone?: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('56')) return digits
  if (digits.length === 9 && digits.startsWith('9')) return '56' + digits
  if (digits.length === 8) return '569' + digits
  return digits
}

export default function ReferralsTab({
  patient,
  onChange,
}: {
  patient: any
  onChange?: (total: number) => void
}) {
  const [referrals, setReferrals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ categoria: DESTINATARIOS[0] })
  const [clinic, setClinic] = useState<ClinicInfo>(CLINIC)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  // Datos clínicos que se adjuntarán al informe
  const [record, setRecord] = useState<any>(null)
  const [ultima, setUltima] = useState<any>(null)

  const [viewer, setViewer] = useState<{ ref: any; url: string; bytes: ArrayBuffer } | null>(null)
  const [renderizando, setRenderizando] = useState(false)
  const [fallback, setFallback] = useState(false)
  const paginasRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    getReferrals(patient.id)
      .then((data) => {
        setReferrals(data || [])
        onChange?.(data?.length || 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id])

  useEffect(() => {
    load()
    getClinicInfo().then(setClinic).catch(() => {})
    getClinicalRecord(patient.id).then(setRecord).catch(console.error)
    getAttentions(patient.id)
      .then((list: any[]) => setUltima(list?.[0] ?? null))
      .catch(console.error)
  }, [load, patient.id])

  const set = (key: string) => (value: string) =>
    setForm((prev: any) => ({ ...prev, [key]: value }))

  // Resumen de lo que se adjuntará (se muestra antes de generar)
  const antecedentes = antecedentesDe(record)
  const evaluacion = evaluacionPieDe(record)
  const diagnostico = diagnosticoDe(record)
  const tratamiento = tratamientoDe(ultima)
  const recomendaciones = recomendacionesDe(ultima)

  const destinatario = () => {
    const detalle = String(form.detalle || '').trim()
    return detalle ? `${form.categoria} — ${detalle}` : form.categoria
  }

  const save = async () => {
    if (!form.motivo?.trim()) {
      showToast('Explica el motivo de la derivación', 'error')
      return
    }
    setSaving(true)
    try {
      const dirigidoA = destinatario()

      // 1. Generar el informe en PDF
      const { generateReferralPdf } = await import('@/lib/pdfReferral')
      const blob = await generateReferralPdf({
        patientName: patient.name,
        patientRut: patient.rut || '',
        patientAge: computeAge(patient.date_of_birth),
        patientPhone: patient.phone || '',
        dirigidoA,
        motivo: form.motivo.trim(),
        sugerencia: form.sugerencia?.trim() || '',
        proximoControl: form.proximo_control?.trim() || '',
        antecedentes,
        evaluacionPie: evaluacion,
        diagnostico,
        tratamiento,
        recomendaciones,
        fechaUltimaAtencion: ultima
          ? new Date(ultima.fecha + 'T00:00:00').toLocaleDateString('es-CL')
          : '',
        observaciones: ultima?.observaciones || record?.observaciones || '',
      })

      // 2. Subir al almacenamiento privado
      const path = `${patient.id}/${Date.now()}_derivacion.pdf`
      await uploadDocumentPdf(path, blob)

      // 3. Guardar el registro
      await createReferral({
        patient_id: patient.id,
        dirigido_a: dirigidoA,
        motivo: form.motivo.trim(),
        sugerencia: form.sugerencia?.trim() || null,
        proximo_control: form.proximo_control?.trim() || null,
        pdf_url: path,
      })

      showToast('Informe de derivación generado')
      setForm({ categoria: DESTINATARIOS[0] })
      setShowForm(false)
      load()
    } catch (err) {
      showToast('Error generando el informe', 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const openPdf = async (ref: any) => {
    setWorking(ref.id)
    try {
      const signed = await getDocumentSignedUrl(ref.pdf_url)
      const res = await fetch(signed)
      if (!res.ok) throw new Error('No se pudo descargar el PDF')
      const bytes = await res.arrayBuffer()
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      setViewer({ ref, url, bytes })
    } catch (err) {
      showToast('Error abriendo el informe', 'error')
      console.error(err)
    } finally {
      setWorking(null)
    }
  }

  const cerrarVisor = () => {
    if (viewer?.url) URL.revokeObjectURL(viewer.url)
    setViewer(null)
  }

  // Renderizado con la compilación "legacy" de pdf.js (compatible con Safari/iPad)
  useEffect(() => {
    if (!viewer) return
    let cancelado = false
    setRenderizando(true)
    setFallback(false)
    ;(async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.legacy.min.mjs'

        const doc = await pdfjs.getDocument({
          data: viewer.bytes.slice(0),
          isEvalSupported: false,
          useSystemFonts: true,
        }).promise
        if (cancelado) return

        const cont = paginasRef.current
        if (!cont) return
        cont.innerHTML = ''

        const esIOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
        const escala = esIOS ? 1.5 : 2

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: escala })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'w-full h-auto rounded-lg shadow-md mb-4 bg-white'
          cont.appendChild(canvas)
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Sin contexto 2D')
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          if (cancelado) return
        }
      } catch (err) {
        console.error('Error renderizando PDF:', err)
        if (!cancelado) setFallback(true)
      } finally {
        if (!cancelado) setRenderizando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [viewer])

  // Impresión vía iframe oculto (las ventanas emergentes se bloquean en iPad)
  const imprimir = () => {
    const canvases = paginasRef.current?.querySelectorAll('canvas')

    if (!canvases || canvases.length === 0) {
      window.open(viewer?.url, '_blank')
      showToast('Abre el informe y usa el botón imprimir del visor')
      return
    }

    const imgs = Array.from(canvases)
      .map((c) => `<img src="${(c as HTMLCanvasElement).toDataURL('image/png')}" />`)
      .join('')

    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(frame)

    const fdoc = frame.contentWindow?.document
    if (!fdoc) {
      showToast('No se pudo preparar la impresión', 'error')
      frame.remove()
      return
    }
    fdoc.open()
    fdoc.write(`<!doctype html><html><head><title>Informe de derivación</title>
      <style>
        @page { margin: 0; }
        html, body { margin: 0; padding: 0; }
        img { width: 100%; display: block; page-break-after: always; }
      </style></head><body>${imgs}</body></html>`)
    fdoc.close()

    setTimeout(() => {
      try {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
      } catch {
        showToast('Usa Descargar y luego imprime el archivo', 'error')
      }
      setTimeout(() => frame.remove(), 60000)
    }, 600)
  }

  const nombreArchivo = (ref: any) =>
    `Derivacion-${patient.name?.replace(/\s+/g, '-')}-${new Date(ref.created_at)
      .toLocaleDateString('es-CL')
      .replace(/\//g, '-')}.pdf`

  const sendWhatsApp = async (ref: any) => {
    setWorking(ref.id)
    try {
      const url = await getDocumentSignedUrl(ref.pdf_url)
      const message =
        `Hola ${patient.name} 👋\n\n` +
        `Te comparto tu informe de derivación de ${clinic.brand}, ` +
        `dirigido a: ${ref.dirigido_a}.\n${url}\n\n` +
        `Puedes descargarlo o imprimirlo para llevarlo a tu consulta. ` +
        `El enlace estará disponible por 30 días.\n\n` +
        `${clinic.professional}\n${clinic.instagram}`
      window.open(`https://wa.me/${waPhone(patient.phone)}?text=${encodeURIComponent(message)}`, '_blank')
    } catch (err) {
      showToast('Error generando el enlace', 'error')
      console.error(err)
    } finally {
      setWorking(null)
    }
  }

  const confirmarEliminar = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteReferral(deleteTarget.id, deleteTarget.pdf_url)
      showToast('Derivación eliminada')
      setDeleteTarget(null)
      load()
    } catch (err) {
      console.error(err)
      showToast('Error eliminando la derivación', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <p className="text-gray-500 py-6 text-center">Cargando derivaciones...</p>

  const sinFicha = antecedentes.length === 0 && diagnostico.length === 0

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl text-tinta font-semibold">
          🏥 Derivación Médica ({referrals.length})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-tinta text-marfil px-4 py-2 rounded-full font-bold hover:bg-tinta-suave transition"
        >
          {showForm ? 'Cancelar' : '+ Nueva Derivación'}
        </button>
      </div>

      {showForm && (
        <div className="bg-marfil rounded-2xl shadow-sm p-6 space-y-4 border-2 border-tinta/20 animate-fade-up">
          <h3 className="font-display text-xl text-tinta font-semibold">
            🏥 Generar Informe de Derivación
          </h3>
          <p className="text-sm text-gray-500 -mt-2">
            El informe adjunta automáticamente la ficha clínica y la última atención.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Derivar a"
              value={form.categoria}
              onChange={set('categoria')}
              options={DESTINATARIOS}
            />
            <TextField
              label="Nombre o centro (opcional)"
              value={form.detalle}
              onChange={set('detalle')}
            />
          </div>

          <TextAreaField
            label="Motivo de la derivación"
            value={form.motivo}
            onChange={set('motivo')}
            rows={4}
          />
          <TextAreaField
            label="Sugerencia al profesional receptor (opcional)"
            value={form.sugerencia}
            onChange={set('sugerencia')}
            rows={3}
          />
          <TextField
            label="Próximo control (opcional)"
            value={form.proximo_control}
            onChange={set('proximo_control')}
          />

          {/* Vista previa de lo que se adjuntará */}
          <div className="bg-arena/40 rounded-2xl p-4 text-sm space-y-2 border border-arena">
            <p className="font-bold text-tinta">📎 Se adjuntará al informe:</p>
            {sinFicha ? (
              <p className="text-rosa">
                ⚠️ La ficha clínica está vacía. Complétala en la pestaña Ficha Clínica para que el
                informe tenga contenido.
              </p>
            ) : (
              <ul className="text-gray-600 space-y-1">
                <li>• Antecedentes sistémicos: {antecedentes.length || 'sin registros'}</li>
                <li>• Evaluación del pie: {evaluacion.length || 'sin registros'}</li>
                <li>• Hallazgos podológicos: {diagnostico.length || 'sin registros'}</li>
                <li>
                  • Última atención:{' '}
                  {ultima
                    ? `${new Date(ultima.fecha + 'T00:00:00').toLocaleDateString('es-CL')} (${
                        tratamiento.length
                      } procedimientos, ${recomendaciones.length} recomendaciones)`
                    : 'sin atenciones registradas'}
                </li>
              </ul>
            )}
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="bg-salvia text-marfil px-8 py-2.5 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Generando informe...' : '🏥 Generar Informe'}
          </button>
        </div>
      )}

      {referrals.length === 0 ? (
        <p className="text-gray-500 py-8 text-center bg-marfil rounded-2xl border border-arena shadow-sm">
          Este paciente no tiene derivaciones registradas
        </p>
      ) : (
        <div className="space-y-2">
          {referrals.map((ref) => (
            <div
              key={ref.id}
              className="bg-marfil rounded-2xl border border-arena shadow-sm px-4 py-3 space-y-2 hover:shadow-md transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-tinta">🏥 {ref.dirigido_a}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(ref.created_at).toLocaleDateString('es-CL')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openPdf(ref)}
                    disabled={working === ref.id}
                    className="bg-white border border-arena text-tinta px-4 py-1.5 rounded-full text-sm font-bold hover:border-tinta-suave transition disabled:opacity-50"
                  >
                    👁 Ver PDF
                  </button>
                  <button
                    onClick={() => sendWhatsApp(ref)}
                    disabled={working === ref.id || !patient.phone}
                    title={!patient.phone ? 'El paciente no tiene teléfono registrado' : ''}
                    className="bg-salvia text-marfil px-4 py-1.5 rounded-full text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    onClick={() => setDeleteTarget(ref)}
                    className="text-rosa/70 hover:text-rosa hover:bg-rosa-palo/50 rounded-full px-2.5 py-1.5 text-sm transition"
                    title="Eliminar derivación"
                  >
                    🗑
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed border-t border-arena pt-2">
                {ref.motivo}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ===== Visor de PDF ===== */}
      {viewer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-tinta/70 backdrop-blur-sm p-3 sm:p-6">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena w-full max-w-4xl mx-auto flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-arena bg-marfil">
              <div className="min-w-0">
                <p className="font-display text-xl text-tinta font-semibold">
                  🏥 Informe de derivación
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {patient.name} · {viewer.ref.dirigido_a} ·{' '}
                  {new Date(viewer.ref.created_at).toLocaleDateString('es-CL')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={imprimir}
                  className="bg-tinta text-marfil px-4 py-1.5 rounded-full text-sm font-bold hover:bg-tinta-suave transition"
                >
                  🖨 Imprimir
                </button>
                <a
                  href={viewer.url}
                  download={nombreArchivo(viewer.ref)}
                  className="bg-salvia text-marfil px-4 py-1.5 rounded-full text-sm font-bold hover:opacity-90 transition"
                >
                  ⬇ Descargar
                </a>
                <button
                  onClick={cerrarVisor}
                  className="w-9 h-9 rounded-full border border-arena text-tinta hover:bg-arena/50 transition"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-arena/40 p-4">
              {renderizando && (
                <p className="text-center text-sm text-gray-500 py-8">Cargando informe...</p>
              )}
              {fallback ? (
                <div className="h-full flex flex-col">
                  <iframe
                    src={viewer.url}
                    title="Informe de derivación"
                    className="flex-1 w-full min-h-[60vh] rounded-lg bg-white"
                  />
                  <p className="text-center text-xs text-gray-500 mt-3">
                    Si no ves el informe, usa{' '}
                    <a
                      href={viewer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-tinta font-bold underline"
                    >
                      abrir en una pestaña nueva
                    </a>{' '}
                    o el botón Descargar.
                  </p>
                </div>
              ) : (
                <div ref={paginasRef} className="max-w-2xl mx-auto" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-sm w-full p-8 text-center animate-fade-up">
            <div className="w-16 h-16 mx-auto rounded-full bg-rosa-palo flex items-center justify-center text-3xl">
              🗑
            </div>
            <h2 className="font-display text-2xl text-tinta font-medium mt-4">
              ¿Eliminar esta derivación?
            </h2>
            <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
              Dirigida a {deleteTarget.dirigido_a}, del{' '}
              {new Date(deleteTarget.created_at).toLocaleDateString('es-CL')}
              <br />
              Se borrará también el PDF.{' '}
              <strong className="text-rosa">Esta acción no se puede deshacer.</strong>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Si ya lo compartiste por WhatsApp, el enlace dejará de funcionar.
            </p>
            <button
              onClick={confirmarEliminar}
              disabled={deleting}
              className="mt-5 w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
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
