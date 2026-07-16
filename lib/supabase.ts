import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Funciones para BD
export async function createPatient(data: any) {
  const { data: patient, error } = await supabase
    .from('patients')
    .insert([data])
    .select()
  
  if (error) throw error
  return patient
}

export async function createAppointment(data: any) {
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert([data])
    .select()
  
  if (error) throw error
  return appointment
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

export async function checkAppointmentAvailability(appointmentDate: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('appointment_date', appointmentDate)
  
  if (error) throw error
  return data && data.length === 0 // true si está disponible
}
