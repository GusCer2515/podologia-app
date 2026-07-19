'use client'

import { useEffect, useState } from 'react'
import { waClinica } from '@/lib/phone'
import { CLINIC, getClinicInfo, type ClinicInfo } from '@/lib/clinicConfig'

// Botones de contacto del sitio público — leen los datos
// editables desde ⚙️ Configuración del panel admin
export default function ContactButtons() {
  const [info, setInfo] = useState<ClinicInfo>(CLINIC)

  useEffect(() => {
    getClinicInfo().then(setInfo).catch(() => {})
  }, [])

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-semibold">
      <a
        href={`https://wa.me/${waClinica(info.phone)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-marfil border border-arena rounded-full px-6 py-3 text-tinta hover:shadow-md transition"
      >
        💬 WhatsApp {info.phone}
      </a>
      <a
        href={`https://instagram.com/${info.instagram.replace('@', '')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-marfil border border-arena rounded-full px-6 py-3 text-tinta hover:shadow-md transition"
      >
        📷 {info.instagram}
      </a>
      <a
        href={`mailto:${info.email}`}
        className="bg-marfil border border-arena rounded-full px-6 py-3 text-tinta hover:shadow-md transition"
      >
        ✉️ {info.email}
      </a>
    </div>
  )
}
