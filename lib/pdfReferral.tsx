// Generador del PDF de derivación médica (informe interclínico)
// Se importa dinámicamente (solo en el navegador, al hacer click)

import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { getClinicInfo, type ClinicInfo } from './clinicConfig'

// El pie de página va FIJO al borde inferior de cada hoja: si fuera parte
// del texto, empujaría una hoja nueva casi vacía al imprimir.
// paddingBottom reserva exactamente el alto del pie para que nada se pise.
const ALTO_PIE = 78

const s = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: ALTO_PIE,
    paddingHorizontal: 46,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#333333',
  },
  logo: { width: 118, alignSelf: 'center', marginBottom: 6 },
  titulo: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  cabecera: { marginBottom: 8, lineHeight: 1.35 },
  seccion: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 3,
  },
  parrafo: { lineHeight: 1.35, textAlign: 'justify', marginBottom: 2 },
  item: { lineHeight: 1.35, marginLeft: 12, marginBottom: 1 },
  etiqueta: { fontFamily: 'Helvetica-Bold' },
  firma: { marginTop: 16, lineHeight: 1.3 },
  firmaImg: { width: 86, marginBottom: -5 },
  // Encabezado breve que se repite desde la segunda hoja
  encabezadoCont: {
    position: 'absolute',
    top: 14,
    left: 46,
    right: 46,
    fontSize: 7.5,
    color: '#999999',
    textAlign: 'center',
  },
  pie: {
    position: 'absolute',
    bottom: 14,
    left: 46,
    right: 46,
  },
  pieFlores: { width: 220, alignSelf: 'center' },
  pieContacto: {
    fontSize: 7.5,
    color: '#999999',
    textAlign: 'center',
    marginTop: 4,
  },
  pagina: {
    position: 'absolute',
    bottom: 5,
    left: 46,
    right: 46,
    fontSize: 7.5,
    color: '#bbbbbb',
    textAlign: 'center',
  },
})

export interface ReferralData {
  // Paciente
  patientName: string
  patientRut?: string
  patientAge?: string
  patientPhone?: string
  // Derivación
  dirigidoA: string
  motivo: string
  sugerencia?: string
  proximoControl?: string
  // Datos clínicos (ya redactados por el panel)
  antecedentes: string[]
  evaluacionPie: string[]
  diagnostico: string[]
  tratamiento: string[]
  recomendaciones: string[]
  fechaUltimaAtencion?: string
  observaciones?: string
}

function Punto({ children }: { children: React.ReactNode }) {
  return <Text style={s.item}>• {children}</Text>
}

// Título de sección: minPresenceAhead evita que quede solo al pie de una
// hoja con su contenido al comienzo de la siguiente
function Seccion({ children }: { children: React.ReactNode }) {
  return (
    <Text style={s.seccion} minPresenceAhead={36}>
      {children}
    </Text>
  )
}

