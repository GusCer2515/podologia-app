-- ============================================================
-- FASE 7: Tabla de convenios (editable desde el panel admin)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS convenios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE convenios ENABLE ROW LEVEL SECURITY;

-- Solo el admin autenticado gestiona convenios
CREATE POLICY "auth_full_convenios" ON convenios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
