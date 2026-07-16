'use client'

import { useEffect, useState } from 'react'
import { getCarouselCases } from '@/lib/supabase'

// Carrusel de casos reales — el contenido se administra desde
// el panel admin (🖼 Contenido), sin tocar código
const INTERVALO_MS = 4500

export default function CasosCarousel() {
  const [casos, setCasos] = useState<any[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    getCarouselCases()
      .then((data) => setCasos(data || []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (casos.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % casos.length), INTERVALO_MS)
    return () => clearInterval(timer)
  }, [casos.length])

  // Sin casos activos, la sección no se muestra
  if (casos.length === 0) return null

  return (
    <section id="casos" className="bg-tinta">
      <div className="max-w-6xl mx-auto px-5 py-20 md:py-24">
        <p className="text-xs tracking-[0.3em] uppercase text-rosa-palo font-bold text-center">
          Casos reales
        </p>
        <h2 className="font-display text-4xl md:text-5xl text-marfil text-center mt-3 font-medium">
          Resultados que <span className="italic">hablan solos</span>
        </h2>

        {/* Carrusel con fundido cruzado */}
        <div className="relative max-w-3xl mx-auto mt-12 aspect-[16/10] rounded-[2.5rem] overflow-hidden shadow-2xl bg-tinta-suave/30">
          {casos.map((caso, i) => (
            <div
              key={caso.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Fondo: la misma foto difuminada (rellena el espacio) */}
              <img
                src={caso.image_url}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60"
              />
              {/* Foto completa al centro, sin recortes */}
              <img
                src={caso.image_url}
                alt={caso.titulo}
                className="absolute inset-0 w-full h-full object-contain"
              />
              {/* Leyenda sobre degradado */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-tinta/90 to-transparent pt-16 pb-6 px-8">
                <p className="font-display text-2xl text-marfil font-semibold">{caso.titulo}</p>
                <p className="text-sm text-marfil/80">{caso.descripcion}</p>
              </div>
            </div>
          ))}

          {/* Indicadores */}
          <div className="absolute bottom-4 right-6 flex gap-2">
            {casos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Ver caso ${i + 1}`}
                className={`w-2.5 h-2.5 rounded-full transition ${
                  i === index ? 'bg-marfil' : 'bg-marfil/40 hover:bg-marfil/70'
                }`}
              />
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-marfil/50 mt-6">
          Fotografías publicadas con consentimiento de nuestros pacientes.
        </p>
      </div>
    </section>
  )
}
