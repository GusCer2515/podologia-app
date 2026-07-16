'use client'

import { useEffect, useState } from 'react'
import { getClinicalRecord, upsertClinicalRecord } from '@/lib/supabase'
import { showToast } from '@/components/toast'
import { PillSelect, TextField, TextAreaField, FormSection } from '@/components/fields'

const SI_NO = ['SI', 'NO']
const GRADO = ['NO', 'LEVE', 'REGULAR', 'AGUDO']
const FRECUENCIA = ['ESCASO', 'REGULAR', 'FRECUENTE']

// Campos que se guardan en la BD (deben calzar con clinical_records)
const FIELD_KEYS = [
  'hta', 'hta_anos_evolucion', 'hta_tratamiento',
  'diabetes', 'diabetes_anos_evolucion', 'diabetes_tipo', 'diabetes_tratamiento',
  'otras_patologias',
  'limitacion_movilidad', 'pulso_pedio', 'valor_min', 'sensibilidad',
  'hiperqueratosis_plantar', 'heloma_dorsal', 'heloma_miliar', 'heloma_interdigital', 'otros_helomas',
  'hallux_valgus', 'pie_charcot', 'dedo_en_garra', 'neuropatico',
  'pie_plano', 'angiopatico', 'pie_cavo', 'pie_diabetico', 'otras_alteraciones',
  'anhidrosis', 'hiperhidrosis', 'bromhidrosis', 'heridas', 'ulceras',
  'dermomicosis', 'resequedad', 'otros_pie',
  'unas_sanas', 'onicomicosis', 'incarnadas', 'involutas', 'otros_unas',
  'calzado_inadecuado', 'higiene_autocuidado', 'deporte',
  'observaciones',
]

