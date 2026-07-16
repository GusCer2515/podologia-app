-- ============================================================
-- FASE 7: Convenios con valores + configuración de precios
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- Tabla de convenios (con valor de atención por convenio)
CREATE TABLE IF NOT EXISTS convenios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  valor INTEGER DEFAULT 25000,           -- valor atención con este convenio
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE convenios ADD COLUMN IF NOT EXISTS valor INTEGER DEFAULT 25000;

ALTER TABLE convenios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_convenios" ON convenios;
CREATE POLICY "auth_full_convenios" ON convenios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Configuración general (clave-valor) — ej: precio particular
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_app_settings" ON app_settings;
CREATE POLICY "auth_full_app_settings" ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Valor por defecto: atención particular (sin convenio) $30.000
INSERT INTO app_settings (key, value)
VALUES ('precio_particular', '30000')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- Valor cobrado en cada atención (para flujo de caja futuro)
-- ------------------------------------------------------------
ALTER TABLE attentions ADD COLUMN IF NOT EXISTS valor INTEGER;
