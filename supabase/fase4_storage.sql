-- ============================================================
-- FASE 4: Almacenamiento de PDFs (recetas e indicaciones)
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- Crear bucket privado para los documentos PDF
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Solo usuarios autenticados (tu señora) pueden subir PDFs
CREATE POLICY "auth_upload_documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- Solo usuarios autenticados pueden leer/listar los PDFs
-- (los pacientes reciben un LINK FIRMADO temporal, no acceso directo)
CREATE POLICY "auth_read_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

-- Autenticados pueden reemplazar/actualizar PDFs
CREATE POLICY "auth_update_documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents');

-- Autenticados pueden eliminar PDFs
CREATE POLICY "auth_delete_documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
