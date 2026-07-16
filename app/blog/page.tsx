'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPublishedPosts } from '@/lib/supabase'

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
      {/* Navbar simple */}
      <header className="sticky top-0 z-50 bg-crema/90 backdrop-blur border-b border-arena">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="font-display italic text-2xl text-tinta font-semibold">
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

      <main className="max-w-3xl mx-auto px-5 py-14">
        <p className="text-xs tracking-[0.3em] uppercase text-rosa font-bold text-center">
          Consejos y novedades
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-tinta text-center mt-3 font-medium mb-12">
          Aprende a <span className="italic">cuidar tus pies</span>
        </h1>

        {loading ? (
          <p className="text-center text-gray-500 py-10">Cargando publicaciones...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-500 py-10 bg-marfil rounded-3xl border border-arena">
            Pronto publicaremos consejos y novedades. ¡Vuelve pronto! 🌸
          </p>
        ) : (
          <div className="space-y-8">
            {posts.map((p) => (
              <article
                key={p.id}
                className="bg-marfil rounded-3xl border border-arena shadow-sm overflow-hidden"
              >
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.titulo} className="w-full h-64 object-cover" />
                )}
                <div className="p-7">
                  <p className="text-xs text-rosa font-bold uppercase tracking-widest">
                    {new Date(p.created_at).toLocaleDateString('es-CL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <h2 className="font-display text-3xl text-tinta font-semibold mt-2">
                    {p.titulo}
                  </h2>
                  <p className="mt-4 text-foreground/80 leading-relaxed whitespace-pre-line">
                    {p.contenido}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="text-center mt-14">
          <Link
            href="/"
            className="text-sm text-tinta-suave hover:text-tinta transition font-semibold"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  )
}
