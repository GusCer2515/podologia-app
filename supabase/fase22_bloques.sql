-- ============================================================
-- FASE 22: Bloques de 15 min + tiempo de preparación entre atenciones
-- Tras cada atención se reserva un tiempo para limpiar y preparar:
--   podología 15 min · manicura 10 min (configurables)
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- 1. Tiempos de preparación configurables
INSERT INTO app_settings (key, value) VALUES ('buffer_podologia', '15')
ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('buffer_manicura', '10')
ON CONFLICT (key) DO NOTHING;

-- El sitio público necesita leerlos para calcular las horas libres
DROP POLICY IF EXISTS "public_read_clinic_info" ON app_settings;
CREATE POLICY "public_read_clinic_info" ON app_settings
  FOR SELECT TO anon
  USING (key IN ('clinic_info', 'buffer_podologia', 'buffer_manicura'));

-- ------------------------------------------------------------
-- 2. get_occupied_slots ahora informa el tipo (para saber cuánto
--    tiempo de preparación agregar a cada cita)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_occupied_slots(DATE);
CREATE OR REPLACE FUNCTION get_occupied_slots(p_date DATE)
RETURNS TABLE (slot TIMESTAMP, duration INTEGER, tipo TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT appointment_date,
         COALESCE(duration_minutes, 60),
         COALESCE(appointments.tipo, 'podologia')::TEXT
  FROM appointments
  WHERE appointment_date::date = p_date
    AND status <> 'cancelled';
$$;

REVOKE ALL ON FUNCTION get_occupied_slots(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_occupied_slots(DATE) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. book_appointment: bloques de 15 min y respeta la preparación
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION book_appointment(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_rut TEXT,
  p_datetime TIMESTAMP,
  p_notes TEXT DEFAULT NULL,
  p_duration INTEGER DEFAULT 60
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_appointment_id UUID;
  v_config RECORD;
  v_start TIME;
  v_end TIME;
  v_rut_norm TEXT;
  v_min_from_start INTEGER;
  v_now_cl TIMESTAMP;
  v_buf_pod INTEGER;
  v_buf_man INTEGER;
BEGIN
  v_now_cl := (now() AT TIME ZONE 'America/Santiago');

  SELECT COALESCE((SELECT value::int FROM app_settings WHERE key = 'buffer_podologia'), 15) INTO v_buf_pod;
  SELECT COALESCE((SELECT value::int FROM app_settings WHERE key = 'buffer_manicura'), 10) INTO v_buf_man;

  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'Nombre inválido');
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Email inválido');
  END IF;
  IF p_datetime IS NULL OR p_datetime < v_now_cl THEN
    RETURN json_build_object('success', false, 'error', 'La fecha debe ser futura');
  END IF;

  IF EXISTS (SELECT 1 FROM blockouts WHERE blocked_date = p_datetime::date) THEN
    RETURN json_build_object('success', false, 'error', 'Ese día no hay atención');
  END IF;

  SELECT * INTO v_config
  FROM availability
  WHERE day_of_week = EXTRACT(DOW FROM p_datetime)::int AND is_active = true
  LIMIT 1;

  IF v_config IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ese día no hay atención');
  END IF;

  v_start := p_datetime::time;
  v_end := (p_datetime + (p_duration * interval '1 minute'))::time;

  IF v_start < v_config.start_time OR v_end > v_config.end_time THEN
    RETURN json_build_object('success', false, 'error', 'Hora fuera del horario de atención');
  END IF;

  -- Bloques de 15 minutos
  v_min_from_start := EXTRACT(EPOCH FROM (v_start - v_config.start_time))::int / 60;
  IF v_min_from_start % 15 <> 0 THEN
    RETURN json_build_object('success', false, 'error', 'Hora inválida');
  END IF;

  IF v_config.lunch_start IS NOT NULL AND v_config.lunch_end IS NOT NULL THEN
    IF v_start < v_config.lunch_end AND v_end > v_config.lunch_start THEN
      RETURN json_build_object('success', false, 'error', 'Ese horario es el de almuerzo');
    END IF;
  END IF;

  -- Anti-solape considerando el tiempo de preparación de AMBAS citas
  -- (la nueva es de podología: reserva su duración + preparación)
  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.status <> 'cancelled'
      AND a.appointment_date::date = p_datetime::date
      AND a.appointment_date
          < (p_datetime + ((p_duration + v_buf_pod) * interval '1 minute'))
      AND p_datetime
          < (a.appointment_date + ((COALESCE(a.duration_minutes, 60) +
              CASE WHEN COALESCE(a.tipo, 'podologia') = 'manicura' THEN v_buf_man ELSE v_buf_pod END
            ) * interval '1 minute'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Ese horario choca con otra cita. Elige otro.');
  END IF;

  v_rut_norm := regexp_replace(upper(coalesce(p_rut, '')), '[^0-9K]', '', 'g');
  IF length(v_rut_norm) >= 7 THEN
    SELECT id INTO v_patient_id FROM patients
    WHERE regexp_replace(upper(coalesce(rut, '')), '[^0-9K]', '', 'g') = v_rut_norm
    LIMIT 1;
  END IF;
  IF v_patient_id IS NULL THEN
    SELECT id INTO v_patient_id FROM patients WHERE email = lower(trim(p_email));
  END IF;

  IF v_patient_id IS NULL THEN
    INSERT INTO patients (name, email, phone, rut)
    VALUES (trim(p_name), lower(trim(p_email)), trim(p_phone), trim(p_rut))
    RETURNING id INTO v_patient_id;
  ELSE
    UPDATE patients
    SET phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        rut = COALESCE(NULLIF(trim(p_rut), ''), rut)
    WHERE id = v_patient_id;
  END IF;

  INSERT INTO appointments (patient_id, appointment_date, notes, duration_minutes, tipo, origin)
  VALUES (v_patient_id, p_datetime, p_notes, p_duration, 'podologia', 'web')
  RETURNING id INTO v_appointment_id;

  RETURN json_build_object('success', true, 'appointment_id', v_appointment_id);

EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Ese horario choca con otra cita. Elige otro.');
END;
$$;
