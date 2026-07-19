-- ============================================================
-- FASE 26: El correo de confirmación distingue paciente nuevo
-- de paciente que ya se ha atendido (para el texto de la dirección)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

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
  SELECT pt.id AS pid, pt.name, pt.email, pt.phone INTO r
  FROM appointments a
  JOIN patients pt ON pt.id = a.patient_id
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
    'es_nuevo', v_previas = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION get_appointment_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_appointment_contact(UUID) TO anon, authenticated;
