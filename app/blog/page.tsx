'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getPublishedPosts } from '@/lib/supabase'

// Extrae el ID de un link de YouTube (watch, shorts, youtu.be, embed)
function youtubeId(url?: string | null): string | null {
  if (!url) return null
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  )
  return m ? m[1] : null
}

export default function BlogPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublishedPosts()
      .then((data) => setPosts(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-crema">
      {/* ============ NAVBAR con volver visible ============ */}
      <header className="sticky top-0 z-50 bg-crema/90 backdrop-blur border-b border-arena">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-tinta bg-marfil border border-arena rounded-full px-4 py-2 hover:border-tinta-suave hover:shadow-sm transition"
          >
            ← Volver al inicio
          </Link>
          <Link
            href="/"
            className="hidden sm:block font-display italic text-2xl text-tinta font-semibold"
          >
            Vida de Colores
          </Link>
          <Link
            href="/booking"
            className="bg-tinta text-marfil px-5 py-2 rounded-full text-sm font-bold hover:bg-tinta-suave transition"
          >
            Agendar hora
          </Link>
        </div>
      </header>

      {/* ============ HERO con vida ============ */}
      <section className="relative overflow-hidden">
        {/* Fondos decorativos */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-rosa-palo/50 blur-3xl" />
        <div className="absolute -top-10 right-0 w-72 h-72 rounded-full bg-salvia/15 blur-3xl" />
        <div className="absolute inset-x-0 -bottom-8 opacity-15 animate-float pointer-events-none">
          <Image
            src="/pdf-assets/flores-pie.png"
            alt=""
            width={1500}
            height={300}
            className="w-full h-auto"
          />
        </div>

        <div className="relative max-w-3xl mx-auto px-5 pt-16 pb-20 text-center">
          <p className="animate-fade-up text-xs tracking-[0.3em] uppercase text-rosa font-bold">
            Consejos y novedades
          </p>
          <h1 className="animate-fade-up fade-delay-1 font-display text-5xl md:text-6xl text-tinta font-medium mt-4 leading-[1.05]">
            Aprende a<br />
            <span className="italic">cuidar tus pies</span>
          </h1>
          <p className="animate-fade-up fade-delay-2 mt-5 text-foreground/70 max-w-md mx-auto">
            Tips de cuidado podológico, novedades y recomendaciones de nuestra
            especialista para mantener tus pies sanos todo el año.
          </p>
        </div>
      </section>

      {/* ============ PUBLICACIONES ============ */}
      <main className="max-w-3xl mx-auto px-5 pb-20 -mt-6">
        {loading ? (
          <p className="text-center text-gray-500 py-10">Cargando publicaciones...</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-14 bg-marfil rounded-3xl border border-arena animate-fade-up">
            <p className="text-4xl mb-3">🌸</p>
            <p className="font-display text-2xl text-tinta">Pronto publicaremos consejos</p>
            <p className="text-sm text-foreground/60 mt-1">¡Vuelve pronto!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((p, i) => {
              const ytId = youtubeId(p.video_url)
              return (
                <article
                  key={p.id}
                  className="animate-fade-up bg-marfil rounded-3xl border border-arena shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  style={{ animationDelay: `${Math.min(i * 0.12, 0.6)}s` }}
                >
                  {/* Imagen de portada */}
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.titulo} className="w-full h-64 object-cover" />
                  )}

                  <div className="p-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="bg-rosa-palo/70 text-rosa text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                        {ytId || p.video_url ? '🎬 Video' : '🌸 Consejo'}
                      </span>
                      <p className="text-xs text-foreground/50 font-semibold">
                        {new Date(p.created_at).toLocaleDateString('es-CL', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    <h2 className="font-display text-3xl text-tinta font-semibold mt-3">
                      {p.titulo}
                    </h2>

                    <p className="mt-4 text-foreground/80 leading-relaxed whitespace-pre-line">
                      {p.contenido}
                    </p>

                    {/* Video embebido (YouTube) o link externo */}
                    {ytId ? (
                      <div className="mt-6 rounded-2xl overflow-hidden border border-arena">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                          title={p.titulo}
                          className="w-full aspect-video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : p.video_url ? (
                      <a
                        href={p.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-6 inline-block bg-tinta text-marfil px-6 py-2.5 rounded-full text-sm font-bold hover:bg-tinta-suave transition"
                      >
                        🎬 Ver video
                      </a>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* CTA final */}
        <div className="text-center mt-16 animate-fade-up">
          <p className="font-display italic text-2xl text-tinta mb-4">
            ¿Tus pies necesitan atención?
          </p>
          <Link
            href="/booking"
            className="inline-block bg-rosa text-marfil px-10 py-4 rounded-full font-bold hover:opacity-90 transition shadow-lg shadow-rosa/25"
          >
            Agendar mi hora →
          </Link>
          <div className="mt-8">
            <Link
              href="/"
              className="text-sm text-tinta-suave hover:text-tinta transition font-semibold"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
