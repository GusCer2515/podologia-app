import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

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

export async function getAppointments() {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')

  if (error) throw error
  return data
}

export async function getPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select('*')

  if (error) throw error
  return data
}
