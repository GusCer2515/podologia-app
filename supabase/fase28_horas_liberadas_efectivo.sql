-- ============================================================
-- FASE 28
--  A) Horas liberadas: avisar en el sitio cuando se cancela una hora
--  B) Pagos en efectivo: conciliar atenciones sin depósito en la cartola
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- A.1 Marca de cuándo se canceló una cita
-- ------------------------------------------------------------
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

-- Se llena sola al pasar la cita a 'cancelled' (y se limpia si se reagenda)
CREATE OR REPLACE FUNCTION marcar_cancelacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    NEW.cancelled_at := (now() AT TIME ZONE 'America/Santiago');
  ELSIF NEW.status <> 'cancelled' THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marcar_cancelacion ON appointments;
CREATE TRIGGER trg_marcar_cancelacion
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION marcar_cancelacion();

-- ------------------------------------------------------------
-- A.2 Horas que se liberaron por una cancelación
--     Devuelve SOLO la hora: ningún dato del paciente sale de aquí,
--     porque esta función la consulta el sitio público (anon).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_freed_slots(DATE);
CREATE OR REPLACE FUNCTION get_freed_slots(p_date DATE)
RETURNS TABLE (slot TIME, cancelled_at TIMESTAMP)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT appointment_date::time, appointments.cancelled_at
  FROM appointments
  WHERE appointment_date::date = p_date
    AND status = 'cancelled'
    AND appointments.cancelled_at IS NOT NULL
    -- solo cancelaciones recientes: una hora liberada hace una semana
    -- ya no es novedad para nadie
    AND appointments.cancelled_at > (now() AT TIME ZONE 'America/Santiago') - INTERVAL '48 hours';
$$;

REVOKE ALL ON FUNCTION get_freed_slots(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_freed_slots(DATE) TO anon, authenticated;

-- ------------------------------------------------------------
-- B) Pagos en efectivo
--    Una atención pagada en efectivo nunca aparecerá en la cartola:
--    se marca a mano para que no quede como pendiente de cobro.
-- ------------------------------------------------------------
ALTER TABLE attentions ADD COLUMN IF NOT EXISTS pago_efectivo BOOLEAN DEFAULT FALSE;
ALTER TABLE attentions ADD COLUMN IF NOT EXISTS pago_efectivo_fecha TIMESTAMP;
