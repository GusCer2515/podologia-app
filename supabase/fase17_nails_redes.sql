-- ============================================================
-- FASE 17: Módulo Nails (manicura) + Calendario de contenido RRSS
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. Servicios de manicura (editables por la admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nail_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  valor INTEGER DEFAULT 0,
  duracion_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE nail_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_nail_services" ON nail_services;
CREATE POLICY "auth_full_nail_services" ON nail_services
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Servicios iniciales (solo si la tabla está vacía — edítalos después)
INSERT INTO nail_services (nombre, valor, duracion_minutes)
SELECT * FROM (VALUES
  ('Manicura tradicional', 12000, 60),
  ('Esmaltado permanente', 15000, 60),
  ('Uñas de gel', 25000, 90),
  ('Extensión de uñas', 30000, 120),
  ('Realce', 20000, 90),
  ('Retiro de esmaltado/gel', 8000, 30)
) AS v(nombre, valor, duracion_minutes)
WHERE NOT EXISTS (SELECT 1 FROM nail_services);

-- ------------------------------------------------------------
-- 2. Las citas ahora tienen rama: podología (por defecto) o manicura
--    El agendamiento público NO cambia: siempre crea podología
-- ------------------------------------------------------------
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'podologia';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS nail_service_id UUID REFERENCES nail_services(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS valor INTEGER;

-- ------------------------------------------------------------
-- 3. Calendario de contenido para Instagram (ambas ramas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_plan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  rama VARCHAR(20) DEFAULT 'podologia',      -- podologia | manicura
  titulo VARCHAR(200) NOT NULL,
  copy_text TEXT,                             -- texto listo para copiar/pegar
  imagen_sugerida TEXT,                       -- qué foto/video subir
  hashtags TEXT,
  estado VARCHAR(20) DEFAULT 'pendiente',     -- pendiente | publicado
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE content_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_full_content_plan" ON content_plan;
CREATE POLICY "auth_full_content_plan" ON content_plan
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 4. Plan de contenido inicial (~7 semanas, solo si está vacío)
-- ------------------------------------------------------------
INSERT INTO content_plan (fecha, rama, titulo, copy_text, imagen_sugerida, hashtags)
SELECT * FROM (VALUES
  ('2026-07-21'::date, 'podologia', '5 señales de que tus pies necesitan un podólogo',
   '¿Dolor al caminar? ¿Uñas engrosadas o cambio de color? ¿Durezas que vuelven una y otra vez? 👣 Tus pies te hablan, escúchalos. En Vida de Colores evaluamos y tratamos con equipamiento profesional. Agenda tu hora online en el link del perfil 🌸',
   'Foto de pies cuidados sobre toalla clara + herramientas de trabajo al costado',
   '#Podologia #PodologiaCalama #CuidadoDeLosPies #SaludPodal #VidaDeColores'),
  ('2026-07-23', 'manicura', 'Antes y después: esmaltado permanente',
   'De uñas apagadas a manos que enamoran ✨ El esmaltado permanente dura hasta 3 semanas intacto. Cupos disponibles esta semana, escríbenos al DM 💅',
   'Collage antes/después de manos reales (con consentimiento de la clienta)',
   '#EsmaltadoPermanente #NailsCalama #ManicuraChile #UñasPerfectas #VidaDeColores'),
  ('2026-07-25', 'podologia', 'MITO: cortar la uña en V cura la uña encarnada ❌',
   'FALSO. Cortar en V no corrige la curvatura y puede empeorar el problema. La onicocriptosis se trata de forma profesional, sin dolor y con resultados reales. Si sufres de uñas encarnadas, agenda tu evaluación 🌸 Link en el perfil.',
   'Gráfica simple: mito ❌ vs verdad ✅ (fondo crema, letras azules de la marca)',
   '#UñaEncarnada #Onicocriptosis #MitosYVerdades #PodologiaClinica #Calama'),
  ('2026-07-28', 'manicura', '3 tips para que tu esmaltado dure más de 3 semanas',
   '1️⃣ Usa guantes al hacer aseo 🧤 2️⃣ Hidrata cutículas con aceite cada noche 3️⃣ No uses tus uñas como herramientas 😅 ¿Lista para renovarte? Agenda por DM 💅✨',
   'Reel corto mostrando los 3 tips con texto sobre pantalla',
   '#TipsDeUñas #EsmaltadoDuradero #NailsTips #ManicuraCalama'),
  ('2026-07-30', 'podologia', 'Pie diabético: el control preventivo salva',
   'Si vives con diabetes, tus pies necesitan control podológico periódico: una pequeña lesión que pasa desapercibida puede complicarse. Atención especializada y preventiva en Vida de Colores 💙 Agenda online, link en el perfil.',
   'Foto profesional de atención en el box (manos con guantes revisando un pie)',
   '#PieDiabetico #Diabetes #PrevencionSalud #PodologiaClinica #Calama'),
  ('2026-08-01', 'manicura', 'Tendencias de agosto: tonos lavanda y cromados 💜',
   'Este mes se llevan los tonos lavanda, los efectos cromados y el estilo glazed ✨ ¿Cuál va contigo? Comenta tu favorito 👇 y agenda tu manicura por DM.',
   'Paleta de colores de tendencia + foto de sets de uñas en esos tonos',
   '#TendenciasUñas #NailTrends #LavenderNails #ChromeNails #NailsChile'),
  ('2026-08-04', 'podologia', '¿Qué pasa en tu primera consulta? Paso a paso',
   'Muchos llegan con nervios y se van felices 🥰 1) Conversamos y revisamos tu historial 2) Evaluamos tus pies 3) Tratamiento sin dolor 4) Te vas con indicaciones claras a tu WhatsApp. Así de simple. Agenda online 🌸',
   'Reel del box de atención: recorrido corto mostrando el espacio limpio y acogedor',
   '#PrimeraConsulta #Podologia #ExperienciaPaciente #Calama #VidaDeColores'),
  ('2026-08-06', 'manicura', 'Gel vs esmaltado permanente: ¿cuál te conviene?',
   '💅 Esmaltado permanente: natural, dura ~3 semanas, ideal para el día a día. 💎 Uñas de gel: más resistencia, largo extra y estructura perfecta. ¿Dudas? Te asesoramos por DM sin compromiso ✨',
   'Carrusel de 2 fotos: mano con esmaltado / mano con gel, texto comparativo',
   '#UñasDeGel #EsmaltadoPermanente #NailsCalama #Manicura'),
  ('2026-08-08', 'podologia', 'Talones agrietados en invierno: rutina de 3 pasos',
   'El frío seca la piel y los talones lo sufren 🥶 1) Hidratación diaria con urea 2) No lijar en exceso en casa 3) Tratamiento podológico si hay grietas profundas. Recupera tus talones antes del verano, agenda tu hora 🌸',
   'Foto macro de crema aplicándose en el talón (luz cálida)',
   '#TalonesAgrietados #Hiperqueratosis #CuidadoInvierno #Podologia'),
  ('2026-08-11', 'manicura', 'Proceso completo: extensión de uñas 🎬',
   'De uñas cortitas a un largo de impacto en 2 horas 😍 Mira el proceso completo. Extensiones con estructura reforzada para que duren. Agenda tu transformación por DM 💅',
   'Reel time-lapse del proceso de extensión (inicio a resultado final)',
   '#ExtensionDeUñas #NailExtension #TransformacionUñas #NailsChile'),
  ('2026-08-13', 'podologia', 'Lo que dicen nuestros pacientes 🌸',
   '"Llegué caminando con dolor y salí como nueva" 💬 Gracias por confiar en nosotros. Tu bienestar es nuestra razón. Agenda tu hora online, link en el perfil.',
   'Diseño con la reseña destacada sobre fondo crema con flores de la marca',
   '#Testimonio #PacientesFelices #Podologia #Calama #VidaDeColores'),
  ('2026-08-15', 'manicura', 'Promo de agosto: manicura + esmaltado permanente 💜',
   'Solo este mes: manicura tradicional + esmaltado permanente a precio especial ✨ Cupos limitados por semana. Reserva la tuya por DM antes que se agoten 💅',
   'Flyer simple con la promo (fondo lavanda, tipografía de la marca)',
   '#PromoUñas #ManicuraCalama #Promocion #NailsChile'),
  ('2026-08-18', 'podologia', 'Onicomicosis: señales tempranas en tus uñas',
   'Uñas amarillentas, engrosadas o quebradizas pueden ser hongos 🔬 Mientras antes se trata, más rápida la recuperación. Evaluación profesional y plan de tratamiento en tu primera visita. Agenda online 🌸',
   'Foto educativa discreta de uña afectada (del carrusel de casos, con consentimiento)',
   '#Onicomicosis #HongosEnLasUñas #SaludPodal #PodologiaClinica'),
  ('2026-08-20', 'manicura', 'Detrás de cámaras: higiene y esterilización 💎',
   'Cada set de herramientas se esteriliza después de cada clienta 🧼✨ Tu seguridad es primero, siempre. Belleza con estándares clínicos, esa es la diferencia de Vida de Colores.',
   'Video corto del proceso de esterilizado del material',
   '#HigieneNails #Esterilizacion #ManicuraSegura #NailsCalama'),
  ('2026-08-22', 'podologia', '¿Tu calzado está dañando tus pies?',
   'Zapatos muy ajustados, tacos a diario o plantillas gastadas deforman y lesionan 👠⚠️ 3 claves al comprar: horma ancha, talla correcta al final del día y material flexible. Tus pies te lo agradecerán 🌸',
   'Foto de distintos tipos de calzado con ✅ y ❌',
   '#CalzadoSaludable #SaludPodal #TipsPodologia #Calama'),
  ('2026-08-25', 'manicura', 'Nail art de la semana ✨',
   'Diseño delicado con detalles florales, inspirado en nuestra marca 🌸 ¿Te lo harías? Guarda este post para tu próxima cita y escríbenos por DM 💅',
   'Foto macro del diseño de la semana (buena luz natural)',
   '#NailArt #DiseñoDeUñas #UñasDecoradas #NailsInspo #Calama'),
  ('2026-08-27', 'podologia', 'Agenda tu hora online en 1 minuto ⏱',
   'Sin llamadas, sin esperas: entra a nuestro sitio, elige el día y la hora que te acomode y listo ✅ Te llega confirmación al correo al instante. Link directo en el perfil 🌸 www.vidadecolorespodologia.cl',
   'Captura del sitio web en un celular (pantalla de agendar hora)',
   '#AgendaOnline #Podologia #Calama #VidaDeColores'),
  ('2026-08-29', 'manicura', 'Clienta feliz: realce + diseño personalizado',
   'Un realce bien hecho cambia todo: estructura, durabilidad y ese acabado de salón 😍 Gracias por preferirnos 💜 Agenda tu realce por DM.',
   'Antes/después del realce con diseño (con consentimiento de la clienta)',
   '#Realce #UñasEsculpidas #NailsCalama #ClientaFeliz')
) AS v(fecha, rama, titulo, copy_text, imagen_sugerida, hashtags)
WHERE NOT EXISTS (SELECT 1 FROM content_plan);
