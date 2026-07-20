-- ============================================================
-- FASE 29: Correos de confirmación y cancelación
--  - Se registra qué cita ya recibió cada aviso (no se envía dos veces)
--  - El contacto incluye el tipo de servicio, para redactar el correo
--  - Listado de citas futuras que quedaron sin confirmación
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_sent_at TIMESTAMP;

-- ------------------------------------------------------------
-- 1. Contacto de la cita + tipo de servicio y fecha
--    (lo usa el servidor para armar el correo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_appointment_contact(p_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  r RECORD;
  v_previas INTEGER;
BEGIN
  SELECT pt.id AS pid, pt.name, pt.email, pt.phone,
         a.appointment_date, a.status,
         COALESCE(a.tipo, 'podologia') AS tipo,
         ns.nombre AS servicio
  INTO r
  FROM appointments a
  JOIN patients pt ON pt.id = a.patient_id
  LEFT JOIN nail_services ns ON ns.id = a.nail_service_id
  WHERE a.id = p_id;

  IF r IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  -- ¿Tiene otras citas además de esta? Si no, es paciente nuevo
  SELECT count(*) INTO v_previas
  FROM appointments
  WHERE patient_id = r.pid
    AND id <> p_id
    AND status <> 'cancelled';

  RETURN json_build_object(
    'found', true,
    'name', r.name,
    'email', r.email,
    'phone', r.phone,
    'es_nuevo', v_previas = 0,
    'tipo', r.tipo,
    'servicio', r.servicio,
    'status', r.status,
    'fecha', to_char(r.appointment_date, 'YYYY-MM-DD'),
    'hora', to_char(r.appointment_date, 'HH24:MI')
  );
END;
$$;

REVOKE ALL ON FUNCTION get_appointment_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_appointment_contact(UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. Marcar que el aviso ya salió, para no repetirlo
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS mark_notification_sent(UUID, TEXT);
CREATE OR REPLACE FUNCTION mark_notification_sent(p_id UUID, p_tipo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tipo = 'cancelacion' THEN
    UPDATE appointments
       SET cancellation_sent_at = (now() AT TIME ZONE 'America/Santiago')
     WHERE id = p_id;
  ELSE
    UPDATE appointments
       SET confirmation_sent_at = (now() AT TIME ZONE 'America/Santiago')
     WHERE id = p_id;
  END IF;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION mark_notification_sent(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_notification_sent(UUID, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. Citas futuras agendadas que nunca recibieron confirmación
--    Solo para el panel: devuelve datos del paciente, así que
--    queda restringida a usuarios autenticados.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS pending_confirmations();
CREATE OR REPLACE FUNCTION pending_confirmations()
RETURNS TABLE (
  id UUID,
  appointment_date TIMESTAMP,
  tipo TEXT,
  servicio TEXT,
  patient_name TEXT,
  patient_email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.id,
         a.appointment_date,
         COALESCE(a.tipo, 'podologia')::TEXT,
         ns.nombre::TEXT,
         pt.name::TEXT,
         pt.email::TEXT
  FROM appointments a
  JOIN patients pt ON pt.id = a.patient_id
  LEFT JOIN nail_services ns ON ns.id = a.nail_service_id
  WHERE a.status = 'scheduled'
    AND a.confirmation_sent_at IS NULL
    -- Solo futuras: avisar "tu hora quedó reservada" de una cita que ya
    -- pasó solo confundiría al paciente
    AND a.appointment_date >= (now() AT TIME ZONE 'America/Santiago')
  ORDER BY a.appointment_date;
$$;

REVOKE ALL ON FUNCTION pending_confirmations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pending_confirmations() TO authenticated;

-- ------------------------------------------------------------
-- 4. Las citas ya avisadas antes de esta fase no deben reaparecer
--    como pendientes: se marcan las que YA pasaron.
-- ------------------------------------------------------------
UPDATE appointments
   SET confirmation_sent_at = created_at
 WHERE confirmation_sent_at IS NULL
   AND appointment_date < (now() AT TIME ZONE 'America/Santiago');
