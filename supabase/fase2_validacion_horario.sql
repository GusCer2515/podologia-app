-- ============================================================
-- FASE 2b: Validar horario de atención DENTRO de la BD
-- (nadie puede agendar fuera de horario, ni siquiera con F12)
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION book_appointment(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_rut TEXT,
  p_datetime TIMESTAMP,
  p_notes TEXT DEFAULT NULL
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
  v_minutes_from_start INTEGER;
BEGIN
  -- Validaciones básicas
  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'Nombre inválido');
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Email inválido');
  END IF;
  IF p_datetime IS NULL OR p_datetime < now() THEN
    RETURN json_build_object('success', false, 'error', 'La fecha debe ser futura');
  END IF;

  -- ¿Día bloqueado (feriado/vacaciones)?
  IF EXISTS (SELECT 1 FROM blockouts WHERE blocked_date = p_datetime::date) THEN
    RETURN json_build_object('success', false, 'error', 'Ese día no hay atención');
  END IF;

  -- ¿Hay horario de atención configurado para ese día de la semana?
  SELECT * INTO v_config
  FROM availability
  WHERE day_of_week = EXTRACT(DOW FROM p_datetime)::int
    AND is_active = true
  LIMIT 1;

  IF v_config IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ese día no hay atención');
  END IF;

  -- ¿La hora está dentro del horario de atención?
  IF p_datetime::time < v_config.start_time
     OR (p_datetime::time + (v_config.slot_duration_minutes * interval '1 minute')) > v_config.end_time THEN
    RETURN json_build_object('success', false, 'error', 'Hora fuera del horario de atención');
  END IF;

  -- ¿La hora calza con los cupos? (ej: 10:00 y 10:30 sí; 10:17 no)
  v_minutes_from_start := EXTRACT(EPOCH FROM (p_datetime::time - v_config.start_time))::int / 60;
  IF v_minutes_from_start % v_config.slot_duration_minutes <> 0 THEN
    RETURN json_build_object('success', false, 'error', 'Hora inválida');
  END IF;

  -- ¿Hora ya tomada?
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE appointment_date = p_datetime AND status <> 'cancelled'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Esa hora ya fue tomada. Elige otra.');
  END IF;

  -- Buscar o crear paciente por email
  SELECT id INTO v_patient_id FROM patients WHERE email = lower(trim(p_email));

  IF v_patient_id IS NULL THEN
    INSERT INTO patients (name, email, phone, rut)
    VALUES (trim(p_name), lower(trim(p_email)), trim(p_phone), trim(p_rut))
    RETURNING id INTO v_patient_id;
  ELSE
    UPDATE patients
    SET name = trim(p_name), phone = trim(p_phone),
        rut = COALESCE(NULLIF(trim(p_rut), ''), rut)
    WHERE id = v_patient_id;
  END IF;

  -- Crear cita (el índice único protege contra clicks simultáneos)
  INSERT INTO appointments (patient_id, appointment_date, notes)
  VALUES (v_patient_id, p_datetime, p_notes)
  RETURNING id INTO v_appointment_id;

  RETURN json_build_object('success', true, 'appointment_id', v_appointment_id);

EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Esa hora ya fue tomada. Elige otra.');
END;
$$;

-- ------------------------------------------------------------
-- LIMPIEZA: borrar la cita de prueba del sábado (día sin atención)
-- ------------------------------------------------------------
DELETE FROM appointments
WHERE EXTRACT(DOW FROM appointment_date) IN (0, 6);  -- domingos y sábados
