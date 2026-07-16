-- ============================================================
-- FASE 1: Fichas clínicas, historial, documentos + SEGURIDAD
-- Ejecutar completo en Supabase SQL Editor (una sola vez)
-- ============================================================

-- ------------------------------------------------------------
-- 1. EXTENDER TABLA PATIENTS con campos de la ficha
-- ------------------------------------------------------------
ALTER TABLE patients ADD COLUMN IF NOT EXISTS fecha_ingreso DATE DEFAULT CURRENT_DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cesfam VARCHAR(100);

-- ------------------------------------------------------------
-- 2. FICHA CLÍNICA (1 por paciente)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinical_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,

  -- Antecedentes patológicos
  hta VARCHAR(10),                        -- SI / NO
  hta_anos_evolucion VARCHAR(20),
  hta_tratamiento TEXT,
  diabetes VARCHAR(10),                   -- SI / NO
  diabetes_anos_evolucion VARCHAR(20),
  diabetes_tipo VARCHAR(30),
  diabetes_tratamiento TEXT,
  otras_patologias TEXT,

  -- Evaluación física
  limitacion_movilidad VARCHAR(20),
  pulso_pedio VARCHAR(20),
  valor_min VARCHAR(20),
  sensibilidad VARCHAR(20),

  -- Hiperqueratosis y/o queratomas (AGUDO/LEVE/REGULAR/...)
  hiperqueratosis_plantar VARCHAR(20),
  heloma_dorsal VARCHAR(20),
  heloma_miliar VARCHAR(20),
  heloma_interdigital VARCHAR(20),
  otros_helomas TEXT,

  -- Alteraciones ortopédicas
  hallux_valgus VARCHAR(20),
  pie_charcot VARCHAR(20),
  dedo_en_garra VARCHAR(20),
  neuropatico VARCHAR(20),
  pie_plano VARCHAR(20),
  angiopatico VARCHAR(20),
  pie_cavo VARCHAR(20),
  pie_diabetico VARCHAR(20),
  otras_alteraciones TEXT,

  -- Estado del pie
  anhidrosis VARCHAR(20),
  hiperhidrosis VARCHAR(20),
  bromhidrosis VARCHAR(20),
  heridas VARCHAR(20),
  ulceras VARCHAR(20),
  dermomicosis VARCHAR(20),
  resequedad VARCHAR(20),
  otros_pie TEXT,

  -- Estado de las uñas
  unas_sanas VARCHAR(20),
  onicomicosis VARCHAR(20),
  incarnadas VARCHAR(20),
  involutas VARCHAR(20),
  otros_unas TEXT,

  -- Autocuidado
  calzado_inadecuado VARCHAR(20),
  higiene_autocuidado VARCHAR(20),
  deporte VARCHAR(20),

  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 3. HISTORIAL DE ATENCIONES (N por paciente)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Procedimientos realizados
  limpieza_general VARCHAR(20),
  limpieza_laterales VARCHAR(20),
  onicotomia VARCHAR(20),
  desbastado_unas VARCHAR(20),
  resecado_hiperqueratosis VARCHAR(20),
  resecado_helomas VARCHAR(20),
  masaje VARCHAR(20),
  otros_procedimientos TEXT,

  -- Recomendaciones
  higiene VARCHAR(20),
  corte_unas VARCHAR(20),
  aceite_arbol_te VARCHAR(20),
  vitaminas VARCHAR(20),
  otros_antifungicos VARCHAR(20),
  vendaje VARCHAR(20),
  crema_hidratante VARCHAR(20),
  consulta_medica VARCHAR(20),

  medicamentos TEXT,
  observaciones TEXT,
  proxima_consulta TEXT,
  tiempo_consulta VARCHAR(20),
  proxima_atencion DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 4. DOCUMENTOS: recetas e indicaciones (PDFs)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  attention_id UUID REFERENCES attentions(id) ON DELETE SET NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receta', 'indicacion')),
  diagnostico TEXT,
  contenido TEXT,                          -- RP/ o indicaciones del tratamiento
  proximo_control DATE,
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 5. SEGURIDAD: eliminar políticas inseguras
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert patients" ON patients;
DROP POLICY IF EXISTS "Anyone can read patients" ON patients;
DROP POLICY IF EXISTS "Only admin can update patients" ON patients;
DROP POLICY IF EXISTS "Anyone can view appointments" ON appointments;
DROP POLICY IF EXISTS "Anyone can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Anyone can view invoices" ON invoices;
DROP POLICY IF EXISTS "Anyone can view availability" ON availability;
DROP POLICY IF EXISTS "Anyone can view blockouts" ON blockouts;

