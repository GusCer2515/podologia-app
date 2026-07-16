// Generador de PDFs para recetas e indicaciones
// Se importa dinámicamente (solo en el navegador, al hacer click)

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { CLINIC } from './clinicConfig'

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#333333',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  brand: {
    fontSize: 30,
    fontFamily: 'Times-Italic',
    color: '#4a6da7',
    textAlign: 'center',
    marginBottom: 6,
  },
  brandUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: '#e8b4c8',
    width: 180,
    alignSelf: 'center',
    marginBottom: 24,
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
  footerName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 3,
  },
  footerRut: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 14,
  },
  footerContact: {
    fontSize: 9,
    color: '#999999',
    textAlign: 'center',
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

function ClinicDocument({ data }: { data: PdfDocumentData }) {
  return (
    <Document
      title={data.tipo === 'receta' ? 'Receta' : 'Indicaciones'}
      author={CLINIC.professional}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Encabezado */}
        <Text style={styles.brand}>{CLINIC.brand}</Text>
        <View style={styles.brandUnderline} />
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

        {/* Pie de página */}
        <Text style={styles.footerName}>{CLINIC.professional}</Text>
        <Text style={styles.footerRut}>Rut: {CLINIC.rut}</Text>
        <Text style={styles.footerContact}>
          {CLINIC.instagram}  {CLINIC.phone}  {CLINIC.email}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateDocumentPdf(data: PdfDocumentData): Promise<Blob> {
  return await pdf(<ClinicDocument data={data} />).toBlob()
}
