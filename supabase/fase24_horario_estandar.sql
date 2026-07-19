-- ============================================================
-- FASE 24: Horario estándar de atención
--   Mañana: 08:30 – 13:00   (última hora de podología a las 12:00)
--   Almuerzo: 13:00 – 15:30 (sin atención, es el hueco entre bloques)
--   Tarde:  15:30 – 21:00   (última hora a las 20:00)
--
-- Se aplica a TODOS los días que hoy están habilitados.
-- Solo toca la tabla `availability` (la configuración de horarios).
-- NO modifica pacientes, citas, fichas ni ningún otro dato.
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  v_dias INTEGER[];
BEGIN
  -- Días habilitados hoy (si no hay ninguno, se usa lunes a sábado)
  SELECT COALESCE(array_agg(DISTINCT day_of_week), ARRAY[1, 2, 3, 4, 5, 6])
  INTO v_dias
  FROM availability
  WHERE is_active = true;

  -- Reemplazar la configuración de horario de esos días
  DELETE FROM availability WHERE day_of_week = ANY(v_dias);

  INSERT INTO availability (day_of_week, start_time, end_time, is_active)
  SELECT d, '08:30'::time, '13:00'::time, true FROM unnest(v_dias) AS d
  UNION ALL
  SELECT d, '15:30'::time, '21:00'::time, true FROM unnest(v_dias) AS d;
END $$;

-- Revisar cómo quedó (0=Domingo, 1=Lunes ... 6=Sábado)
SELECT day_of_week, start_time, end_time
FROM availability
WHERE is_active = true
ORDER BY day_of_week, start_time;
