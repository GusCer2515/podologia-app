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

// Clasifica un link de video para saber si se puede INCRUSTAR en el sitio
function classifyVideo(url?: string | null): { kind: string; id?: string; embeddable: boolean; label: string } {
  if (!url || !url.trim()) return { kind: 'none', embeddable: false, label: '' }
  const u = url.trim()
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (yt) return { kind: 'youtube', id: yt[1], embeddable: true, label: '✅ YouTube — se mostrará el video reproducible' }
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return { kind: 'vimeo', id: vm[1], embeddable: true, label: '✅ Vimeo — se mostrará el video reproducible' }
  if (/instagram\.com|tiktok\.com|facebook\.com|fb\.watch/.test(u))
    return { kind: 'social', embeddable: false, label: '⚠️ Instagram/TikTok/Facebook NO permiten incrustar sus videos en otras páginas. Se mostrará como un botón "Ver video" que abre el enlace.' }
  return { kind: 'other', embeddable: false, label: 'ℹ️ Enlace no reconocido para incrustar. Se mostrará como botón "Ver video". Para incrustar usa YouTube o Vimeo.' }
}

// Vista previa de una publicación tal como se verá en /blog
function PostPreview({ post }: { post: { titulo: string; contenido: string; imageUrl?: string; videoUrl?: string; created_at?: string } }) {
  const v = classifyVideo(post.videoUrl)
  const fecha = post.created_at ? new Date(post.created_at) : new Date()
  return (
    <article className="bg-marfil rounded-3xl border border-arena shadow-sm overflow-hidden">
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt={post.titulo} className="w-full h-56 object-cover" />
      )}
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-rosa-palo/70 text-rosa text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            {v.embeddable ? '🎬 Video' : '🌸 Consejo'}
          </span>
          <p className="text-xs text-foreground/50 font-semibold">
            {fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <h2 className="font-display text-3xl text-tinta font-semibold mt-2">{post.titulo || 'Sin título'}</h2>
        <p className="mt-3 text-foreground/80 leading-relaxed whitespace-pre-line">{post.contenido}</p>
        {v.kind === 'youtube' && (
          <div className="mt-5 rounded-2xl overflow-hidden border border-arena">
            <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}`} title={post.titulo} className="w-full aspect-video" allowFullScreen />
          </div>
        )}
        {v.kind === 'vimeo' && (
          <div className="mt-5 rounded-2xl overflow-hidden border border-arena">
            <iframe src={`https://player.vimeo.com/video/${v.id}`} title={post.titulo} className="w-full aspect-video" allowFullScreen />
          </div>
        )}
        {post.videoUrl && !v.embeddable && (
          <a href={post.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block bg-tinta text-marfil px-6 py-2.5 rounded-full text-sm font-bold">🎬 Ver video</a>
        )}
      </div>
    </article>
  )
}

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
  const [preview, setPreview] = useState(false)

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
          <p className="text-xs text-gray-500 mb-1">🎬 Link de video (opcional)</p>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Pega el link (YouTube o Vimeo para verlo dentro del sitio)"
            className={inputClass}
          />
          {videoUrl.trim() && (
            <p className={`text-xs mt-1 ${classifyVideo(videoUrl).embeddable ? 'text-salvia' : 'text-orange-600'}`}>
              {classifyVideo(videoUrl).label}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (!titulo.trim() && !contenido.trim()) {
                showToast('Escribe algo para ver la vista previa', 'error')
                return
              }
              setPreview(true)
            }}
            className="bg-tinta text-marfil px-6 py-2 rounded-full font-bold hover:bg-tinta-suave transition"
          >
            👁 Vista previa
          </button>
          <button
            onClick={publish}
            disabled={saving}
            className="bg-rosa text-marfil px-6 py-2 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Publicando...' : '📢 Publicar'}
          </button>
        </div>
      </div>

      {/* Modal de vista previa */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4" onClick={() => setPreview(false)}>
          <div className="bg-crema rounded-3xl shadow-2xl border border-arena max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-display text-xl text-tinta font-semibold">👁 Así se verá en el sitio</p>
              <button onClick={() => setPreview(false)} className="text-gray-400 hover:text-tinta text-xl">✕</button>
            </div>
            <PostPreview post={{ titulo, contenido, imageUrl: file ? URL.createObjectURL(file) : undefined, videoUrl }} />
            <p className="text-xs text-gray-400 mt-3 text-center">Esto es solo una previsualización. Aún no se ha publicado.</p>
          </div>
        </div>
      )}

      {/* Publicaciones existentes */}
      {posts.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no hay publicaciones</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <PostRow key={p.id} post={p} reload={reload} onToggle={() => togglePublish(p)} onRemove={() => remove(p)} />
          ))}
        </div>
      )}
    </section>
  )
}

