'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  getAllCarouselCases,
  addCarouselCase,
  updateCarouselCase,
  deleteCarouselCase,
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
  uploadPublicImage,
} from '@/lib/supabase'
import { showToast } from '@/components/toast'

const inputClass =
  'px-3 py-2 border border-arena rounded-xl bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-tinta-suave'

export default function ContentPage() {
  const [casos, setCasos] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tablesOk, setTablesOk] = useState(true)

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      getAllCarouselCases().catch(() => null),
      getAllPosts().catch(() => null),
    ])
    setTablesOk(c !== null && p !== null)
    setCasos(c ?? [])
    setPosts(p ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-gray-500 py-8 text-center">Cargando contenido...</p>

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="font-display text-3xl text-tinta font-medium">
        Contenido <span className="italic">del sitio</span>
      </h1>

      {!tablesOk && (
        <div className="bg-rosa-palo/60 border border-rosa/40 rounded-2xl px-5 py-4 text-sm text-tinta">
          ⚠️ <strong>Falta un paso:</strong> ejecuta{' '}
          <code className="bg-white px-2 py-0.5 rounded">supabase/fase11_contenido.sql</code> en el
          SQL Editor de Supabase para activar esta sección.
        </div>
      )}

      <CarouselManager casos={casos} reload={load} />
      <PostsManager posts={posts} reload={load} />
    </div>
  )
}

