'use client'

// Aviso de horas disponibles para los próximos días.
// Reemplaza el aviso manual por Instagram cuando alguien cancela: la web
// muestra sola el cupo que quedó libre, hoy o en las próximas 48 horas.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getPublicAvailableSlots, todayLocalStr } from '@/lib/slots'
import { getFreedSlots } from '@/lib/supabase'
import { CLINIC, getClinicInfo, type ClinicInfo } from '@/lib/clinicConfig'

// Hoy + las próximas 48 horas
const DIAS = 3
const REFRESCO_MS = 3 * 60 * 1000

interface Dia {
  fecha: string
  etiqueta: string
  slots: string[]
  liberadas: string[]
}

function sumarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function etiquetaDe(iso: string, i: number): string {
  if (i === 0) return 'Hoy'
  if (i === 1) return 'Mañana'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function HorasLiberadas() {
  const [dias, setDias] = useState<Dia[]>([])
  const [cargando, setCargando] = useState(true)
  const [clinic, setClinic] = useState<ClinicInfo>(CLINIC)
  const hoy = todayLocalStr()

  const cargar = useCallback(async () => {
    try {
      const fechas = Array.from({ length: DIAS }, (_, i) => sumarDias(hoy, i))
      const resultados = await Promise.all(
        fechas.map(async (fecha, i) => {
          const [res, freed] = await Promise.all([
            getPublicAvailableSlots(fecha).catch(() => ({ slots: [], message: '' })),
            getFreedSlots(fecha).catch(() => []),
          ])
          // Una hora liberada solo se destaca si además sigue disponible
          const libres = new Set(res.slots)
          const liberadas = freed
            .map((f) => String(f.slot).substring(0, 5))
            .filter((h) => libres.has(h))
          return { fecha, etiqueta: etiquetaDe(fecha, i), slots: res.slots, liberadas }
        })
      )

      // Hoy se muestra completo. Para los días siguientes solo interesan las
      // horas que se liberaron: el resto de la agenda ya está en la reserva.
      setDias(
        resultados.filter((d, i) =>
          i === 0 ? d.slots.length > 0 : d.liberadas.length > 0
        )
      )
    } catch (err) {
      console.error(err)
      setDias([])
    } finally {
      setCargando(false)
    }
  }, [hoy])

  useEffect(() => {
    cargar()
    getClinicInfo().then(setClinic).catch(() => {})
    const id = setInterval(cargar, REFRESCO_MS)
    return () => clearInterval(id)
  }, [cargar])

  // Sin horas que avisar, la sección no se muestra
  if (cargando || dias.length === 0) return null

  const hayLiberadas = dias.some((d) => d.liberadas.length > 0)
  const waMsg = encodeURIComponent(
    hayLiberadas
      ? 'Hola 👋 Vi en la página que se liberaron horas. ¿Sigue disponible alguna?'
      : 'Hola 👋 Vi en la página que hay horas disponibles. ¿Puedo tomar una?'
  )
  const waPhone = String(clinic.phone ?? '').replace(/\D/g, '')

  return (
    <section
      id="horas-liberadas"
      className="bg-gradient-to-b from-rosa-palo/50 to-crema border-y border-rosa/25"
    >
      <div className="max-w-5xl mx-auto px-5 py-14 md:py-16 text-center">
        <span className="inline-flex items-center gap-2 bg-rosa text-marfil text-xs font-bold uppercase tracking-[0.18em] px-4 py-1.5 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-marfil opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-marfil" />
          </span>
          {hayLiberadas ? 'Horas recién liberadas' : 'Disponible ahora'}
        </span>

        <h2 className="font-display text-4xl md:text-5xl text-tinta mt-5 font-medium">
          {hayLiberadas ? (
            <>
              Se <span className="italic">liberaron horas</span>
            </>
          ) : (
            <>
              Quedan horas <span className="italic">para hoy</span>
            </>
          )}
        </h2>

        <p className="text-sm text-foreground/70 mt-3 max-w-xl mx-auto">
          {hayLiberadas
            ? 'Alguien no pudo asistir y su hora quedó disponible. Tómala antes de que la reserven.'
            : 'Estas son las horas que siguen disponibles hoy. Se actualizan solas.'}
        </p>

        {/* Un bloque por día */}
        <div className="mt-9 space-y-7">
          {dias.map((dia) => (
            <div key={dia.fecha}>
              <p className="text-xs tracking-[0.22em] uppercase text-tinta-suave font-bold">
                {dia.etiqueta}
                {dia.liberadas.length > 0 && (
                  <span className="text-rosa">
                    {' '}
                    · {dia.liberadas.length} liberada{dia.liberadas.length > 1 ? 's' : ''}
                  </span>
                )}
              </p>

              <div className="flex flex-wrap justify-center gap-2.5 mt-3">
                {/* Hoy se muestran todas; los días siguientes, solo las liberadas */}
                {(dia.fecha === hoy ? dia.slots : dia.liberadas).map((h) => {
                  const recien = dia.liberadas.includes(h)
                  return (
                    <Link
                      key={h}
                      href={`/booking?fecha=${dia.fecha}&hora=${h}`}
                      className={`relative px-5 py-3 rounded-2xl font-bold text-lg shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        recien
                          ? 'bg-rosa text-marfil ring-2 ring-rosa/40'
                          : 'bg-marfil text-tinta border border-arena hover:border-tinta-suave'
                      }`}
                    >
                      {h}
                      {recien && (
                        <span className="absolute -top-2 -right-2 bg-tinta text-marfil text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap">
                          Liberada
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-10">
          <Link
            href={`/booking?fecha=${dias[0].fecha}`}
            className="bg-tinta text-marfil px-8 py-3.5 rounded-full font-bold hover:bg-tinta-suave transition shadow-sm"
          >
            Reservar mi hora
          </Link>
          {waPhone && (
            <a
              href={`https://wa.me/${waPhone}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-marfil text-tinta border-2 border-tinta/15 px-8 py-3.5 rounded-full font-bold hover:border-tinta/40 transition"
            >
              💬 Consultar por WhatsApp
            </a>
          )}
        </div>

        <p className="text-xs text-foreground/50 mt-6">
          Las horas se actualizan automáticamente cada pocos minutos.
        </p>
      </div>
    </section>
  )
}
