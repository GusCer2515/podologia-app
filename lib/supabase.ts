import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================
// AUTENTICACIÓN (Supabase Auth — para el panel admin)
// ============================================================

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ============================================================
// AGENDAMIENTO PÚBLICO (vía RPC seguro — única puerta de entrada)
// ============================================================

export interface BookingData {
  name: string
  email: string
  phone: string
  rut: string
  datetime: string // formato: "2026-07-20T10:00:00"
  notes?: string
  duration?: number
}

export async function bookAppointment(booking: BookingData) {
  const { data, error } = await supabase.rpc('book_appointment', {
    p_name: booking.name,
    p_email: booking.email,
    p_phone: booking.phone,
    p_rut: booking.rut,
    p_datetime: booking.datetime,
    p_notes: booking.notes ?? null,
    p_duration: booking.duration ?? 60,
  })
  if (error) throw error
  return data as { success: boolean; error?: string; appointment_id?: string }
}

// Reconocer paciente por RUT desde el sitio público (solo devuelve el nombre)
export async function findPatientByRut(rut: string) {
  const { data, error } = await supabase.rpc('find_patient_by_rut', { p_rut: rut })
  if (error) throw error
  return data as { found: boolean; name?: string }
}

export async function getOccupiedSlots(date: string) {
  const { data, error } = await supabase.rpc('get_occupied_slots', {
    p_date: date,
  })
  if (error) throw error
  return (data ?? []) as { slot: string }[]
}

export async function getAvailability() {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('is_active', true)

  if (error) throw error
  return data
}

export async function getBlockouts() {
  const { data, error } = await supabase
    .from('blockouts')
    .select('*')

  if (error) throw error
  return data
}

// ============================================================
// FUNCIONES ADMIN (requieren sesión autenticada — RLS las protege)
// ============================================================

export async function getAppointments() {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(name, email, phone, insurance)')
    .order('appointment_date', { ascending: true })

  if (error) throw error
  return data
}

export async function getPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function getPatient(id: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updatePatient(id: string, fields: any) {
  const { error } = await supabase
    .from('patients')
    .update(fields)
    .eq('id', id)

  if (error) throw error
}

export async function createPatientAdmin(fields: any) {
  const { data, error } = await supabase
    .from('patients')
    .insert([fields])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePatient(id: string) {
  // Elimina también citas, ficha, atenciones y documentos (cascada en BD)
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) throw error
}

export async function getPatientAppointments(patientId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, nail_services(nombre)')
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: false })

  if (error) throw error
  return data
}

// ============================================================
// CONFIGURACIÓN: horarios, bloqueos y convenios (solo admin)
// ============================================================

export async function getAllAvailability() {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .order('day_of_week', { ascending: true })

  if (error) throw error
  return data
}

// Reemplaza TODOS los bloques de atención de un día
export async function saveDayBlocks(
  dayOfWeek: number,
  bloques: { start_time: string; end_time: string }[]
) {
  const { error: delError } = await supabase
    .from('availability')
    .delete()
    .eq('day_of_week', dayOfWeek)
  if (delError) throw delError

  if (bloques.length === 0) return

  const { error } = await supabase.from('availability').insert(
    bloques.map((b) => ({
      day_of_week: dayOfWeek,
      start_time: b.start_time,
      end_time: b.end_time,
      is_active: true,
    }))
  )
  if (error) throw error
}

export async function saveAvailability(dayOfWeek: number, fields: any) {
  const { data: existing, error: qError } = await supabase
    .from('availability')
    .select('id')
    .eq('day_of_week', dayOfWeek)
    .limit(1)

  if (qError) throw qError

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('availability')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', existing[0].id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('availability')
      .insert([{ ...fields, day_of_week: dayOfWeek }])
    if (error) throw error
  }
}

export async function addBlockout(fields: any) {
  const { error } = await supabase.from('blockouts').insert([fields])
  if (error) throw error
}

export async function deleteBlockout(id: string) {
  const { error } = await supabase.from('blockouts').delete().eq('id', id)
  if (error) throw error
}

export async function getConvenios() {
  const { data, error } = await supabase
    .from('convenios')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw error
  return data
}

