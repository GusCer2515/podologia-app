// Feriados legales de Chile, por fecha exacta (YYYY-MM-DD).
// Se usan SOLO como aviso visual en la agenda: no bloquean el día por sí
// solos, el admin decide si bloquea o atiende.
//
// ⚠️ IMPORTANTE: algunos feriados son "movibles" (San Pedro y San Pablo,
// Encuentro de Dos Mundos, Iglesias Evangélicas, Pueblos Indígenas) y
// cambian de fecha cada año. Verificar y agregar años nuevos en
// https://www.feriados.cl (o el calendario oficial) una vez al año.

const FERIADOS: Record<string, string> = {
  // ---------------- 2025 ----------------
  '2025-01-01': 'Año Nuevo',
  '2025-04-18': 'Viernes Santo',
  '2025-04-19': 'Sábado Santo',
  '2025-05-01': 'Día del Trabajo',
  '2025-05-21': 'Día de las Glorias Navales',
  '2025-06-20': 'Día Nacional de los Pueblos Indígenas',
  '2025-06-29': 'San Pedro y San Pablo',
  '2025-07-16': 'Virgen del Carmen',
  '2025-08-15': 'Asunción de la Virgen',
  '2025-09-18': 'Independencia Nacional',
  '2025-09-19': 'Día de las Glorias del Ejército',
  '2025-10-12': 'Encuentro de Dos Mundos',
  '2025-10-31': 'Día de las Iglesias Evangélicas',
  '2025-11-01': 'Día de Todos los Santos',
  '2025-12-08': 'Inmaculada Concepción',
  '2025-12-25': 'Navidad',

  // ---------------- 2026 ----------------
  '2026-01-01': 'Año Nuevo',
  '2026-04-03': 'Viernes Santo',
  '2026-04-04': 'Sábado Santo',
  '2026-05-01': 'Día del Trabajo',
  '2026-05-21': 'Día de las Glorias Navales',
  '2026-06-21': 'Día Nacional de los Pueblos Indígenas',
  '2026-06-29': 'San Pedro y San Pablo',
  '2026-07-16': 'Virgen del Carmen',
  '2026-08-15': 'Asunción de la Virgen',
  '2026-09-18': 'Independencia Nacional',
  '2026-09-19': 'Día de las Glorias del Ejército',
  '2026-10-12': 'Encuentro de Dos Mundos',
  '2026-10-31': 'Día de las Iglesias Evangélicas',
  '2026-11-01': 'Día de Todos los Santos',
  '2026-12-08': 'Inmaculada Concepción',
  '2026-12-25': 'Navidad',

  // ---------------- 2027 ----------------
  '2027-01-01': 'Año Nuevo',
  '2027-03-26': 'Viernes Santo',
  '2027-03-27': 'Sábado Santo',
  '2027-05-01': 'Día del Trabajo',
  '2027-05-21': 'Día de las Glorias Navales',
  '2027-06-21': 'Día Nacional de los Pueblos Indígenas',
  '2027-06-28': 'San Pedro y San Pablo', // movido (29 cae martes)
  '2027-07-16': 'Virgen del Carmen',
  '2027-08-15': 'Asunción de la Virgen',
  '2027-09-18': 'Independencia Nacional',
  '2027-09-19': 'Día de las Glorias del Ejército',
  '2027-10-11': 'Encuentro de Dos Mundos', // movido (12 cae martes)
  '2027-10-31': 'Día de las Iglesias Evangélicas',
  '2027-11-01': 'Día de Todos los Santos',
  '2027-12-08': 'Inmaculada Concepción',
  '2027-12-25': 'Navidad',
}

// Devuelve el nombre del feriado para una fecha ISO (YYYY-MM-DD), o null.
export function getFeriado(iso: string): string | null {
  return FERIADOS[iso] ?? null
}

export function esFeriado(iso: string): boolean {
  return iso in FERIADOS
}
