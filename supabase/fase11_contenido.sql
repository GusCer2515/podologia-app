-- ============================================================
-- FASE 11: Contenido dinámico — carrusel de casos + noticias
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bucket PÚBLICO para imágenes del sitio (carrusel, noticias)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-images', 'public-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_public_images" ON storage.objects;
CREATE POLICY "public_read_public_images" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'public-images');

DROP POLICY IF EXISTS "auth_insert_public_images" ON storage.objects;
CREATE POLICY "auth_insert_public_images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'public-images');

DROP POLICY IF EXISTS "auth_update_public_images" ON storage.objects;
CREATE POLICY "auth_update_public_images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'public-images');

DROP POLICY IF EXISTS "auth_delete_public_images" ON storage.objects;
CREATE POLICY "auth_delete_public_images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'public-images');

-- ------------------------------------------------------------
-- 2. Casos del carrusel
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carousel_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(150) NOT NULL,
  descripcion TEXT,
  image_url TEXT NOT NULL,
  orden INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE carousel_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_carousel" ON carousel_cases;
CREATE POLICY "public_read_carousel" ON carousel_cases
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "auth_full_carousel" ON carousel_cases;
CREATE POLICY "auth_full_carousel" ON carousel_cases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Migrar los 7 casos actuales (solo si la tabla está vacía)
INSERT INTO carousel_cases (titulo, descripcion, image_url, orden)
SELECT * FROM (VALUES
  ('Onicomicosis', 'Tratamiento antimicótico y resecado de hiperqueratosis', '/images/casos/Caso1.jpeg', 1),
  ('Tratamiento antimicótico', 'Aplicación localizada en uña afectada por hongos', '/images/casos/Caso2.jpeg', 2),
  ('Heloma plantar', 'Resecado de queratoma en la planta del pie', '/images/casos/Caso3.jpeg', 3),
  ('Hiperqueratosis plantar', 'Evaluación y tratamiento integral de la planta del pie', '/images/casos/Caso4.jpeg', 4),
  ('Rehabilitación ungueal', 'Recuperación de uñas dañadas con seguimiento clínico', '/images/casos/Caso5.jpeg', 5),
  ('Grietas del talón', 'Tratamiento de hiperqueratosis y grietas del talón', '/images/casos/Caso6.jpeg', 6),
  ('Uña encarnada', 'Tratamiento de onicocriptosis y alivio del dolor', '/images/casos/Caso7.jpeg', 7)
) AS v(titulo, descripcion, image_url, orden)
WHERE NOT EXISTS (SELECT 1 FROM carousel_cases);

-- ------------------------------------------------------------
-- 3. Noticias / consejos (blog)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  contenido TEXT NOT NULL,
  image_url TEXT,
  publicado BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_posts" ON posts;
CREATE POLICY "public_read_posts" ON posts
  FOR SELECT TO anon USING (publicado = true);

DROP POLICY IF EXISTS "auth_full_posts" ON posts;
CREATE POLICY "auth_full_posts" ON posts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
