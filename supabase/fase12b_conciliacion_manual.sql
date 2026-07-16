-- ============================================================
-- FASE 12b: Conciliación manual — el vínculo transferencia ↔
-- atención queda GUARDADO en cada atención
-- Ejecutar en Supabase SQL Editor (reemplaza al fase12 si no lo corriste)
-- ============================================================

ALTER TABLE attentions ADD COLUMN IF NOT EXISTS boleta_emitida BOOLEAN DEFAULT false;

-- Datos mínimos de la transferencia asociada (para el registro histórico)
ALTER TABLE attentions ADD COLUMN IF NOT EXISTS transfer_id VARCHAR(60);
ALTER TABLE attentions ADD COLUMN IF NOT EXISTS transfer_fecha DATE;
ALTER TABLE attentions ADD COLUMN IF NOT EXISTS transfer_nombre VARCHAR(150);
ALTER TABLE attentions ADD COLUMN IF NOT EXISTS transfer_monto INTEGER;