// Fila de publicación con edición inline
function PostRow({ post, reload, onToggle, onRemove }: { post: any; reload: () => void; onToggle: () => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [titulo, setTitulo] = useState(post.titulo ?? '')
  const [contenido, setContenido] = useState(post.contenido ?? '')
  const [videoUrl, setVideoUrl] = useState(post.video_url ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [quitarImagen, setQuitarImagen] = useState(false)

  const guardar = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      showToast('Completa el título y el contenido', 'error')
      return
    }
    setSaving(true)
    try {
      const fields: any = {
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        video_url: videoUrl.trim() || null,
      }
      if (file) fields.image_url = await uploadPublicImage('noticias', file)
      else if (quitarImagen) fields.image_url = null
      await updatePost(post.id, fields)
      showToast('Publicación actualizada')
      setEditing(false)
      setFile(null)
      setQuitarImagen(false)
      reload()
    } catch (err) {
      console.error(err)
      showToast('Error guardando los cambios', 'error')
    } finally {
      setSaving(false)
    }
  }

  const imagenPreview = file
    ? URL.createObjectURL(file)
    : quitarImagen
    ? undefined
    : post.image_url || undefined

  if (editing) {
    return (
      <div className="bg-white border-2 border-tinta/20 rounded-2xl p-5 space-y-3">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className={inputClass} />
        <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={5} placeholder="Contenido" className={inputClass} />
        <div>
          <p className="text-xs text-gray-500 mb-1">🎬 Link de video (opcional)</p>
          <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube o Vimeo para verlo dentro del sitio" className={inputClass} />
          {videoUrl.trim() && (
            <p className={`text-xs mt-1 ${classifyVideo(videoUrl).embeddable ? 'text-salvia' : 'text-orange-600'}`}>{classifyVideo(videoUrl).label}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Imagen</p>
          {post.image_url && !file && !quitarImagen && (
            <div className="flex items-center gap-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.image_url} alt="" className="w-16 h-16 object-cover rounded-lg" />
              <button onClick={() => setQuitarImagen(true)} className="text-rosa text-xs font-semibold hover:underline">Quitar imagen</button>
            </div>
          )}
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block text-sm text-gray-600 file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-tinta file:text-marfil file:font-bold file:cursor-pointer" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPreview(true)} className="bg-tinta text-marfil px-5 py-2 rounded-full text-sm font-bold hover:bg-tinta-suave transition">👁 Vista previa</button>
          <button onClick={guardar} disabled={saving} className="bg-salvia text-marfil px-6 py-2 rounded-full text-sm font-bold hover:opacity-90 transition disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          <button onClick={() => { setEditing(false); setTitulo(post.titulo); setContenido(post.contenido); setVideoUrl(post.video_url ?? ''); setFile(null); setQuitarImagen(false) }} className="px-6 py-2 rounded-full text-sm font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition">Cancelar</button>
        </div>

        {preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4" onClick={() => setPreview(false)}>
            <div className="bg-crema rounded-3xl shadow-2xl border border-arena max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-xl text-tinta font-semibold">👁 Así se verá en el sitio</p>
                <button onClick={() => setPreview(false)} className="text-gray-400 hover:text-tinta text-xl">✕</button>
              </div>
              <PostPreview post={{ titulo, contenido, imageUrl: imagenPreview, videoUrl, created_at: post.created_at }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-white border border-arena ${!post.publicado ? 'opacity-60' : ''}`}>
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0" />
      )}
      <div className="flex-1 min-w-40">
        <p className="font-bold text-tinta text-sm">
          {classifyVideo(post.video_url).embeddable ? '🎬 ' : ''}{post.titulo}
        </p>
        <p className="text-xs text-gray-400">
          {new Date(post.created_at).toLocaleDateString('es-CL')} · {post.publicado ? '🟢 Publicado' : '⚪ Oculto'}
        </p>
      </div>
      <button onClick={() => setEditing(true)} className="bg-tinta text-marfil px-4 py-1 rounded-full text-xs font-bold hover:bg-tinta-suave transition">✏️ Editar</button>
      <button onClick={onToggle} className="bg-arena text-tinta px-4 py-1 rounded-full text-xs font-bold hover:bg-arena/70 transition">{post.publicado ? 'Ocultar' : 'Publicar'}</button>
      <button onClick={onRemove} className="text-rosa hover:bg-rosa-palo/50 rounded-full px-2 py-1 text-xs font-semibold transition">🗑</button>
    </div>
  )
}
