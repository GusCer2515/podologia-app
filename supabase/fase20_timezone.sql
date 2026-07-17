-- ============================================================
-- FASE 20: Corregir zona horaria en book_appointment
-- El check "fecha futura" comparaba contra UTC (now()), lo que
-- rechazaba horas de la tarde en Chile. Ahora compara contra la
-- hora local de Chile (America/Santiago).
-- Ejecutar en Supabase SQL Editor
-- ============================================================

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
BEGIN
  -- Hora actual en Chile (naive), para comparar con p_datetime (hora local)
  v_now_cl := (now() AT TIME ZONE 'America/Santiago');

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

  v_min_from_start := EXTRACT(EPOCH FROM (v_start - v_config.start_time))::int / 60;
  IF v_min_from_start % 30 <> 0 THEN
    RETURN json_build_object('success', false, 'error', 'Hora inválida');
  END IF;

  IF v_config.lunch_start IS NOT NULL AND v_config.lunch_end IS NOT NULL THEN
    IF v_start < v_config.lunch_end AND v_end > v_config.lunch_start THEN
      RETURN json_build_object('success', false, 'error', 'Ese horario es el de almuerzo');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE status <> 'cancelled'
      AND appointment_date::date = p_datetime::date
      AND appointment_date < (p_datetime + (p_duration * interval '1 minute'))
      AND p_datetime < (appointment_date + (COALESCE(duration_minutes, 60) * interval '1 minute'))
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