-- ------------------------------------------------------------
-- 6. SEGURIDAD: RLS estricto
--    - Solo usuarios AUTENTICADOS (tu señora) acceden a datos
--    - El público NO puede leer nada sensible
-- ------------------------------------------------------------
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_patients" ON patients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_appointments" ON appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_clinical_records" ON clinical_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_attentions" ON attentions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_documents" ON documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_invoices" ON invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_availability" ON availability
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_full_blockouts" ON blockouts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Horarios de atención y feriados: el público puede VERLOS
-- (necesario para mostrar disponibilidad, no es dato sensible)
CREATE POLICY "public_read_availability" ON availability
  FOR SELECT TO anon USING (true);

CREATE POLICY "public_read_blockouts" ON blockouts
  FOR SELECT TO anon USING (true);

-- ------------------------------------------------------------
-- 7. ANTI-DUPLICADOS: índice único de horas activas
--    Dos personas NO pueden tomar la misma hora, ni con clicks
--    simultáneos (la BD lo rechaza a nivel físico)
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_appointment
  ON appointments (appointment_date)
  WHERE status <> 'cancelled';

-- ------------------------------------------------------------
-- 8. RPC: agendar cita (única vía de escritura para el público)
--    SECURITY DEFINER = corre con permisos elevados pero
--    controlados: valida TODO antes de insertar
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION book_appointment(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_rut TEXT,
  p_datetime TIMESTAMP,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID;
  v_appointment_id UUID;
BEGIN
  -- Validaciones básicas
  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'Nombre inválido');
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Email inválido');
  END IF;
  IF p_datetime IS NULL OR p_datetime < now() THEN
    RETURN json_build_object('success', false, 'error', 'La fecha debe ser futura');
  END IF;

  -- ¿Día bloqueado (feriado/vacaciones)?
  IF EXISTS (SELECT 1 FROM blockouts WHERE blocked_date = p_datetime::date) THEN
    RETURN json_build_object('success', false, 'error', 'Ese día no hay atención');
  END IF;

  -- ¿Hora ya tomada?
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE appointment_date = p_datetime AND status <> 'cancelled'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Esa hora ya fue tomada. Elige otra.');
  END IF;

  -- Buscar o crear paciente por email
  SELECT id INTO v_patient_id FROM patients WHERE email = lower(trim(p_email));

  IF v_patient_id IS NULL THEN
    INSERT INTO patients (name, email, phone, rut)
    VALUES (trim(p_name), lower(trim(p_email)), trim(p_phone), trim(p_rut))
    RETURNING id INTO v_patient_id;
  ELSE
    UPDATE patients
    SET name = trim(p_name), phone = trim(p_phone),
        rut = COALESCE(NULLIF(trim(p_rut), ''), rut)
    WHERE id = v_patient_id;
  END IF;

  -- Crear cita (el índice único protege contra clicks simultáneos)
  INSERT INTO appointments (patient_id, appointment_date, notes)
  VALUES (v_patient_id, p_datetime, p_notes)
  RETURNING id INTO v_appointment_id;

  RETURN json_build_object('success', true, 'appointment_id', v_appointment_id);

EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Esa hora ya fue tomada. Elige otra.');
END;
$$;

REVOKE ALL ON FUNCTION book_appointment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION book_appointment TO anon, authenticated;

-- ------------------------------------------------------------
-- 9. RPC: horas ocupadas de un día (SIN datos de pacientes)
--    Es lo ÚNICO que el público puede consultar sobre citas
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_occupied_slots(p_date DATE)
RETURNS TABLE (slot TIMESTAMP)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT appointment_date
  FROM appointments
  WHERE appointment_date::date = p_date
    AND status <> 'cancelled';
$$;

REVOKE ALL ON FUNCTION get_occupied_slots(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_occupied_slots(DATE) TO anon, authenticated;

-- ------------------------------------------------------------
-- 10. Horario de atención inicial (Lun-Vie 9:00-18:00, editable
--     después desde el panel admin)
-- ------------------------------------------------------------
INSERT INTO availability (day_of_week, start_time, end_time, slot_duration_minutes, is_active)
SELECT d, '09:00'::time, '18:00'::time, 30, true
FROM generate_series(1, 5) AS d
WHERE NOT EXISTS (SELECT 1 FROM availability WHERE day_of_week = d);
