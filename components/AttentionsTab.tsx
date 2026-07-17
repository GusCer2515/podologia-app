'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAttentions, createAttention, getConvenios, getSetting } from '@/lib/supabase'
import { showToast } from '@/components/toast'
import { SelectField, TextField, TextAreaField, FormSection } from '@/components/fields'

const SI_NO = ['SI', 'NO']

const PROCEDIMIENTOS: [string, string][] = [
  ['limpieza_general', 'Limpieza general'],
  ['limpieza_laterales', 'Limpieza laterales ungueales'],
  ['onicotomia', 'Onicotomía'],
  ['desbastado_unas', 'Desbastado de uñas'],
  ['resecado_hiperqueratosis', 'Resecado de hiperqueratosis'],
  ['resecado_helomas', 'Resecado de helomas'],
  ['masaje', 'Masaje'],
]

const RECOMENDACIONES: [string, string][] = [
  ['higiene', 'Higiene'],
  ['corte_unas', 'Corte de uñas'],
  ['aceite_arbol_te', 'Aceite árbol del té'],
  ['vitaminas', 'Vitaminas'],
  ['otros_antifungicos', 'Otros antifúngicos'],
  ['vendaje', 'Vendaje'],
  ['crema_hidratante', 'Crema hidratante'],
  ['consulta_medica', 'Consulta médica'],
]

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AttentionsTab({ patient }: { patient: any }) {
  const patientId = patient.id
  const [attentions, setAttentions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ fecha: todayLocal() })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [valorDefecto, setValorDefecto] = useState<number>(30000)

  const load = useCallback(() => {
    getAttentions(patientId)
      .then((data) => setAttentions(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    load()
    // Valor por defecto según convenio del paciente (o particular)
    Promise.all([
      getConvenios().catch(() => []),
      getSetting('precio_particular').catch(() => null),
    ]).then(([convs, precio]) => {
      const convenio = (convs ?? []).find((c: any) => c.nombre === patient.insurance)
      if (convenio?.valor) setValorDefecto(convenio.valor)
      else if (precio) setValorDefecto(parseInt(precio, 10) || 30000)
    })
  }, [load, patient.insurance])

  const set = (key: string) => (value: string) =>
    setForm((prev: any) => ({ ...prev, [key]: value }))

  const save = async () => {
    if (!form.fecha) {
      showToast('La fecha es obligatoria', 'error')
      return
    }
    setSaving(true)
    try {
      await createAttention({
        ...form,
        patient_id: patientId,
        proxima_atencion: form.proxima_atencion || null,
        valor: parseInt(form.valor, 10) || null,
      })
      showToast('Atención registrada')
      setForm({ fecha: todayLocal() })
      setShowForm(false)
      load()
    } catch (err) {
      showToast('Error registrando la atención', 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Resumen corto de qué se hizo en una atención
  const summary = (a: any) => {
    const done = PROCEDIMIENTOS.filter(([key]) => a[key] === 'SI').map(([, label]) => label)
    return done.length > 0 ? done.join(', ') : 'Sin procedimientos marcados'
  }

  if (loading) return <p className="text-gray-500 py-6 text-center">Cargando atenciones...</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl text-tinta font-semibold">
          📝 Historial de Atenciones ({attentions.length})
        </h2>
        <button
          onClick={() => {
            if (!showForm) setForm({ fecha: todayLocal(), valor: String(valorDefecto) })
            setShowForm(!showForm)
          }}
          className="bg-tinta text-marfil px-4 py-2 rounded-full font-bold hover:bg-tinta-suave transition"
        >
          {showForm ? 'Cancelar' : '+ Nueva Atención'}
        </button>
      </div>

      {/* Formulario nueva atención */}
      {showForm && (
        <div className="bg-marfil rounded-2xl shadow-sm p-6 space-y-5 border-2 border-tinta/20 animate-fade-up">
          <h3 className="font-display text-xl text-tinta font-semibold">✍️ Registrar Atención</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TextField label="Fecha" type="date" value={form.fecha} onChange={set('fecha')} />
            <TextField label="Tiempo de consulta" value={form.tiempo_consulta} onChange={set('tiempo_consulta')} />
            <TextField label="Próxima atención" type="date" value={form.proxima_atencion} onChange={set('proxima_atencion')} />
            <TextField label="Valor cobrado ($)" type="number" value={form.valor} onChange={set('valor')} />
          </div>
          <p className="text-xs text-gray-400 -mt-3">
            Valor sugerido según {patient.insurance ? `convenio ${patient.insurance}` : 'atención particular'}:{' '}
            <strong>${valorDefecto.toLocaleString('es-CL')}</strong>
          </p>

          <FormSection title="Procedimientos Realizados">
            {PROCEDIMIENTOS.map(([key, label]) => (
              <SelectField key={key} label={label} value={form[key]} onChange={set(key)} options={SI_NO} />
            ))}
            <TextAreaField label="Otros procedimientos" value={form.otros_procedimientos} onChange={set('otros_procedimientos')} />
          </FormSection>

          <FormSection title="Recomendaciones">
            {RECOMENDACIONES.map(([key, label]) => (
              <SelectField key={key} label={label} value={form[key]} onChange={set(key)} options={SI_NO} />
            ))}
          </FormSection>

          <FormSection title="Detalle">
            <TextAreaField label="Medicamentos" value={form.medicamentos} onChange={set('medicamentos')} />
            <TextAreaField label="Observaciones" value={form.observaciones} onChange={set('observaciones')} rows={3} />
            <TextAreaField label="Próxima consulta (detalle)" value={form.proxima_consulta} onChange={set('proxima_consulta')} />
          </FormSection>

          <button
            onClick={save}
            disabled={saving}
            className="bg-salvia text-marfil px-8 py-2.5 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar Atención'}
          </button>
        </div>
      )}

      {/* Lista de atenciones */}
      {attentions.length === 0 ? (
        <p className="text-gray-500 py-8 text-center bg-marfil rounded-2xl border border-arena shadow-sm">
          Este paciente aún no tiene atenciones registradas
        </p>
      ) : (
        <div className="space-y-2">
          {attentions.map((a) => (
            <div key={a.id} className="bg-marfil rounded-2xl border border-arena shadow-sm overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-rosa-palo/20 transition"
              >
                <div>
                  <p className="font-bold text-tinta">
                    📅 {new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
                  </p>
                  <p className="text-sm text-gray-500 truncate max-w-md">{summary(a)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {a.valor && (
                    <span className="bg-salvia/15 text-salvia font-bold text-xs px-3 py-1 rounded-full">
                      ${Number(a.valor).toLocaleString('es-CL')}
                    </span>
                  )}
                  {a.boleta_emitida && (
                    <span className="bg-arena/70 text-tinta font-bold text-xs px-3 py-1 rounded-full">
                      🧾 Boleta
                    </span>
                  )}
                  <span className="text-gray-400">{expanded === a.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === a.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-bold text-blue-900 uppercase text-xs mb-1">Procedimientos</p>
                    {PROCEDIMIENTOS.filter(([key]) => a[key] === 'SI').map(([key, label]) => (
                      <p key={key} className="text-gray-700">✓ {label}</p>
                    ))}
                    {a.otros_procedimientos && <p className="text-gray-700">✓ {a.otros_procedimientos}</p>}
                  </div>
                  <div>
                    <p className="font-bold text-blue-900 uppercase text-xs mb-1">Recomendaciones</p>
                    {RECOMENDACIONES.filter(([key]) => a[key] === 'SI').map(([key, label]) => (
                      <p key={key} className="text-gray-700">✓ {label}</p>
                    ))}
                  </div>
                  {a.medicamentos && (
                    <div>
                      <p className="font-bold text-blue-900 uppercase text-xs mb-1">Medicamentos</p>
                      <p className="text-gray-700">{a.medicamentos}</p>
                    </div>
                  )}
                  {a.observaciones && (
                    <div>
                      <p className="font-bold text-blue-900 uppercase text-xs mb-1">Observaciones</p>
                      <p className="text-gray-700">{a.observaciones}</p>
                    </div>
                  )}
                  {(a.tiempo_consulta || a.proxima_atencion || a.valor) && (
                    <div>
                      <p className="font-bold text-blue-900 uppercase text-xs mb-1">Datos</p>
                      {a.valor && (
                        <p className="text-gray-700 font-semibold">
                          💰 Valor: ${Number(a.valor).toLocaleString('es-CL')}
                        </p>
                      )}
                      {a.tiempo_consulta && <p className="text-gray-700">Duración: {a.tiempo_consulta}</p>}
                      {a.proxima_atencion && (
                        <p className="text-gray-700">
                          Próxima atención: {new Date(a.proxima_atencion + 'T00:00:00').toLocaleDateString('es-CL')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
