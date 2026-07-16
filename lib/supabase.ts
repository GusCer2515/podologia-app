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
}

export async function bookAppointment(booking: BookingData) {
  const { data, error } = await supabase.rpc('book_appointment', {
    p_name: booking.name,
    p_email: booking.email,
    p_phone: booking.phone,
    p_rut: booking.rut,
    p_datetime: booking.datetime,
    p_notes: booking.notes ?? null,
  })
  if (error) throw error
  return data as { success: boolean; error?: string; appointment_id?: string }
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

export async function getPatientAppointments(patientId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: false })

  if (error) throw error
  return data
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
    .select('*, patients(id, name, phone)')
    .gte('appointment_date', startIso)
    .lt('appointment_date', endIso)
    .order('appointment_date', { ascending: true })

  if (error) throw error
  return data
}

export async function updateAppointmentStatus(id: string, status: string) {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}