export default function ClinicalRecordForm({ patientId }: { patientId: string }) {
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  useEffect(() => {
    getClinicalRecord(patientId)
      .then((record) => {
        if (record) {
          setForm(record)
          setLastUpdate(record.updated_at)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [patientId])

  const set = (key: string) => (value: string) =>
    setForm((prev: any) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const payload: any = {}
      for (const key of FIELD_KEYS) payload[key] = form[key] ?? null
      await upsertClinicalRecord(patientId, payload)
      setLastUpdate(new Date().toISOString())
      showToast('Ficha clínica guardada')
    } catch (err) {
      showToast('Error guardando la ficha', 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-500 py-6 text-center">Cargando ficha clínica...</p>

  return (
    <div className="max-w-5xl space-y-4 pb-2">
      <FormSection title="Antecedentes Patológicos" icon="🫀">
        <PillSelect label="HTA (hipertensión)" value={form.hta} onChange={set('hta')} options={SI_NO} />
        <TextField label="Años de evolución (HTA)" value={form.hta_anos_evolucion} onChange={set('hta_anos_evolucion')} />
        <TextField label="Tratamiento (HTA)" value={form.hta_tratamiento} onChange={set('hta_tratamiento')} />
        <PillSelect label="Diabetes" value={form.diabetes} onChange={set('diabetes')} options={SI_NO} />
        <TextField label="Años de evolución (Diabetes)" value={form.diabetes_anos_evolucion} onChange={set('diabetes_anos_evolucion')} />
        <TextField label="Tipo (Diabetes)" value={form.diabetes_tipo} onChange={set('diabetes_tipo')} />
        <TextField label="Tratamiento (Diabetes)" value={form.diabetes_tratamiento} onChange={set('diabetes_tratamiento')} />
        <TextAreaField label="Otras patologías" value={form.otras_patologias} onChange={set('otras_patologias')} />
      </FormSection>

      <FormSection title="Evaluación Física" icon="🩺">
        <PillSelect label="Limitación de movilidad" value={form.limitacion_movilidad} onChange={set('limitacion_movilidad')} options={SI_NO} />
        <PillSelect label="Pulso pedio" value={form.pulso_pedio} onChange={set('pulso_pedio')} options={FRECUENCIA} />
        <TextField label="Valor/min" value={form.valor_min} onChange={set('valor_min')} />
        <PillSelect label="Sensibilidad" value={form.sensibilidad} onChange={set('sensibilidad')} options={GRADO} />
      </FormSection>

      <FormSection title="Hiperqueratosis y/o Queratomas" icon="🦶">
        <PillSelect label="Hiperqueratosis plantar" value={form.hiperqueratosis_plantar} onChange={set('hiperqueratosis_plantar')} options={GRADO} />
        <PillSelect label="Heloma dorsal" value={form.heloma_dorsal} onChange={set('heloma_dorsal')} options={GRADO} />
        <PillSelect label="Heloma miliar" value={form.heloma_miliar} onChange={set('heloma_miliar')} options={GRADO} />
        <PillSelect label="Heloma interdigital" value={form.heloma_interdigital} onChange={set('heloma_interdigital')} options={GRADO} />
        <TextAreaField label="Otros helomas" value={form.otros_helomas} onChange={set('otros_helomas')} />
      </FormSection>

      <FormSection title="Alteraciones Ortopédicas" icon="🦴">
        <PillSelect label="Hallux valgus" value={form.hallux_valgus} onChange={set('hallux_valgus')} options={SI_NO} />
        <PillSelect label="Pie de Charcot" value={form.pie_charcot} onChange={set('pie_charcot')} options={SI_NO} />
        <PillSelect label="Dedo en garra" value={form.dedo_en_garra} onChange={set('dedo_en_garra')} options={SI_NO} />
        <PillSelect label="Neuropático" value={form.neuropatico} onChange={set('neuropatico')} options={SI_NO} />
        <PillSelect label="Pie plano" value={form.pie_plano} onChange={set('pie_plano')} options={SI_NO} />
        <PillSelect label="Angiopático" value={form.angiopatico} onChange={set('angiopatico')} options={SI_NO} />
        <PillSelect label="Pie cavo" value={form.pie_cavo} onChange={set('pie_cavo')} options={SI_NO} />
        <PillSelect label="Pie diabético" value={form.pie_diabetico} onChange={set('pie_diabetico')} options={SI_NO} />
        <TextAreaField label="Otros" value={form.otras_alteraciones} onChange={set('otras_alteraciones')} />
      </FormSection>

      <FormSection title="Estado del Pie" icon="👣">
        <PillSelect label="Anhidrosis" value={form.anhidrosis} onChange={set('anhidrosis')} options={SI_NO} />
        <PillSelect label="Hiperhidrosis" value={form.hiperhidrosis} onChange={set('hiperhidrosis')} options={SI_NO} />
        <PillSelect label="Bromhidrosis" value={form.bromhidrosis} onChange={set('bromhidrosis')} options={SI_NO} />
        <PillSelect label="Heridas" value={form.heridas} onChange={set('heridas')} options={SI_NO} />
        <PillSelect label="Úlceras" value={form.ulceras} onChange={set('ulceras')} options={SI_NO} />
        <PillSelect label="Dermomicosis" value={form.dermomicosis} onChange={set('dermomicosis')} options={SI_NO} />
        <PillSelect label="Resequedad" value={form.resequedad} onChange={set('resequedad')} options={SI_NO} />
        <TextAreaField label="Otros" value={form.otros_pie} onChange={set('otros_pie')} />
      </FormSection>

      <FormSection title="Estado de las Uñas" icon="💅">
        <PillSelect label="Sanas" value={form.unas_sanas} onChange={set('unas_sanas')} options={SI_NO} />
        <PillSelect label="Onicomicosis" value={form.onicomicosis} onChange={set('onicomicosis')} options={SI_NO} />
        <PillSelect label="Incarnadas" value={form.incarnadas} onChange={set('incarnadas')} options={SI_NO} />
        <PillSelect label="Involutas" value={form.involutas} onChange={set('involutas')} options={SI_NO} />
        <TextAreaField label="Otros" value={form.otros_unas} onChange={set('otros_unas')} />
      </FormSection>

      <FormSection title="Autocuidado" icon="🧼">
        <PillSelect label="Calzado inadecuado" value={form.calzado_inadecuado} onChange={set('calzado_inadecuado')} options={SI_NO} />
        <PillSelect label="Higiene" value={form.higiene_autocuidado} onChange={set('higiene_autocuidado')} options={SI_NO} />
        <PillSelect label="Deporte" value={form.deporte} onChange={set('deporte')} options={SI_NO} />
      </FormSection>

      <FormSection title="Observaciones" icon="📝">
        <TextAreaField label="Observaciones generales" value={form.observaciones} onChange={set('observaciones')} rows={4} />
      </FormSection>

      {/* Barra de guardado flotante: siempre a mano */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-tinta rounded-full shadow-xl shadow-tinta/30 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-marfil/70">
            {lastUpdate
              ? `Última actualización: ${new Date(lastUpdate).toLocaleString('es-CL')}`
              : 'Ficha aún sin guardar'}
          </p>
          <button
            onClick={save}
            disabled={saving}
            className="bg-rosa text-marfil px-8 py-2 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar ficha'}
          </button>
        </div>
      </div>
    </div>
  )
}
