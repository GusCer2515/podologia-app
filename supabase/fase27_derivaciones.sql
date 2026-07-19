-- ============================================================
-- FASE 27: Derivaciones médicas (informe interclínico)
-- Permite derivar un paciente a otro profesional adjuntando su
-- ficha clínica, la última atención y el motivo de la derivación.
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dirigido_a VARCHAR(150) NOT NULL,          -- "Colega Podólogo", "Dr. Traumatólogo"...
  motivo TEXT NOT NULL,                       -- por qué se deriva
  sugerencia TEXT,                            -- sugerencia de continuidad
  proximo_control VARCHAR(60),                -- ej: "Sugerido en 1 mes"
  pdf_url TEXT,                               -- ruta del PDF en el almacenamiento
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_referrals" ON referrals;
CREATE POLICY "auth_full_referrals" ON referrals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
