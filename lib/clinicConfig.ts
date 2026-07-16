// ============================================================
// Datos del negocio
// - CLINIC: valores por defecto (respaldo)
// - getClinicInfo(): versión editable desde ⚙️ Configuración
//   (se guarda en app_settings, clave "clinic_info")
// ============================================================

import { getSetting } from './supabase'

export const CLINIC = {
  brand: 'Vida de Colores',
  subtitle: 'SERVICIOS DE PODOLOGÍA CLÍNICA',
  professional: 'Jahel Rivera Soto',
  rut: '18.483.447-2',
  instagram: '@vidadecolores_podologia',
  phone: '+56944187670',
  email: 'podologiavidadecolores@gmail.com',
}

export type ClinicInfo = typeof CLINIC

let cached: ClinicInfo | null = null

// Lee los datos editables y los mezcla sobre los por defecto
export async function getClinicInfo(): Promise<ClinicInfo> {
  if (cached) return cached
  try {
    const value = await getSetting('clinic_info')
    if (value) {
      cached = { ...CLINIC, ...JSON.parse(value) }
      return cached
    }
  } catch {
    // sin configuración guardada o sin permisos: usar valores por defecto
  }
  cached = CLINIC
  return cached
}

// Llamar tras guardar cambios para que se reflejen sin recargar
export function clearClinicInfoCache() {
  cached = null
}
