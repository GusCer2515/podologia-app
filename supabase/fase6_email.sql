-- ============================================================
-- FASE 6: Verificación para notificaciones por email
-- (evita que alguien abuse del endpoint de correos)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION appointment_exists(p_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM appointments WHERE id = p_id);
$$;

REVOKE ALL ON FUNCTION appointment_exists(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION appointment_exists(UUID) TO anon, authenticated;
