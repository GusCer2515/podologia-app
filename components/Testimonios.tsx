'use client'

import { useEffect, useState } from 'react'
import { getApprovedTestimonials, submitTestimonial } from '@/lib/supabase'
import { initials, colorFor } from '@/lib/avatar'

const INTERVALO_MS = 7000

const Estrellas = ({ n, size = 'text-base' }: { n: number; size?: string }) => (
  <span className={`${size} tracking-tight`} aria-label={`${n} de 5 estrellas`}>
    {'★'.repeat(n)}
    <span className="text-arena">{'★'.repeat(5 - n)}</span>
  </span>
)

export default function Testimonios() {
  const [items, setItems] = useState<any[]>([])
  const [index, setIndex] = useState(0)
  const [showForm, setShowForm] = useState(false)
  // Formulario
  const [nombre, setNombre] = useState('')
  const [rating, setRating] = useState(5)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    getApprovedTestimonials()
      .then((d) => setItems(d || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (items.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), INTERVALO_MS)
    return () => clearInterval(t)
  }, [items.length])

  const enviar = async () => {
    if (!nombre.trim() || comentario.trim().length < 10) {
      setResultado({ ok: false, msg: 'Escribe tu nombre y cuéntanos un poco más (mínimo 10 caracteres).' })
      return
    }
    setEnviando(true)
    try {
      const r = await submitTestimonial(nombre, rating, comentario)
      if (r.success) {
        setResultado({ ok: true, msg: '¡Gracias por compartir tu experiencia! 🌸 La revisaremos y se publicará pronto.' })
        setNombre('')
        setComentario('')
        setRating(5)
      } else {
        setResultado({ ok: false, msg: r.error || 'No pudimos enviar tu comentario.' })
      }
    } catch {
      setResultado({ ok: false, msg: 'Ocurrió un problema. Intenta nuevamente.' })
    } finally {
      setEnviando(false)
    }
  }

  const actual = items[index]

  return (
    <section id="testimonios" className="bg-arena/30 border-y border-arena">
      <div className="max-w-4xl mx-auto px-5 py-20 md:py-24">
        <p className="text-xs tracking-[0.3em] uppercase text-rosa font-bold text-center">
          Testimonios
        </p>
        <h2 className="font-display text-4xl md:text-5xl text-tinta text-center mt-3 font-medium">
          Lo que dicen <span className="italic">nuestros pacientes</span>
        </h2>

        {/* Carrusel */}
        {items.length > 0 ? (
          <div className="relative mt-12">
            <div className="bg-marfil rounded-3xl border border-arena shadow-lg shadow-tinta/5 px-8 py-10 md:px-14 md:py-12 text-center min-h-56 flex flex-col justify-center">
              <span className="font-display text-6xl text-rosa/40 leading-none select-none">“</span>
              <p
                key={actual.id}
                className="animate-fade-up text-lg md:text-xl text-foreground/80 leading-relaxed italic -mt-4"
              >
                {actual.comentario}
              </p>
              <div className="mt-6 flex flex-col items-center gap-2">
                <span
                  className={`w-12 h-12 rounded-full ${colorFor(actual.nombre)} text-marfil flex items-center justify-center font-bold shadow-sm`}
                >
                  {initials(actual.nombre)}
                </span>
                <p className="font-bold text-tinta">{actual.nombre}</p>
                <span className="text-rosa">
                  <Estrellas n={actual.rating || 5} />
                </span>
              </div>
            </div>

            {/* Flechas */}
            {items.length > 1 && (
              <>
                <button
                  onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
                  aria-label="Anterior"
                  className="absolute left-0 md:-left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-marfil border border-arena text-tinta hover:border-tinta-suave transition shadow-sm"
                >
                  ‹
                </button>
                <button
                  onClick={() => setIndex((i) => (i + 1) % items.length)}
                  aria-label="Siguiente"
                  className="absolute right-0 md:-right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-marfil border border-arena text-tinta hover:border-tinta-suave transition shadow-sm"
                >
                  ›
                </button>
              </>
            )}

            {/* Indicadores */}
            {items.length > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Testimonio ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === index ? 'w-6 bg-rosa' : 'w-2 bg-arena hover:bg-tinta-suave'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-foreground/60 mt-10">
            Aún no hay testimonios publicados. ¿Te atendiste con nosotros? ¡Sé la primera persona
            en contarnos! 🌸
          </p>
        )}

        {/* CTA para dejar testimonio */}
        <div className="text-center mt-10">
          <button
            onClick={() => {
              setShowForm(true)
              setResultado(null)
            }}
            className="bg-tinta text-marfil px-8 py-3 rounded-full font-bold hover:bg-tinta-suave transition shadow-lg shadow-tinta/20"
          >
            ✍️ Compartir mi experiencia
          </button>
        </div>
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-md w-full p-7 animate-fade-up max-h-[90vh] overflow-y-auto">
            {resultado?.ok ? (
              <div className="text-center">
                <p className="text-4xl">🌸</p>
                <h3 className="font-display text-2xl text-tinta font-medium mt-3">¡Gracias!</h3>
                <p className="mt-2 text-sm text-foreground/75">{resultado.msg}</p>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setResultado(null)
                  }}
                  className="mt-6 w-full bg-tinta text-marfil py-3 rounded-full font-bold hover:bg-tinta-suave transition"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-display text-2xl text-tinta font-medium">
                  Cuéntanos tu <span className="italic">experiencia</span>
                </h3>
                <p className="text-sm text-foreground/70 mt-1">
                  Tu comentario nos ayuda muchísimo 💛
                </p>

                <label className="block text-xs font-bold uppercase tracking-wide text-tinta-suave mt-5 mb-1.5">
                  Tu nombre
                </label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: María P."
                  maxLength={100}
                  className="w-full px-4 py-2.5 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
                />

                <label className="block text-xs font-bold uppercase tracking-wide text-tinta-suave mt-4 mb-1.5">
                  ¿Cómo fue tu atención?
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} estrellas`}
                      className={`text-3xl transition ${n <= rating ? 'text-rosa' : 'text-arena hover:text-rosa/50'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-bold uppercase tracking-wide text-tinta-suave mt-4 mb-1.5">
                  Tu comentario
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={4}
                  maxLength={600}
                  placeholder="Cuéntanos cómo fue tu experiencia en Vida de Colores..."
                  className="w-full px-4 py-2.5 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave"
                />
                <p className="text-[11px] text-gray-400 mt-1">{comentario.length}/600</p>

                {resultado && !resultado.ok && (
                  <p className="text-sm text-rosa font-semibold mt-3">{resultado.msg}</p>
                )}

                <button
                  onClick={enviar}
                  disabled={enviando}
                  className="mt-5 w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition shadow-lg shadow-rosa/25 disabled:opacity-50"
                >
                  {enviando ? 'Enviando...' : 'Enviar mi comentario'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="mt-2 w-full py-2.5 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition"
                >
                  Cancelar
                </button>
                <p className="text-[11px] text-gray-400 mt-3 text-center">
                  Tu comentario será revisado antes de publicarse.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
