-- ============================================================
-- FASE 25: Horas fijas que se ofrecen en el sitio público
-- El paciente solo ve estas horas de inicio (podología, 1 h de
-- atención + 15 min de preparación), y únicamente las que estén
-- realmente disponibles ese día.
--   Mañana: 08:30 · 09:00 · 09:15 · 10:45 · 11:45
--   Tarde:  15:30 · 16:00 · 16:45 · 17:45 · 18:45 · 19:45
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

INSERT INTO app_settings (key, value)
VALUES ('public_slots', '08:30,09:00,09:15,10:45,11:45,15:30,16:00,16:45,17:45,18:45,19:45')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- El sitio público necesita leer esta lista
DROP POLICY IF EXISTS "public_read_clinic_info" ON app_settings;
CREATE POLICY "public_read_clinic_info" ON app_settings
  FOR SELECT TO anon
  USING (key IN ('clinic_info', 'buffer_podologia', 'buffer_manicura', 'public_slots'));