// ============================================================
// GESTOR DEL CARRUSEL
// ============================================================
function CarouselManager({ casos, reload }: { casos: any[]; reload: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  const upload = async () => {
    if (!file) {
      showToast('Selecciona una imagen', 'error')
      return
    }
    if (!titulo.trim()) {
      showToast('Escribe el título del caso', 'error')
      return
    }
    setUploading(true)
    try {
      const url = await uploadPublicImage('casos', file)
      const maxOrden = Math.max(0, ...casos.map((c) => c.orden ?? 0))
      await addCarouselCase({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        image_url: url,
        orden: maxOrden + 1,
      })
      showToast('Caso agregado al carrusel')
      setFile(null)
      setTitulo('')
      setDescripcion('')
      reload()
    } catch (err) {
      console.error(err)
      showToast('Error subiendo el caso', 'error')
    } finally {
      setUploading(false)
    }
  }

  const confirmDelete = async () => {
    try {
      await deleteCarouselCase(deleteTarget.id)
      showToast('Caso eliminado del carrusel')
      setDeleteTarget(null)
      reload()
    } catch (err) {
      console.error(err)
      showToast('Error eliminando el caso', 'error')
    }
  }

  return (
    <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
      <h2 className="font-display text-2xl text-tinta font-semibold mb-1">🎠 Carrusel de casos</h2>
      <p className="text-sm text-gray-500 mb-5">
        Estas fotos rotan en la sección "Casos reales" de la página principal.
      </p>

      {/* Subir nuevo caso */}
      <div className="bg-white border-2 border-dashed border-arena rounded-2xl p-5 mb-6 space-y-3">
        <p className="font-bold text-tinta text-sm">➕ Agregar nuevo caso</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm text-gray-600 file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-tinta file:text-marfil file:font-bold file:cursor-pointer"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (ej: Onicomicosis)"
            className={inputClass}
          />
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción corta del tratamiento"
            className={inputClass}
          />
        </div>
        <button
          onClick={upload}
          disabled={uploading}
          className="bg-tinta text-marfil px-6 py-2 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
        >
          {uploading ? 'Subiendo...' : '📤 Subir al carrusel'}
        </button>
      </div>

      {/* Casos existentes */}
      {casos.length === 0 ? (
        <p className="text-sm text-gray-400">No hay casos en el carrusel</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {casos.map((c) => (
            <CaseCard key={c.id} caso={c} reload={reload} onDelete={() => setDeleteTarget(c)} />
          ))}
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-sm w-full p-8 text-center animate-fade-up">
            <p className="text-4xl">🗑</p>
            <h3 className="font-display text-2xl text-tinta font-medium mt-3">
              ¿Eliminar <span className="italic">{deleteTarget.titulo}</span>?
            </h3>
            <p className="mt-2 text-sm text-foreground/70">Desaparecerá del carrusel del sitio.</p>
            <button
              onClick={confirmDelete}
              className="mt-5 w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition"
            >
              Sí, eliminar
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              className="mt-3 w-full py-3 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// Tarjeta editable de un caso del carrusel
function CaseCard({ caso, reload, onDelete }: { caso: any; reload: () => void; onDelete: () => void }) {
  const [titulo, setTitulo] = useState(caso.titulo)
  const [descripcion, setDescripcion] = useState(caso.descripcion ?? '')
  const [saving, setSaving] = useState(false)
  const changed = titulo !== caso.titulo || descripcion !== (caso.descripcion ?? '')

  const save = async () => {
    setSaving(true)
    try {
      await updateCarouselCase(caso.id, { titulo, descripcion: descripcion || null })
      showToast('Caso actualizado')
      reload()
    } catch (err) {
      console.error(err)
      showToast('Error guardando el caso', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async () => {
    try {
      await updateCarouselCase(caso.id, { is_active: !caso.is_active })
      showToast(caso.is_active ? 'Caso oculto del carrusel' : 'Caso visible en el carrusel')
      reload()
    } catch (err) {
      console.error(err)
      showToast('Error actualizando el caso', 'error')
    }
  }

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${caso.is_active ? 'border-arena' : 'border-arena opacity-60'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={caso.image_url} alt={caso.titulo} className="w-full h-36 object-cover" />
      <div className="p-3 space-y-2">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputClass} />
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción"
          className={inputClass}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {changed && (
            <button
              onClick={save}
              disabled={saving}
              className="bg-salvia text-marfil px-4 py-1 rounded-full text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? '...' : 'Guardar'}
            </button>
          )}
          <button
            onClick={toggleActive}
            className={`px-4 py-1 rounded-full text-xs font-bold transition ${
              caso.is_active
                ? 'bg-arena text-tinta hover:bg-arena/70'
                : 'bg-tinta text-marfil hover:bg-tinta-suave'
            }`}
          >
            {caso.is_active ? '👁 Ocultar' : '👁 Mostrar'}
          </button>
          <button
            onClick={onDelete}
            className="ml-auto text-rosa hover:bg-rosa-palo/50 rounded-full px-2 py-1 text-xs font-semibold transition"
          >
            🗑 Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// GESTOR DE NOTICIAS / CONSEJOS
// ============================================================
function PostsManager({ posts, reload }: { posts: any[]; reload: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const publish = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      showToast('Completa el título y el contenido', 'error')
      return
    }
    setSaving(true)
    try {
      let imageUrl: string | null = null
      if (file) imageUrl = await uploadPublicImage('noticias', file)
      await createPost({
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        image_url: imageUrl,
        video_url: videoUrl.trim() || null,
        publicado: true,
      })
      showToast('Publicación creada')
      setTitulo('')
      setContenido('')
      setVideoUrl('')
      setFile(null)
      reload()
    } catch (err) {
      console.error(err)
      showToast('Error creando la publicación', 'error')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (post: any) => {
    try {
      await updatePost(post.id, { publicado: !post.publicado })
      showToast(post.publicado ? 'Publicación oculta' : 'Publicación visible')
      reload()
    } catch (err) {
      console.error(err)
      showToast('Error actualizando la publicación', 'error')
    }
  }

  const remove = async (post: any) => {
    try {
      await deletePost(post.id)
      showToast('Publicación eliminada')
      reload()
    } catch (err) {
      console.error(err)
      showToast('Error eliminando la publicación', 'error')
    }
  }

  return (
    <section className="bg-marfil rounded-2xl border border-arena shadow-sm p-6">
      <h2 className="font-display text-2xl text-tinta font-semibold mb-1">📰 Consejos y noticias</h2>
      <p className="text-sm text-gray-500 mb-5">
        Publica consejos de cuidado podológico e información para tus pacientes. Aparecen en la
        sección "Consejos" del sitio público.
      </p>

      {/* Nueva publicación */}
      <div className="bg-white border-2 border-dashed border-arena rounded-2xl p-5 mb-6 space-y-3">
        <p className="font-bold text-tinta text-sm">✍️ Nueva publicación</p>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título (ej: 5 consejos para el cuidado del pie diabético)"
          className={inputClass}
        />
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="Escribe aquí el contenido..."
          rows={5}
          className={inputClass}
        />
        <div>
          <p className="text-xs text-gray-500 mb-1">Imagen (opcional)</p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-gray-600 file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-tinta file:text-marfil file:font-bold file:cursor-pointer"
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">
            🎬 Link de video (opcional — YouTube se muestra incrustado; otros links como botón)
          </p>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className={inputClass}
          />
        </div>
        <button
          onClick={publish}
          disabled={saving}
          className="bg-rosa text-marfil px-6 py-2 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? 'Publicando...' : '📢 Publicar'}
        </button>
      </div>

      {/* Publicaciones existentes */}
      {posts.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no hay publicaciones</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-white border border-arena ${
                !p.publicado ? 'opacity-60' : ''
              }`}
            >
              <div className="flex-1 min-w-40">
                <p className="font-bold text-tinta text-sm">{p.titulo}</p>
                <p className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString('es-CL')} ·{' '}
                  {p.publicado ? '🟢 Publicado' : '⚪ Oculto'}
                </p>
              </div>
              <button
                onClick={() => togglePublish(p)}
                className="bg-arena text-tinta px-4 py-1 rounded-full text-xs font-bold hover:bg-arena/70 transition"
              >
                {p.publicado ? 'Ocultar' : 'Publicar'}
              </button>
              <button
                onClick={() => remove(p)}
                className="text-rosa hover:bg-rosa-palo/50 rounded-full px-2 py-1 text-xs font-semibold transition"
              >
                🗑 Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