// Exportado para poder revisar la maquetación sin abrir el navegador
export function ReferralDocument({
  d,
  origin,
  info,
}: {
  d: ReferralData
  origin: string
  info: ClinicInfo
}) {
  const hoy = new Date().toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document title="Informe de derivación" author={info.professional}>
      <Page size="LETTER" style={s.page}>
        {/* Desde la segunda hoja, recordar de quién es el informe */}
        <Text
          style={s.encabezadoCont}
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1 ? `Informe de derivación · ${d.patientName}` : ''
          }
        />

        <Image style={s.logo} src={`${origin}/pdf-assets/logo.png`} />
        <Text style={s.titulo}>INFORME DE DERIVACIÓN INTERCLÍNICA{'\n'}PODOLÓGICA</Text>

        <View style={s.cabecera}>
          <Text>
            <Text style={s.etiqueta}>Fecha de Emisión: </Text>
            {hoy}
          </Text>
          <Text>
            <Text style={s.etiqueta}>De: </Text>
            {info.professional}, Podóloga Clínica
          </Text>
          <Text>
            <Text style={s.etiqueta}>Para: </Text>
            {d.dirigidoA}
          </Text>
        </View>

        <Seccion>DATOS DEL PACIENTE</Seccion>
        <Text style={s.parrafo}>
          <Text style={s.etiqueta}>Nombre: </Text>
          {d.patientName}
          {d.patientAge ? `   Edad: ${d.patientAge}` : ''}
          {d.patientRut ? `   RUT: ${d.patientRut}` : ''}
          {d.patientPhone ? `   Teléfono: ${d.patientPhone}` : ''}
        </Text>

        {/* 1. Antecedentes */}
        <Seccion>1. ANTECEDENTES SISTÉMICOS DE RELEVANCIA</Seccion>
        {d.antecedentes.length > 0 ? (
          d.antecedentes.map((t, i) => <Punto key={i}>{t}</Punto>)
        ) : (
          <Text style={s.item}>• Sin antecedentes sistémicos registrados.</Text>
        )}
        {d.evaluacionPie.length > 0 && (
          <>
            <Text style={{ ...s.item, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>
              Evaluación del pie:
            </Text>
            {d.evaluacionPie.map((t, i) => (
              <Punto key={i}>{t}</Punto>
            ))}
          </>
        )}

        {/* 2. Diagnóstico */}
        <Seccion>2. DIAGNÓSTICO PODOLÓGICO Y ESTADO ACTUAL</Seccion>
        {d.diagnostico.length > 0 ? (
          d.diagnostico.map((t, i) => <Punto key={i}>{t}</Punto>)
        ) : (
          <Text style={s.item}>• Sin hallazgos registrados en la ficha clínica.</Text>
        )}

        {/* 3. Tratamiento realizado */}
        <Seccion>3. TRATAMIENTO REALIZADO Y SUGERENCIA DE CONTINUIDAD</Seccion>
        {d.fechaUltimaAtencion && (
          <Text style={s.parrafo}>
            <Text style={s.etiqueta}>Última atención: </Text>
            {d.fechaUltimaAtencion}
          </Text>
        )}
        {d.tratamiento.length > 0 ? (
          d.tratamiento.map((t, i) => <Punto key={i}>{t}</Punto>)
        ) : (
          <Text style={s.item}>• Sin procedimientos registrados.</Text>
        )}
        {d.recomendaciones.length > 0 && (
          <>
            <Text style={{ ...s.item, fontFamily: 'Helvetica-Bold', marginTop: 4 }}>
              Recomendaciones entregadas:
            </Text>
            {d.recomendaciones.map((t, i) => (
              <Punto key={i}>{t}</Punto>
            ))}
          </>
        )}
        {d.observaciones && (
          <Text style={{ ...s.parrafo, marginTop: 4 }}>
            <Text style={s.etiqueta}>Observaciones: </Text>
            {d.observaciones}
          </Text>
        )}

        {/* 4. Motivo de la derivación */}
        <Seccion>4. MOTIVO DE LA DERIVACIÓN</Seccion>
        <Text style={s.parrafo}>{d.motivo}</Text>

        {d.sugerencia && (
          <>
            <Seccion>5. SUGERENCIA AL PROFESIONAL RECEPTOR</Seccion>
            <Text style={s.parrafo}>{d.sugerencia}</Text>
          </>
        )}
        {d.proximoControl && (
          <Text style={{ ...s.parrafo, marginTop: 4 }}>
            <Text style={s.etiqueta}>Próximo control: </Text>
            {d.proximoControl}
          </Text>
        )}

        {/* Firma: nunca se parte entre dos hojas */}
        <View style={s.firma} wrap={false}>
          <Text>Atentamente,</Text>
          <Image src={`${origin}/pdf-assets/firma.png`} style={s.firmaImg} />
          <Text style={s.etiqueta}>{info.professional}</Text>
          <Text>Podóloga Clínica</Text>
          <Text>Rut: {info.rut}</Text>
          <Text>Contacto: {info.phone}</Text>
        </View>

        {/* Pie fijo: se repite igual en todas las hojas */}
        <View style={s.pie} fixed>
          <Image style={s.pieFlores} src={`${origin}/pdf-assets/flores-pie.png`} />
          <Text style={s.pieContacto}>
            {info.instagram}  {info.phone}  {info.email}
          </Text>
        </View>

        <Text
          style={s.pagina}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : ''
          }
        />
      </Page>
    </Document>
  )
}

export async function generateReferralPdf(data: ReferralData): Promise<Blob> {
  const origin = window.location.origin
  const info = await getClinicInfo()
  return await pdf(<ReferralDocument d={data} origin={origin} info={info} />).toBlob()
}
