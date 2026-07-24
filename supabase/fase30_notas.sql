-- ============================================================
-- FASE 30: Notas / Agenda personal del admin
-- Reemplaza la agenda física: notas libres que la admin puede
-- escribir, fijar y colorear (pensado para usar con tablet).
-- Solo el panel (usuario autenticado) accede: nada es público.
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS notas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(200),
  contenido TEXT NOT NULL DEFAULT '',
  color VARCHAR(20) NOT NULL DEFAULT 'amarillo',
  fijada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Las fijadas primero, luego por última edición
CREATE INDEX IF NOT EXISTS idx_notas_orden ON notas (fijada DESC, updated_at DESC);

ALTER TABLE notas ENABLE ROW LEVEL SECURITY;

-- Privada: solo el panel administrativo. El público (anon) no accede.
DROP POLICY IF EXISTS "auth_full_notas" ON notas;
CREATE POLICY "auth_full_notas" ON notas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
