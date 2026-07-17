-- ============================================================
-- FASE 19: RUT único a nivel de base de datos (anti-duplicados)
-- Ejecutar en Supabase SQL Editor
-- (El correo de avisos se guarda dentro de clinic_info, no aquí)
-- ============================================================

-- Evitar pacientes con el mismo RUT: índice único sobre el RUT
-- normalizado (ignora vacíos y RUT muy cortos)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_patient_rut
  ON patients (regexp_replace(upper(coalesce(rut, '')), '[^0-9K]', '', 'g'))
  WHERE rut IS NOT NULL AND length(regexp_replace(upper(coalesce(rut, '')), '[^0-9K]', '', 'g')) >= 7;
