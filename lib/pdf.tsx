// Generador de PDFs para recetas e indicaciones
// Se importa dinámicamente (solo en el navegador, al hacer click)

import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { CLINIC } from './clinicConfig'

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#333333',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  logo: {
    width: 260,
    alignSelf: 'center',
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  fieldValue: {
    marginLeft: 4,
  },
  content: {
    marginTop: 6,
    lineHeight: 1.6,
  },
  spacer: {
    flexGrow: 1,
  },
  footerBanner: {
    position: 'relative',
  },
  footerFlowers: {
    width: '100%',
  },
  footerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  footerName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 3,
  },
  footerRut: {
    fontSize: 11,
    textAlign: 'center',
  },
  footerContact: {
    fontSize: 9,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
  },
})

export interface PdfDocumentData {
  tipo: 'receta' | 'indicacion'
  patientName: string
  patientRut?: string
  patientAge?: string
  diagnostico?: string
  contenido?: string
  proximoControl?: string
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || ''}</Text>
    </View>
  )
}

function ClinicDocument({ data, origin }: { data: PdfDocumentData; origin: string }) {
  return (
    <Document
      title={data.tipo === 'receta' ? 'Receta' : 'Indicaciones'}
      author={CLINIC.professional}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Logo Vida de Colores */}
        <Image style={styles.logo} src={`${origin}/pdf-assets/logo.png`} />
        <Text style={styles.subtitle}>{CLINIC.subtitle}</Text>

        {/* Campos según tipo de documento */}
        {data.tipo === 'receta' ? (
          <View>
            <Field label="Nombre del paciente:" value={data.patientName} />
            <Field label="C.I:" value={data.patientRut} />
            <Field label="Edad:" value={data.patientAge} />
            <Field label="Fecha de próximo control:" value={data.proximoControl} />
            <Field label="Diagnóstico:" value={data.diagnostico} />
            <Text style={styles.fieldLabel}>RP/</Text>
            <Text style={styles.content}>{data.contenido || ''}</Text>
          </View>
        ) : (
          <View>
            <Field label="Nombre del paciente:" value={data.patientName} />
            <Field label="Diagnóstico:" value={data.diagnostico} />
            <Text style={styles.fieldLabel}>Indicaciones del tratamiento:</Text>
            <Text style={styles.content}>{data.contenido || ''}</Text>
          </View>
        )}

        <View style={styles.spacer} />

        {/* Pie: flores en las esquinas + nombre/rut centrado encima */}
        <View style={styles.footerBanner}>
          <Image style={styles.footerFlowers} src={`${origin}/pdf-assets/flores-pie.png`} />
          <View style={styles.footerOverlay}>
            <Text style={styles.footerName}>{CLINIC.professional}</Text>
            <Text style={styles.footerRut}>Rut: {CLINIC.rut}</Text>
          </View>
        </View>

        <Text style={styles.footerContact}>
          {CLINIC.instagram}  {CLINIC.phone}  {CLINIC.email}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateDocumentPdf(data: PdfDocumentData): Promise<Blob> {
  // origin = URL del sitio (funciona en localhost y en producción)
  const origin = window.location.origin
  return await pdf(<ClinicDocument data={data} origin={origin} />).toBlob()
}
