-- ============================================================
-- FASE 24: Horario estándar de atención
--   Mañana: 08:30 – 13:00   (última hora de podología a las 12:00)
--   Almuerzo: 13:00 – 15:30 (sin atención, es el hueco entre bloques)
--   Tarde:  15:30 – 21:00   (última hora a las 20:00)
-- Se aplica a TODOS los días que hoy están habilitados.
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- 1. Guardar qué días están habilitados actualmente
CREATE TEMP TABLE dias_activos AS
SELECT DISTINCT day_of_week FROM availability WHERE is_active = true;

-- Si no hubiera ninguno configurado, se habilita de lunes a sábado
INSERT INTO dias_activos (day_of_week)
SELECT generate_series(1, 6)
WHERE NOT EXISTS (SELECT 1 FROM dias_activos);

-- 2. Reemplazar la configuración de esos días por los dos bloques
DELETE FROM availability
WHERE day_of_week IN (SELECT day_of_week FROM dias_activos);

INSERT INTO availability (day_of_week, start_time, end_time, is_active)
SELECT d.day_of_week, b.inicio, b.fin, true
FROM dias_activos d
CROSS JOIN (
  VALUES ('08:30'::time, '13:00'::time),
         ('15:30'::time, '21:00'::time)
) AS b(inicio, fin);

DROP TABLE dias_activos;

-- 3. Revisar cómo quedó
SELECT day_of_week, start_time, end_time
FROM availability
WHERE is_active = true
ORDER BY day_of_week, start_time;
