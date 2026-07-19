'use client'

// Aviso de horas disponibles para HOY.
// Reemplaza el aviso manual por Instagram cuando alguien cancela a última
// hora: la web muestra sola el cupo que quedó libre.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getPublicAvailableSlots, todayLocalStr } from '@/lib/slots'
import { getFreedSlots } from '@/lib/supabase'
import { CLINIC, getClinicInfo, type ClinicInfo } from '@/lib/clinicConfig'

// Cada cuánto se vuelve a consultar (una cancelación aparece sola)
const REFRESCO_MS = 3 * 60 * 1000

export default function HorasHoy() {
  const [slots, setSlots] = useState<string[]>([])
  const [liberadas, setLiberadas] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [clinic, setClinic] = useState<ClinicInfo>(CLINIC)
  const hoy = todayLocalStr()

  const cargar = useCallback(async () => {
    try {
      const [res, freed] = await Promise.all([
        getPublicAvailableSlots(hoy),
        getFreedSlots(hoy).catch(() => []),
      ])
      setSlots(res.slots)
      // La hora liberada solo se destaca si además sigue disponible
      const libres = new Set(res.slots)
      setLiberadas(
        freed
          .map((f) => String(f.slot).substring(0, 5))
          .filter((h) => libres.has(h))
      )
    } catch (err) {
      console.error(err)
      setSlots([])
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

  // Sin horas para hoy no hay nada que avisar: la sección no se muestra
  if (cargando || slots.length === 0) return null

  const hayLiberadas = liberadas.length > 0
  const fechaLarga = new Date(hoy + 'T00:00:00').toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const waMsg = encodeURIComponent(
    `Hola 👋 Vi en la página que hay horas disponibles para hoy (${fechaLarga}). ¿Sigue disponible?`
  )
  const waPhone = String(clinic.phone ?? '').replace(/\D/g, '')

  return (
    <section
      id="horas-hoy"
      className="bg-gradient-to-b from-rosa-palo/50 to-crema border-y border-rosa/25"
    >
      <div className="max-w-5xl mx-auto px-5 py-14 md:py-16 text-center">
        <span className="inline-flex items-center gap-2 bg-rosa text-marfil text-xs font-bold uppercase tracking-[0.18em] px-4 py-1.5 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-marfil opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-marfil" />
          </span>
          {hayLiberadas ? 'Hora recién liberada' : 'Disponible hoy'}
        </span>

        <h2 className="font-display text-4xl md:text-5xl text-tinta mt-5 font-medium">
          {hayLiberadas ? (
            <>
              Se <span className="italic">liberaron horas</span> para hoy
            </>
          ) : (
            <>
              Quedan horas <span className="italic">para hoy</span>
            </>
          )}
        </h2>

        <p className="text-foreground/70 mt-3 capitalize">{fechaLarga}</p>
        <p className="text-sm text-foreground/70 mt-1">
          {hayLiberadas
            ? 'Alguien no pudo asistir y su hora quedó disponible. Tómala antes de que la reserven.'
            : 'Estas son las horas que siguen disponibles hoy. Se actualizan solas.'}
        </p>

        {/* Horas disponibles */}
        <div className="flex flex-wrap justify-center gap-2.5 mt-8">
          {slots.map((h) => {
            const recien = liberadas.includes(h)
            return (
              <Link
                key={h}
                href={`/booking?fecha=${hoy}&hora=${h}`}
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

        <div className="flex flex-wrap justify-center gap-3 mt-9">
          <Link
            href={`/booking?fecha=${hoy}`}
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
