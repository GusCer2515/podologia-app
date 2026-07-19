// Convierte la ficha clínica y la última atención en texto redactado
// para el informe de derivación. Solo se incluye lo que tiene hallazgo:
// un "NO" no aporta al informe y lo dejaría ilegible.

const esSi = (v: any) => String(v || '').toUpperCase() === 'SI'
const conGrado = (v: any) => {
  const g = String(v || '').toUpperCase()
  return g && g !== 'NO' ? g.toLowerCase() : ''
}

// Campos "SI/NO" agrupados por sección del informe
const ORTOPEDICAS: [string, string][] = [
  ['hallux_valgus', 'Hallux valgus'],
  ['pie_charcot', 'Pie de Charcot'],
  ['dedo_en_garra', 'Dedo en garra'],
  ['neuropatico', 'Pie neuropático'],
  ['pie_plano', 'Pie plano'],
  ['angiopatico', 'Pie angiopático'],
  ['pie_cavo', 'Pie cavo'],
  ['pie_diabetico', 'Pie diabético'],
]

const ESTADO_PIE: [string, string][] = [
  ['anhidrosis', 'Anhidrosis'],
  ['hiperhidrosis', 'Hiperhidrosis'],
  ['bromhidrosis', 'Bromhidrosis'],
  ['heridas', 'Presencia de heridas'],
  ['ulceras', 'Presencia de úlceras'],
  ['dermomicosis', 'Dermomicosis'],
  ['resequedad', 'Resequedad cutánea'],
]

const UNAS: [string, string][] = [
  ['onicomicosis', 'Onicomicosis'],
  ['incarnadas', 'Uñas incarnadas'],
  ['involutas', 'Uñas involutas'],
]

const QUERATOSIS: [string, string][] = [
  ['hiperqueratosis_plantar', 'Hiperqueratosis plantar'],
  ['heloma_dorsal', 'Heloma dorsal'],
  ['heloma_miliar', 'Heloma miliar'],
  ['heloma_interdigital', 'Heloma interdigital'],
]

export function antecedentesDe(r: any): string[] {
  if (!r) return []
  const out: string[] = []

  if (esSi(r.hta)) {
    const extra = [
      r.hta_anos_evolucion ? `${r.hta_anos_evolucion} años de evolución` : '',
      r.hta_tratamiento ? `en tratamiento con ${r.hta_tratamiento}` : '',
    ].filter(Boolean)
    out.push(`Hipertensión arterial${extra.length ? ` (${extra.join(', ')})` : ''}`)
  }

  if (esSi(r.diabetes)) {
    const extra = [
      r.diabetes_tipo ? `tipo ${r.diabetes_tipo}` : '',
      r.diabetes_anos_evolucion ? `${r.diabetes_anos_evolucion} años de evolución` : '',
      r.diabetes_tratamiento ? `en tratamiento con ${r.diabetes_tratamiento}` : '',
    ].filter(Boolean)
    out.push(`Diabetes mellitus${extra.length ? ` (${extra.join(', ')})` : ''}`)
  }

  if (r.otras_patologias) out.push(String(r.otras_patologias))
  return out
}

export function evaluacionPieDe(r: any): string[] {
  if (!r) return []
  const out: string[] = []
  if (esSi(r.limitacion_movilidad)) out.push('Presenta limitación de movilidad')
  if (r.pulso_pedio) {
    out.push(
      `Pulso pedio ${String(r.pulso_pedio).toLowerCase()}` +
        (r.valor_min ? ` (${r.valor_min}/min)` : '')
    )
  }
  if (r.sensibilidad) out.push(`Sensibilidad ${String(r.sensibilidad).toLowerCase()}`)
  return out
}

export function diagnosticoDe(r: any): string[] {
  if (!r) return []
  const out: string[] = []

  for (const [key, label] of QUERATOSIS) {
    const g = conGrado(r[key])
    if (g) out.push(`${label}: grado ${g}`)
  }
  if (r.otros_helomas) out.push(String(r.otros_helomas))

  const orto = ORTOPEDICAS.filter(([k]) => esSi(r[k])).map(([, l]) => l)
  if (orto.length) out.push(`Alteraciones ortopédicas: ${orto.join(', ')}`)
  if (r.otras_alteraciones) out.push(String(r.otras_alteraciones))

  const pie = ESTADO_PIE.filter(([k]) => esSi(r[k])).map(([, l]) => l)
  if (pie.length) out.push(`Estado del pie: ${pie.join(', ')}`)
  if (r.otros_pie) out.push(String(r.otros_pie))

  if (esSi(r.unas_sanas)) {
    out.push('Estado ungueal: uñas sanas')
  } else {
    const unas = UNAS.filter(([k]) => esSi(r[k])).map(([, l]) => l)
    if (unas.length) out.push(`Estado ungueal: ${unas.join(', ')}`)
  }
  if (r.otros_unas) out.push(String(r.otros_unas))

  if (esSi(r.calzado_inadecuado)) out.push('Uso de calzado inadecuado')
  if (esSi(r.higiene_autocuidado)) out.push('Mantiene higiene y autocuidado')
  if (esSi(r.deporte)) out.push('Realiza actividad deportiva')

  return out
}

const PROCEDIMIENTOS: [string, string][] = [
  ['limpieza_general', 'Limpieza general'],
  ['limpieza_laterales', 'Limpieza de laterales ungueales'],
  ['onicotomia', 'Onicotomía'],
  ['desbastado_unas', 'Desbastado de uñas'],
  ['resecado_hiperqueratosis', 'Resecado de hiperqueratosis'],
  ['resecado_helomas', 'Resecado de helomas'],
  ['masaje', 'Masaje'],
]

const RECOMENDACIONES: [string, string][] = [
  ['higiene', 'Higiene'],
  ['corte_unas', 'Corte de uñas'],
  ['aceite_arbol_te', 'Aceite de árbol de té'],
  ['vitaminas', 'Vitaminas'],
  ['otros_antifungicos', 'Otros antifúngicos'],
  ['vendaje', 'Vendaje'],
  ['crema_hidratante', 'Crema hidratante'],
  ['consulta_medica', 'Consulta médica'],
]

export function tratamientoDe(a: any): string[] {
  if (!a) return []
  const out = PROCEDIMIENTOS.filter(([k]) => esSi(a[k])).map(([, l]) => l)
  if (a.otros_procedimientos) out.push(String(a.otros_procedimientos))
  return out
}

export function recomendacionesDe(a: any): string[] {
  if (!a) return []
  return RECOMENDACIONES.filter(([k]) => esSi(a[k])).map(([, l]) => l)
}
