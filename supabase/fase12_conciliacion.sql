-- ============================================================
-- FASE 12: Conciliación bancaria — marca de boleta emitida
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE attentions ADD COLUMN IF NOT EXISTS boleta_emitida BOOLEAN DEFAULT false;
