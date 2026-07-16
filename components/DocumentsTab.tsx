'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  getDocuments,
  createDocument,
  uploadDocumentPdf,
  getDocumentSignedUrl,
  getAvailability,
  getBlockouts,
} from '@/lib/supabase'
import { SelectField, TextField, TextAreaField } from '@/components/fields'
import { CLINIC } from '@/lib/clinicConfig'
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

  const load = useCallback(() => {
    getDocuments(patient.id)
      .then((data) => setDocuments(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [patient.id])

  useEffect(() => {
    load()
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

  const openPdf = async (doc: any) => {
    setWorking(doc.id)
    try {
      const url = await getDocumentSignedUrl(doc.pdf_url)
      window.open(url, '_blank')
    } catch (err) {
      showToast('Error abriendo el PDF', 'error')
      console.error(err)
    } finally {
      setWorking(null)
    }
  }

  const sendWhatsApp = async (doc: any) => {
    setWorking(doc.id)
    try {
      const url = await getDocumentSignedUrl(doc.pdf_url)
      const tipoLabel = doc.tipo === 'receta' ? 'receta' : 'indicaciones de tratamiento'
      const message =
        `Hola ${patient.name} 👋\n\n` +
        `Te comparto tu ${tipoLabel} de ${CLINIC.brand}:\n${url}\n\n` +
        `El enlace estará disponible por 30 días.\n\n` +
        `${CLINIC.professional}\n${CLINIC.instagram}`
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

  if (loading) return <p className="text-gray-500 py-6 text-center">Cargando documentos...</p>

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-800">
          📄 Documentos ({documents.length})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700"
        >
          {showForm ? 'Cancelar' : '+ Nuevo Documento'}
        </button>
      </div>

      {/* Formulario nuevo documento */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4 border-2 border-blue-200">
          <h3 className="font-bold text-gray-800">Generar Receta o Indicación</h3>

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
            className="bg-green-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Generando PDF...' : '📄 Generar Documento'}
          </button>
        </div>
      )}

      {/* Lista de documentos */}
      {documents.length === 0 ? (
        <p className="text-gray-500 py-8 text-center bg-white rounded-lg shadow">
          Este paciente aún no tiene documentos
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-lg shadow px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-bold text-gray-800">
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
                  className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  👁 Ver PDF
                </button>
                <button
                  onClick={() => sendWhatsApp(doc)}
                  disabled={working === doc.id || !patient.phone}
                  title={!patient.phone ? 'El paciente no tiene teléfono registrado' : ''}
                  className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  💬 WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
