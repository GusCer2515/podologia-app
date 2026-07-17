-- ============================================================
-- FASE 18: Agenda por duración + almuerzo + solapamientos
--          + reconocer paciente por RUT (público) + origen web
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- 1. Horario de almuerzo por día (bloque no agendable)
ALTER TABLE availability ADD COLUMN IF NOT EXISTS lunch_start TIME;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS lunch_end TIME;

-- 2. Cada cita tiene duración y origen (web = agendada por paciente)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS origin VARCHAR(10) DEFAULT 'admin';

-- Citas antiguas sin duración => 60 min (podología)
UPDATE appointments SET duration_minutes = 60 WHERE duration_minutes IS NULL;

-- ------------------------------------------------------------
-- 3. get_occupied_slots: ahora devuelve también la duración
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_occupied_slots(DATE);
CREATE OR REPLACE FUNCTION get_occupied_slots(p_date DATE)
RETURNS TABLE (slot TIMESTAMP, duration INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT appointment_date, COALESCE(duration_minutes, 60)
  FROM appointments
  WHERE appointment_date::date = p_date
    AND status <> 'cancelled';
$$;

REVOKE ALL ON FUNCTION get_occupied_slots(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_occupied_slots(DATE) TO anon, authenticated;

-- ------------------------------------------------------------
-- 4. book_appointment con duración, almuerzo y anti-solapamiento
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
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'Nombre inválido');
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Email inválido');
  END IF;
  IF p_datetime IS NULL OR p_datetime < now() THEN
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

  -- Dentro del horario de atención
  IF v_start < v_config.start_time OR v_end > v_config.end_time THEN
    RETURN json_build_object('success', false, 'error', 'Hora fuera del horario de atención');
  END IF;

  -- Alineado a bloques de 30 min desde el inicio
  v_min_from_start := EXTRACT(EPOCH FROM (v_start - v_config.start_time))::int / 60;
  IF v_min_from_start % 30 <> 0 THEN
    RETURN json_build_object('success', false, 'error', 'Hora inválida');
  END IF;

  -- No pisar el almuerzo
  IF v_config.lunch_start IS NOT NULL AND v_config.lunch_end IS NOT NULL THEN
    IF v_start < v_config.lunch_end AND v_end > v_config.lunch_start THEN
      RETURN json_build_object('success', false, 'error', 'Ese horario es el de almuerzo');
    END IF;
  END IF;

  -- No solaparse con otra cita del mismo día
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE status <> 'cancelled'
      AND appointment_date::date = p_datetime::date
      AND appointment_date < (p_datetime + (p_duration * interval '1 minute'))
      AND p_datetime < (appointment_date + (COALESCE(duration_minutes, 60) * interval '1 minute'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Ese horario choca con otra cita. Elige otro.');
  END IF;

  -- Reconocer paciente por RUT (ficha con historial) y luego por email
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

-- ------------------------------------------------------------
-- 5. Reconocer paciente por RUT desde el sitio público
--    Devuelve SOLO el nombre (para saludar), sin exponer más datos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_patient_by_rut(p_rut TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_name TEXT;
  v_rut_norm TEXT;
BEGIN
  v_rut_norm := regexp_replace(upper(coalesce(p_rut, '')), '[^0-9K]', '', 'g');
  IF length(v_rut_norm) < 7 THEN
    RETURN json_build_object('found', false);
  END IF;
  SELECT name INTO v_name FROM patients
  WHERE regexp_replace(upper(coalesce(rut, '')), '[^0-9K]', '', 'g') = v_rut_norm
  LIMIT 1;
  IF v_name IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;
  RETURN json_build_object('found', true, 'name', v_name);
END;
$$;

REVOKE ALL ON FUNCTION find_patient_by_rut(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_patient_by_rut(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- 6. Contacto de una cita (para que el servidor envíe el correo
--    aunque el paciente recurrente no haya tecleado su email)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_appointment_contact(p_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE r RECORD;
BEGIN
  SELECT pt.name, pt.email, pt.phone INTO r
  FROM appointments a JOIN patients pt ON pt.id = a.patient_id
  WHERE a.id = p_id;
  IF r IS NULL THEN RETURN json_build_object('found', false); END IF;
  RETURN json_build_object('found', true, 'name', r.name, 'email', r.email, 'phone', r.phone);
END;
$$;

REVOKE ALL ON FUNCTION get_appointment_contact(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_appointment_contact(UUID) TO anon, authenticated;
