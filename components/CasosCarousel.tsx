'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

// ============================================================
// CASOS REALES — para agregar un caso:
// 1. Deja la foto en public/images/casos/ (jpg o png)
// 2. Agrega una línea aquí con la ruta y su descripción
// ============================================================
const CASOS: { src: string; title: string; desc: string }[] = [
  {
    src: '/images/casos/Caso1.jpeg',
    title: 'Onicomicosis',
    desc: 'Tratamiento antimicótico y resecado de hiperqueratosis',
  },
  {
    src: '/images/casos/Caso2.jpeg',
    title: 'Tratamiento antimicótico',
    desc: 'Aplicación localizada en uña afectada por hongos',
  },
  {
    src: '/images/casos/Caso3.jpeg',
    title: 'Heloma plantar',
    desc: 'Resecado de queratoma en la planta del pie',
  },
  {
    src: '/images/casos/Caso4.jpeg',
    title: 'Hiperqueratosis plantar',
    desc: 'Evaluación y tratamiento integral de la planta del pie',
  },
  {
    src: '/images/casos/Caso5.jpeg',
    title: 'Rehabilitación ungueal',
    desc: 'Recuperación de uñas dañadas con seguimiento clínico',
  },
  {
    src: '/images/casos/Caso6.jpeg',
    title: 'Grietas del talón',
    desc: 'Tratamiento de hiperqueratosis y grietas del talón',
  },
  {
    src: '/images/casos/Caso7.jpeg',
    title: 'Uña encarnada',
    desc: 'Tratamiento de onicocriptosis y alivio del dolor',
  },
]

const INTERVALO_MS = 4500

export default function CasosCarousel() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (CASOS.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % CASOS.length), INTERVALO_MS)
    return () => clearInterval(timer)
  }, [])

  // Si aún no hay fotos cargadas, la sección no se muestra
  if (CASOS.length === 0) return null

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
        <div className="relative max-w-3xl mx-auto mt-12 aspect-[16/10] rounded-[2.5rem] overflow-hidden shadow-2xl">
          {CASOS.map((caso, i) => (
            <div
              key={caso.src}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Fondo: la misma foto difuminada (rellena el espacio) */}
              <Image
                src={caso.src}
                alt=""
                fill
                aria-hidden
                className="object-cover blur-2xl scale-110 opacity-60"
                sizes="(max-width: 768px) 100vw, 768px"
              />
              {/* Foto completa al centro, sin recortes */}
              <Image
                src={caso.src}
                alt={caso.title}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 768px"
              />
              {/* Leyenda sobre degradado */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-tinta/90 to-transparent pt-16 pb-6 px-8">
                <p className="font-display text-2xl text-marfil font-semibold">{caso.title}</p>
                <p className="text-sm text-marfil/80">{caso.desc}</p>
              </div>
            </div>
          ))}

          {/* Indicadores */}
          <div className="absolute bottom-4 right-6 flex gap-2">
            {CASOS.map((_, i) => (
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