export async function addConvenio(nombre: string, valor: number) {
  const { error } = await supabase.from('convenios').insert([{ nombre, valor }])
  if (error) throw error
}

export async function updateConvenio(id: string, fields: any) {
  const { error } = await supabase.from('convenios').update(fields).eq('id', id)
  if (error) throw error
}

export async function getSetting(key: string) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) throw error
  return data?.value ?? null
}

export async function saveSetting(key: string, value: string) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })

  if (error) throw error
}

export async function deleteConvenio(id: string) {
  const { error } = await supabase.from('convenios').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CONTENIDO DEL SITIO: carrusel de casos y noticias
// ============================================================

// Sube imagen al bucket público y devuelve su URL
export async function uploadPublicImage(folder: string, file: File): Promise<string> {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
  const path = `${folder}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from('public-images').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('public-images').getPublicUrl(path)
  return data.publicUrl
}

export async function getCarouselCases() {
  const { data, error } = await supabase
    .from('carousel_cases')
    .select('*')
    .eq('is_active', true)
    .order('orden', { ascending: true })
  if (error) throw error
  return data
}

export async function getAllCarouselCases() {
  const { data, error } = await supabase
    .from('carousel_cases')
    .select('*')
    .order('orden', { ascending: true })
  if (error) throw error
  return data
}

export async function addCarouselCase(payload: any) {
  const { error } = await supabase.from('carousel_cases').insert([payload])
  if (error) throw error
}

export async function updateCarouselCase(id: string, fields: any) {
  const { error } = await supabase.from('carousel_cases').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteCarouselCase(id: string) {
  const { error } = await supabase.from('carousel_cases').delete().eq('id', id)
  if (error) throw error
}

export async function getPublishedPosts(limit?: number) {
  let query = supabase
    .from('posts')
    .select('*')
    .eq('publicado', true)
    .order('created_at', { ascending: false })
  if (limit) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getAllPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createPost(payload: any) {
  const { error } = await supabase.from('posts').insert([payload])
  if (error) throw error
}

export async function updatePost(id: string, fields: any) {
  const { error } = await supabase
    .from('posts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deletePost(id: string) {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// TESTIMONIOS DE PACIENTES
// ============================================================

// Público: solo los aprobados
export async function getApprovedTestimonials() {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('aprobado', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Envío desde el sitio (queda pendiente de aprobación)
export async function submitTestimonial(nombre: string, rating: number, comentario: string) {
  const { data, error } = await supabase.rpc('submit_testimonial', {
    p_nombre: nombre,
    p_rating: rating,
    p_comentario: comentario,
  })
  if (error) throw error
  return data as { success: boolean; error?: string }
}

// Admin: todos (para moderar)
export async function getAllTestimonials() {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function updateTestimonial(id: string, fields: any) {
  const { error } = await supabase.from('testimonials').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteTestimonial(id: string) {
  const { error } = await supabase.from('testimonials').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// FICHA CLÍNICA
// ============================================================

export async function getClinicalRecord(patientId: string) {
  const { data, error } = await supabase
    .from('clinical_records')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertClinicalRecord(patientId: string, fields: any) {
  const { error } = await supabase
    .from('clinical_records')
    .upsert(
      { ...fields, patient_id: patientId, updated_at: new Date().toISOString() },
      { onConflict: 'patient_id' }
    )

  if (error) throw error
}

// ============================================================
// ATENCIONES (historial)
// ============================================================

export async function getAttentions(patientId: string) {
  const { data, error } = await supabase
    .from('attentions')
    .select('*')
    .eq('patient_id', patientId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createAttention(payload: any) {
  const { data, error } = await supabase
    .from('attentions')
    .insert([payload])
    .select()

  if (error) throw error
  return data
}

// ============================================================
// DOCUMENTOS (recetas e indicaciones en PDF)
// ============================================================

export async function getDocuments(patientId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createDocument(payload: any) {
  const { data, error } = await supabase
    .from('documents')
    .insert([payload])
    .select()
    .single()

  if (error) throw error
  return data
}

// Sube el PDF al bucket privado "documents"
export async function uploadDocumentPdf(path: string, blob: Blob) {
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, blob, { contentType: 'application/pdf', upsert: true })

  if (error) throw error
}

// Genera un link firmado temporal (30 días) para compartir el PDF
// ============================================================
// DERIVACIONES MÉDICAS
// ============================================================

export async function getReferrals(patientId: string) {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createReferral(payload: any) {
  const { error } = await supabase.from('referrals').insert([payload])
  if (error) throw error
}

export async function deleteReferral(id: string, pdfPath?: string) {
  if (pdfPath) await supabase.storage.from('documents').remove([pdfPath])
  const { error } = await supabase.from('referrals').delete().eq('id', id)
  if (error) throw error
}

// ¿El paciente tiene alguna derivación? (para la etiqueta "Derivado")
export async function countReferrals(patientId: string) {
  const { count, error } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
  if (error) throw error
  return count ?? 0
}

// Elimina el registro y también el PDF del almacenamiento
export async function deleteDocument(id: string, pdfPath?: string) {
  if (pdfPath) {
    await supabase.storage.from('documents').remove([pdfPath])
  }
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}

export async function getDocumentSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 60 * 60 * 24 * 30)

  if (error) throw error
  return data.signedUrl
}

export async function getAppointmentsBetween(startIso: string, endIso: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(id, name, phone, insurance), nail_services(nombre, duracion_minutes)')
    .gte('appointment_date', startIso)
    .lt('appointment_date', endIso)
    .order('appointment_date', { ascending: true })

  if (error) throw error
  return data
}

export async function getAttentionsBetween(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('attentions')
    .select('*, patients(id, name, rut, insurance)')
    .gte('fecha', startDate)
    .lte('fecha', endDate)
    .order('fecha', { ascending: true })

  if (error) throw error
  return data
}

export async function updateAttention(id: string, fields: any) {
  const { error } = await supabase.from('attentions').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteAttention(id: string) {
  const { error } = await supabase.from('attentions').delete().eq('id', id)
  if (error) throw error
}

// El admin agenda directamente (el índice único de la BD evita duplicados)
// extra: tipo ('podologia' | 'manicura'), nail_service_id y valor para citas de manicura
export async function adminCreateAppointment(
  patientId: string,
  datetime: string,
  notes?: string,
  extra?: { tipo?: string; nail_service_id?: string | null; valor?: number | null; duration_minutes?: number }
) {
  const { data, error } = await supabase
    .from('appointments')
    .insert([{ patient_id: patientId, appointment_date: datetime, notes: notes || null, ...extra }])
    .select('id')
    .single()
  if (error) throw error
  return data?.id as string | undefined
}

// Citas recientes creadas desde el sitio web (para el centro de notificaciones)
export async function getRecentWebBookings(limit = 20) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, appointment_date, created_at, status, patients(id, name, phone)')
    .eq('origin', 'web')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// ============================================================
// SERVICIOS DE MANICURA (Nails)
// ============================================================

export async function getNailServices(soloActivos = false) {
  let query = supabase.from('nail_services').select('*').order('nombre', { ascending: true })
  if (soloActivos) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function addNailService(payload: any) {
  const { error } = await supabase.from('nail_services').insert([payload])
  if (error) throw error
}

export async function updateNailService(id: string, fields: any) {
  const { error } = await supabase.from('nail_services').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteNailService(id: string) {
  const { error } = await supabase.from('nail_services').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CALENDARIO DE CONTENIDO (Instagram)
// ============================================================

export async function getContentPlan(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('content_plan')
    .select('*')
    .gte('fecha', startDate)
    .lte('fecha', endDate)
    .order('fecha', { ascending: true })
  if (error) throw error
  return data
}

export async function createContentPost(payload: any) {
  const { error } = await supabase.from('content_plan').insert([payload])
  if (error) throw error
}

export async function updateContentPost(id: string, fields: any) {
  const { error } = await supabase
    .from('content_plan')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteContentPost(id: string) {
  const { error } = await supabase.from('content_plan').delete().eq('id', id)
  if (error) throw error
}

// Reagendar: nueva fecha/hora y vuelve a estado "agendada"
export async function rescheduleAppointment(id: string, datetime: string) {
  const { error } = await supabase
    .from('appointments')
    .update({ appointment_date: datetime, status: 'scheduled', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function updateAppointmentStatus(id: string, status: string) {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}
