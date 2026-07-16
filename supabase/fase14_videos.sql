-- ============================================================
-- FASE 14: Videos en publicaciones del blog
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url TEXT;
