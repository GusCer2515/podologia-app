-- ============================================================
-- FASE 21: Testimonios de pacientes (con moderación)
-- Los pacientes envían su experiencia desde el sitio; la admin
-- aprueba antes de que se muestre públicamente.
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  rating INTEGER DEFAULT 5,
  comentario TEXT NOT NULL,
  aprobado BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- El público SOLO puede leer los testimonios aprobados
DROP POLICY IF EXISTS "public_read_testimonials" ON testimonials;
CREATE POLICY "public_read_testimonials" ON testimonials
  FOR SELECT TO anon USING (aprobado = true);

-- La admin gestiona todo
DROP POLICY IF EXISTS "auth_full_testimonials" ON testimonials;
CREATE POLICY "auth_full_testimonials" ON testimonials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Envío desde el sitio público (validado, queda PENDIENTE)
-- No se usa INSERT directo para evitar abusos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_testimonial(
  p_nombre TEXT,
  p_rating INTEGER,
  p_comentario TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pendientes INTEGER;
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 2 THEN
    RETURN json_build_object('success', false, 'error', 'Escribe tu nombre');
  END IF;
  IF p_comentario IS NULL OR length(trim(p_comentario)) < 10 THEN
    RETURN json_build_object('success', false, 'error', 'Cuéntanos un poco más de tu experiencia (mínimo 10 caracteres)');
  END IF;
  IF length(trim(p_comentario)) > 600 THEN
    RETURN json_build_object('success', false, 'error', 'El comentario es muy largo (máximo 600 caracteres)');
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN json_build_object('success', false, 'error', 'Selecciona una calificación de 1 a 5');
  END IF;

  -- Freno anti-spam: máximo 20 pendientes acumulados
  SELECT count(*) INTO v_pendientes FROM testimonials WHERE aprobado = false;
  IF v_pendientes >= 20 THEN
    RETURN json_build_object('success', false, 'error', 'Estamos recibiendo muchos comentarios. Intenta más tarde.');
  END IF;

  INSERT INTO testimonials (nombre, rating, comentario)
  VALUES (trim(p_nombre), p_rating, trim(p_comentario));

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION submit_testimonial(TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_testimonial(TEXT, INTEGER, TEXT) TO anon, authenticated;
