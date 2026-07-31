-- ============================================================
-- FASE 31: Bloquear BLOQUES DE HORARIO puntuales (no solo el día)
-- Antes: solo se podía bloquear el día completo. Ahora se puede
-- bloquear, por ejemplo, solo la mañana de un día y dejar la tarde
-- disponible. Aplica tanto en la agenda del panel como en la toma
-- de horas del sitio (podología).
--
--   start_time / end_time NULL  → día completo bloqueado (como antes)
--   start_time / end_time con hora → solo ese tramo queda bloqueado
--
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- 1. Columnas de horario (nulas = día completo)
ALTER TABLE blockouts ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE blockouts ADD COLUMN IF NOT EXISTS end_time TIME;

-- 2. Permitir VARIAS filas por fecha (un día puede tener varios tramos)
ALTER TABLE blockouts DROP CONSTRAINT IF EXISTS blockouts_blocked_date_key;
DROP INDEX IF EXISTS blockouts_blocked_date_key;
DROP INDEX IF EXISTS uniq_blockouts_date;

-- ------------------------------------------------------------
-- 3. book_appointment: respeta el día completo Y los tramos
--    (misma lógica de fase 23, con el bloqueo por tramos añadido)
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
  v_bloque RECORD;
  v_start TIME;
  v_end TIME;
  v_rut_norm TEXT;
  v_min_from_start INTEGER;
  v_now_cl TIMESTAMP;
  v_buf_pod INTEGER;
  v_buf_man INTEGER;
  v_dow INTEGER;
BEGIN
  v_now_cl := (now() AT TIME ZONE 'America/Santiago');
  v_dow := EXTRACT(DOW FROM p_datetime)::int;

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

  -- Día COMPLETO bloqueado (feriado / vacaciones)
  IF EXISTS (
    SELECT 1 FROM blockouts
    WHERE blocked_date = p_datetime::date AND start_time IS NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Ese día no hay atención');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM availability WHERE day_of_week = v_dow AND is_active = true
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Ese día no hay atención');
  END IF;

  v_start := p_datetime::time;
  v_end := (p_datetime + (p_duration * interval '1 minute'))::time;

  -- TRAMO de horario bloqueado ese día (bloqueo parcial)
  IF EXISTS (
    SELECT 1 FROM blockouts
    WHERE blocked_date = p_datetime::date
      AND start_time IS NOT NULL
      AND v_start < end_time
      AND start_time < v_end
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Ese horario no está disponible ese día');
  END IF;

  -- La atención completa debe caber dentro de un bloque
  SELECT * INTO v_bloque
  FROM availability
  WHERE day_of_week = v_dow
    AND is_active = true
    AND v_start >= start_time
    AND v_end <= end_time
  ORDER BY start_time
  LIMIT 1;

  IF v_bloque IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ese horario no está disponible para atención');
  END IF;

  -- Bloques de 15 minutos contados desde el inicio de ESE bloque
  v_min_from_start := EXTRACT(EPOCH FROM (v_start - v_bloque.start_time))::int / 60;
  IF v_min_from_start % 15 <> 0 THEN
    RETURN json_build_object('success', false, 'error', 'Hora inválida');
  END IF;

  -- Anti-solape considerando el tiempo de preparación de ambas citas
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
