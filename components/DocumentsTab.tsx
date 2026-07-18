'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  getDocuments,
  createDocument,
  uploadDocumentPdf,
  getDocumentSignedUrl,
  deleteDocument,
  getAvailability,
  getBlockouts,
} from '@/lib/supabase'
import { SelectField, TextField, TextAreaField } from '@/components/fields'
import { CLINIC, getClinicInfo, type ClinicInfo } from '@/lib/clinicConfig'
import { showToast } from '@/components/toast'

// Edad a partir de la fecha de nacimiento
function computeAge(dateOfBirth?: string): string {
  if (!dateOfBirth) return ''
  const birth = new Date(dateOfBirth + 'T00:00:00')
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return `${age} años`
}

// Normaliza teléfono chileno a formato wa.me (56XXXXXXXXX)
function waPhone(phone?: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('56')) return digits
  if (digits.length === 9 && digits.startsWith('9')) return '56' + digits
  if (digits.length === 8) return '569' + digits
  return digits
}

export default function DocumentsTab({ patient }: { patient: any }) {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ tipo: 'receta' })
  const [activeDays, setActiveDays] = useState<number[]>([])
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [clinic, setClinic] = useState<ClinicInfo>(CLINIC)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  // Visor de PDF interno (usa una copia local del archivo para poder imprimir)
  const [viewer, setViewer] = useState<{ doc: any; url: string } | null>(null)

  const load = useCallback(() => {
    getDocuments(patient.id)
      .then((data) => setDocuments(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [patient.id])

  useEffect(() => {
    load()
    getClinicInfo().then(setClinic).catch(() => {})
    // Cargar días de atención y bloqueos (para validar próximo control)
    Promise.all([getAvailability(), getBlockouts()])
      .then(([avail, blocks]) => {
        setActiveDays((avail ?? []).map((a: any) => a.day_of_week))
        setBlockedDates((blocks ?? []).map((b: any) => String(b.blocked_date)))
      })
      .catch(console.error)
  }, [load])

  const set = (key: string) => (value: string) =>
    setForm((prev: any) => ({ ...prev, [key]: value }))

  // Próximo control: solo días con atención y no bloqueados
  const setProximoControl = (value: string) => {
    if (value) {
      const dow = new Date(value + 'T00:00:00').getDay()
      if (!activeDays.includes(dow)) {
        showToast('Ese día no hay atención. Elige un día hábil.', 'error')
        setForm((prev: any) => ({ ...prev, proximo_control: '' }))
        return
      }
      if (blockedDates.includes(value)) {
        showToast('Ese día está bloqueado (feriado/vacaciones). Elige otro.', 'error')
        setForm((prev: any) => ({ ...prev, proximo_control: '' }))
        return
      }
    }
    setForm((prev: any) => ({ ...prev, proximo_control: value }))
  }

  // Crear documento: genera el PDF, lo sube y guarda el registro
  const save = async () => {
    if (!form.diagnostico && !form.contenido) {
      showToast('Completa al menos el diagnóstico o el contenido', 'error')
      return
    }
    setSaving(true)
    try {
      // 1. Generar PDF (import dinámico: la librería solo carga aquí)
      const { generateDocumentPdf } = await import('@/lib/pdf')
      const blob = await generateDocumentPdf({
        tipo: form.tipo,
        patientName: patient.name,
        patientRut: patient.rut || '',
        patientAge: computeAge(patient.date_of_birth),
        diagnostico: form.diagnostico || '',
        contenido: form.contenido || '',
        proximoControl: form.proximo_control
          ? new Date(form.proximo_control + 'T00:00:00').toLocaleDateString('es-CL')
          : '',
      })

      // 2. Subir al almacenamiento privado
      const path = `${patient.id}/${Date.now()}_${form.tipo}.pdf`
      await uploadDocumentPdf(path, blob)

      // 3. Guardar registro en BD
      await createDocument({
        patient_id: patient.id,
        tipo: form.tipo,
        diagnostico: form.diagnostico || null,
        contenido: form.contenido || null,
        proximo_control: form.proximo_control || null,
        pdf_url: path,
      })

      showToast('Documento generado correctamente')
      setForm({ tipo: 'receta' })
      setShowForm(false)
      load()
    } catch (err) {
      showToast('Error generando el documento', 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Abre el PDF en un visor dentro del panel. Se descarga como blob local
  // para que Imprimir y Descargar funcionen sin bloqueos del navegador.
  const openPdf = async (doc: any) => {
    setWorking(doc.id)
    try {
      const signed = await getDocumentSignedUrl(doc.pdf_url)
      const res = await fetch(signed)
      if (!res.ok) throw new Error('No se pudo descargar el PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setViewer({ doc, url })
    } catch (err) {
      showToast('Error abriendo el PDF', 'error')
      console.error(err)
    } finally {
      setWorking(null)
    }
  }

  const cerrarVisor = () => {
    if (viewer?.url) URL.revokeObjectURL(viewer.url)
    setViewer(null)
  }

  const imprimir = () => {
    const frame = document.getElementById('pdf-frame') as HTMLIFrameElement | null
    try {
      frame?.contentWindow?.focus()
      frame?.contentWindow?.print()
    } catch {
      showToast('Usa el botón de imprimir del visor', 'error')
    }
  }

  const nombreArchivo = (doc: any) =>
    `${doc.tipo === 'receta' ? 'Receta' : 'Indicaciones'}-${patient.name?.replace(/\s+/g, '-')}-${new Date(doc.created_at).toLocaleDateString('es-CL').replace(/\//g, '-')}.pdf`

  const sendWhatsApp = async (doc: any) => {
    setWorking(doc.id)
    try {
      const url = await getDocumentSignedUrl(doc.pdf_url)
      const tipoLabel = doc.tipo === 'receta' ? 'receta' : 'indicaciones de tratamiento'
      const message =
        `Hola ${patient.name} 👋\n\n` +
        `Te comparto tu ${tipoLabel} de ${clinic.brand}:\n${url}\n\n` +
        `El enlace estará disponible por 30 días.\n\n` +
        `${clinic.professional}\n${clinic.instagram}`
      const phone = waPhone(patient.phone)
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        '_blank'
      )
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
      await deleteDocument(deleteTarget.id, deleteTarget.pdf_url)
      showToast('Documento eliminado')
      setDeleteTarget(null)
      load()
    } catch (err) {
      console.error(err)
      showToast('Error eliminando el documento', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <p className="text-gray-500 py-6 text-center">Cargando documentos...</p>

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl text-tinta font-semibold">
          📄 Documentos ({documents.length})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-tinta text-marfil px-4 py-2 rounded-full font-bold hover:bg-tinta-suave transition"
        >
          {showForm ? 'Cancelar' : '+ Nuevo Documento'}
        </button>
      </div>

      {/* Formulario nuevo documento */}
      {showForm && (
        <div className="bg-marfil rounded-2xl shadow-sm p-6 space-y-4 border-2 border-tinta/20 animate-fade-up">
          <h3 className="font-display text-xl text-tinta font-semibold">📄 Generar Receta o Indicación</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Tipo de documento"
              value={form.tipo}
              onChange={set('tipo')}
              options={['receta', 'indicacion']}
            />
            {form.tipo === 'receta' && (
              <TextField
                label="Fecha de próximo control"
                type="date"
                value={form.proximo_control}
                onChange={setProximoControl}
              />
            )}
          </div>

          <TextAreaField
            label="Diagnóstico"
            value={form.diagnostico}
            onChange={set('diagnostico')}
            rows={2}
          />

          <TextAreaField
            label={form.tipo === 'receta' ? 'RP/ (contenido de la receta)' : 'Indicaciones del tratamiento'}
            value={form.contenido}
            onChange={set('contenido')}
            rows={6}
          />

          <button
            onClick={save}
            disabled={saving}
            className="bg-salvia text-marfil px-8 py-2.5 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Generando PDF...' : '📄 Generar Documento'}
          </button>
        </div>
      )}

      {/* Lista de documentos */}
      {documents.length === 0 ? (
        <p className="text-gray-500 py-8 text-center bg-marfil rounded-2xl border border-arena shadow-sm">
          Este paciente aún no tiene documentos
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-marfil rounded-2xl border border-arena shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:shadow-md transition"
            >
              <div>
                <p className="font-bold text-tinta">
                  {doc.tipo === 'receta' ? '💊 Receta' : '📋 Indicaciones'}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(doc.created_at).toLocaleDateString('es-CL')}
                  {doc.diagnostico ? ` · ${doc.diagnostico}` : ''}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openPdf(doc)}
                  disabled={working === doc.id}
                  className="bg-white border border-arena text-tinta px-4 py-1.5 rounded-full text-sm font-bold hover:border-tinta-suave transition disabled:opacity-50"
                >
                  👁 Ver PDF
                </button>
                <button
                  onClick={() => sendWhatsApp(doc)}
                  disabled={working === doc.id || !patient.phone}
                  title={!patient.phone ? 'El paciente no tiene teléfono registrado' : ''}
                  className="bg-salvia text-marfil px-4 py-1.5 rounded-full text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
                >
                  💬 WhatsApp
                </button>
                <button
                  onClick={() => setDeleteTarget(doc)}
                  className="text-rosa/70 hover:text-rosa hover:bg-rosa-palo/50 rounded-full px-2.5 py-1.5 text-sm transition"
                  title="Eliminar documento"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Visor de PDF interno ===== */}
      {viewer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-tinta/70 backdrop-blur-sm p-3 sm:p-6">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena w-full max-w-4xl mx-auto flex flex-col flex-1 overflow-hidden">
            {/* Barra superior */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-arena bg-marfil">
              <div>
                <p className="font-display text-xl text-tinta font-semibold">
                  {viewer.doc.tipo === 'receta' ? '💊 Receta' : '📋 Indicaciones'}
                </p>
                <p className="text-xs text-gray-500">
                  {patient.name} ·{' '}
                  {new Date(viewer.doc.created_at).toLocaleDateString('es-CL')}
                  {viewer.doc.diagnostico ? ` · ${viewer.doc.diagnostico}` : ''}
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
                  download={nombreArchivo(viewer.doc)}
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

            {/* PDF */}
            <iframe
              id="pdf-frame"
              src={viewer.url}
              title="Documento"
              className="flex-1 w-full bg-white"
            />
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
              ¿Eliminar {deleteTarget.tipo === 'receta' ? 'esta receta' : 'estas indicaciones'}?
            </h2>
            <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
              Del {new Date(deleteTarget.created_at).toLocaleDateString('es-CL')}
              {deleteTarget.diagnostico ? ` · ${deleteTarget.diagnostico}` : ''}
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
