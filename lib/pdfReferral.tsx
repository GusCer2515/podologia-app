// Generador del PDF de derivación médica (informe interclínico)
// Se importa dinámicamente (solo en el navegador, al hacer click)

import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { getClinicInfo, type ClinicInfo } from './clinicConfig'

const s = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 24,
    paddingHorizontal: 46,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333333',
  },
  logo: { width: 150, alignSelf: 'center', marginBottom: 10 },
  titulo: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  cabecera: { marginBottom: 12, lineHeight: 1.5 },
  seccion: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 5,
  },
  parrafo: { lineHeight: 1.5, textAlign: 'justify', marginBottom: 3 },
  item: { lineHeight: 1.5, marginLeft: 12, marginBottom: 2 },
  etiqueta: { fontFamily: 'Helvetica-Bold' },
  firma: { marginTop: 26, lineHeight: 1.4 },
  pieBanner: { position: 'relative', marginTop: 18 },
  pieFlores: { width: '100%' },
  pieContacto: {
    fontSize: 8,
    color: '#999999',
    textAlign: 'center',
    marginTop: 6,
  },
  firmaImg: { width: 110, marginBottom: -8 },
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

function ReferralDocument({
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

        <Text style={s.seccion}>DATOS DEL PACIENTE</Text>
        <Text style={s.parrafo}>
          <Text style={s.etiqueta}>Nombre: </Text>
          {d.patientName}
          {d.patientAge ? `   Edad: ${d.patientAge}` : ''}
          {d.patientRut ? `   RUT: ${d.patientRut}` : ''}
          {d.patientPhone ? `   Teléfono: ${d.patientPhone}` : ''}
        </Text>

        {/* 1. Antecedentes */}
        <Text style={s.seccion}>1. ANTECEDENTES SISTÉMICOS DE RELEVANCIA</Text>
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
        <Text style={s.seccion}>2. DIAGNÓSTICO PODOLÓGICO Y ESTADO ACTUAL</Text>
        {d.diagnostico.length > 0 ? (
          d.diagnostico.map((t, i) => <Punto key={i}>{t}</Punto>)
        ) : (
          <Text style={s.item}>• Sin hallazgos registrados en la ficha clínica.</Text>
        )}

        {/* 3. Tratamiento realizado */}
        <Text style={s.seccion}>3. TRATAMIENTO REALIZADO Y SUGERENCIA DE CONTINUIDAD</Text>
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
        <Text style={s.seccion}>4. MOTIVO DE LA DERIVACIÓN</Text>
        <Text style={s.parrafo}>{d.motivo}</Text>

        {d.sugerencia && (
          <>
            <Text style={s.seccion}>5. SUGERENCIA AL PROFESIONAL RECEPTOR</Text>
            <Text style={s.parrafo}>{d.sugerencia}</Text>
          </>
        )}
        {d.proximoControl && (
          <Text style={{ ...s.parrafo, marginTop: 4 }}>
            <Text style={s.etiqueta}>Próximo control: </Text>
            {d.proximoControl}
          </Text>
        )}

        {/* Firma */}
        <View style={s.firma}>
          <Text>Atentamente,</Text>
          <Image src={`${origin}/pdf-assets/firma.png`} style={s.firmaImg} />
          <Text style={s.etiqueta}>{info.professional}</Text>
          <Text>Podóloga Clínica</Text>
          <Text>Rut: {info.rut}</Text>
          <Text>Contacto: {info.phone}</Text>
        </View>

        <View style={s.pieBanner}>
          <Image style={s.pieFlores} src={`${origin}/pdf-assets/flores-pie.png`} />
        </View>
        <Text style={s.pieContacto}>
          {info.instagram}  {info.phone}  {info.email}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateReferralPdf(data: ReferralData): Promise<Blob> {
  const origin = window.location.origin
  const info = await getClinicInfo()
  return await pdf(<ReferralDocument d={data} origin={origin} info={info} />).toBlob()
}
