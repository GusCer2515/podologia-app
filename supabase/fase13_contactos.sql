-- ============================================================
-- FASE 13: Datos de contacto editables desde el panel
-- El público solo puede leer la clave clinic_info (nada más)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "public_read_clinic_info" ON app_settings;
CREATE POLICY "public_read_clinic_info" ON app_settings
  FOR SELECT TO anon USING (key = 'clinic_info');
