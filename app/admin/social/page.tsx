'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  getContentPlan,
  createContentPost,
  updateContentPost,
  deleteContentPost,
} from '@/lib/supabase'
import { showToast } from '@/components/toast'

const inputClass =
  'w-full px-3 py-2 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` }
}

const RAMA_STYLE: Record<string, string> = {
  podologia: 'bg-tinta/10 text-tinta',
  manicura: 'bg-[#a37cc4]/15 text-[#7c5a99]',
}
const RAMA_LABEL: Record<string, string> = {
  podologia: '🦶 Podología',
  manicura: '💅 Manicura',
}

export default function SocialPage() {
  const [month, setMonth] = useState(currentMonth())
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tablesOk, setTablesOk] = useState(true)
  const [filtroRama, setFiltroRama] = useState('todas')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    const { start, end } = monthRange(m)
    const data = await getContentPlan(start, end).catch(() => null)
    setTablesOk(data !== null)
    setPosts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load(month)
  }, [month, load])

  const filtered = posts.filter(
    (p) =>
      (filtroRama === 'todas' || p.rama === filtroRama) &&
      (filtroEstado === 'todos' || p.estado === filtroEstado)
  )
  const pendientes = posts.filter((p) => p.estado === 'pendiente').length
  const publicados = posts.filter((p) => p.estado === 'publicado').length

  const nombreMes = new Date(month + '-01T00:00:00').toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-tinta font-medium">
          📱 Contenido <span className="italic">para redes</span>
        </h1>
        <button
          onClick={() => setShowNew(!showNew)}
          className="bg-tinta text-marfil px-5 py-2 rounded-full font-bold hover:bg-tinta-suave transition"
        >
          {showNew ? 'Cancelar' : '+ Nueva publicación'}
        </button>
      </div>

      {!tablesOk && (
        <div className="bg-rosa-palo/60 border border-rosa/40 rounded-2xl px-5 py-4 text-sm text-tinta">
          ⚠️ <strong>Falta un paso:</strong> ejecuta{' '}
          <code className="bg-white px-2 py-0.5 rounded">supabase/fase17_nails_redes.sql</code> en
          el SQL Editor (incluye 18 publicaciones de ejemplo listas para usar).
        </div>
      )}

      {/* Cómo se usa */}
      <div className="bg-arena/40 border border-arena rounded-2xl px-5 py-4 text-sm text-tinta">
        💡 Plan de contenido para Instagram de ambas ramas: cada tarjeta trae el <strong>texto
        listo para copiar</strong> 📋 y la <strong>foto o video sugerido</strong>. Publica en la
        fecha indicada, marca ✅ y listo. Agrega tus propias ideas con "+ Nueva publicación" y
        proyecta los meses que quieras con el selector.
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-1.5 border border-arena rounded-xl bg-marfil text-sm text-tinta font-semibold focus:outline-none focus:ring-2 focus:ring-tinta-suave"
        />
        <select
          value={filtroRama}
          onChange={(e) => setFiltroRama(e.target.value)}
          className="px-4 py-1.5 border border-arena rounded-full bg-marfil text-sm font-semibold text-tinta"
        >
          <option value="todas">Ambas ramas</option>
          <option value="podologia">🦶 Podología</option>
          <option value="manicura">💅 Manicura</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-4 py-1.5 border border-arena rounded-full bg-marfil text-sm font-semibold text-tinta"
        >
          <option value="todos">Todos</option>
          <option value="pendiente">⏳ Pendientes</option>
          <option value="publicado">✅ Publicados</option>
        </select>
        <p className="text-sm text-gray-500 ml-auto">
          {nombreMes}: <strong className="text-tinta">{pendientes}</strong> pendientes ·{' '}
          <strong className="text-salvia">{publicados}</strong> publicados
        </p>
      </div>

      {/* Nueva publicación */}
      {showNew && (
        <NewPostForm
          defaultDate={`${month}-15`}
          onDone={() => {
            setShowNew(false)
            load(month)
          }}
        />
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-gray-500 py-8 text-center">Cargando plan de contenido...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 py-10 text-center bg-marfil rounded-2xl border border-arena shadow-sm">
          Sin publicaciones planificadas para {nombreMes} con esos filtros.
          <br />
          <span className="text-sm">Usa "+ Nueva publicación" para planificar este mes.</span>
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <PostCard key={p.id} post={p} reload={() => load(month)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============ Tarjeta de publicación ============
function PostCard({ post, reload }: { post: any; reload: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>(post)

  const fecha = new Date(post.fecha + 'T00:00:00')
  const publicado = post.estado === 'publicado'

  const copiar = async () => {
    const texto = `${post.copy_text ?? ''}\n\n${post.hashtags ?? ''}`.trim()
    try {
      await navigator.clipboard.writeText(texto)
      showToast('Texto copiado — pégalo en Instagram 📋')
    } catch {
      showToast('No se pudo copiar', 'error')
    }
  }

  const togglePublicado = async () => {
    try {
      await updateContentPost(post.id, { estado: publicado ? 'pendiente' : 'publicado' })
      showToast(publicado ? 'Marcado como pendiente' : '¡Publicado! 🎉')
      reload()
    } catch {
      showToast('Error actualizando', 'error')
    }
  }

  const guardar = async () => {
    try {
      await updateContentPost(post.id, {
        fecha: form.fecha,
        rama: form.rama,
        titulo: form.titulo,
        copy_text: form.copy_text,
        imagen_sugerida: form.imagen_sugerida,
        hashtags: form.hashtags,
      })
      showToast('Publicación actualizada')
      setEditing(false)
      reload()
    } catch {
      showToast('Error guardando', 'error')
    }
  }

  const eliminar = async () => {
    try {
      await deleteContentPost(post.id)
      showToast('Publicación eliminada')
      reload()
    } catch {
      showToast('Error eliminando', 'error')
    }
  }

  if (editing) {
    return (
      <div className="bg-marfil rounded-2xl border-2 border-tinta/20 shadow-sm p-5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputClass} />
          <select value={form.rama} onChange={(e) => setForm({ ...form, rama: e.target.value })} className={inputClass}>
            <option value="podologia">🦶 Podología</option>
            <option value="manicura">💅 Manicura</option>
          </select>
        </div>
        <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título" className={inputClass} />
        <textarea value={form.copy_text ?? ''} onChange={(e) => setForm({ ...form, copy_text: e.target.value })} rows={4} placeholder="Texto de la publicación" className={inputClass} />
        <input value={form.imagen_sugerida ?? ''} onChange={(e) => setForm({ ...form, imagen_sugerida: e.target.value })} placeholder="Foto/video sugerido" className={inputClass} />
        <input value={form.hashtags ?? ''} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="#hashtags" className={inputClass} />
        <div className="flex gap-2">
          <button onClick={guardar} className="bg-salvia text-marfil px-6 py-2 rounded-full font-bold hover:opacity-90 transition">
            Guardar
          </button>
          <button onClick={() => setEditing(false)} className="px-6 py-2 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-marfil rounded-2xl border border-arena shadow-sm p-5 flex gap-4 hover:shadow-md transition ${
        publicado ? 'opacity-60' : ''
      }`}
    >
      {/* Fecha */}
      <div className="text-center shrink-0 w-14">
        <p className="font-display text-3xl text-tinta font-semibold leading-none">
          {fecha.getDate()}
        </p>
        <p className="text-[10px] uppercase font-bold text-gray-400">
          {fecha.toLocaleDateString('es-CL', { month: 'short' })}
        </p>
        <p className="text-[10px] uppercase text-gray-400">
          {fecha.toLocaleDateString('es-CL', { weekday: 'short' })}
        </p>
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${RAMA_STYLE[post.rama] ?? RAMA_STYLE.podologia}`}>
            {RAMA_LABEL[post.rama] ?? post.rama}
          </span>
          {publicado && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-salvia/15 text-salvia">
              ✅ Publicado
            </span>
          )}
        </div>
        <p className={`font-bold text-tinta mt-1 ${publicado ? 'line-through' : ''}`}>{post.titulo}</p>
        {post.copy_text && (
          <p className="text-sm text-foreground/75 mt-1 whitespace-pre-line bg-white border border-arena rounded-xl px-3 py-2">
            {post.copy_text}
          </p>
        )}
        {post.imagen_sugerida && (
          <p className="text-xs text-gray-500 mt-1.5">📷 <em>{post.imagen_sugerida}</em></p>
        )}
        {post.hashtags && <p className="text-xs text-tinta-suave mt-1">{post.hashtags}</p>}

        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={copiar} className="bg-tinta text-marfil px-4 py-1.5 rounded-full text-xs font-bold hover:bg-tinta-suave transition">
            📋 Copiar texto
          </button>
          <button
            onClick={togglePublicado}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              publicado ? 'bg-arena text-tinta hover:bg-arena/70' : 'bg-salvia text-marfil hover:opacity-90'
            }`}
          >
            {publicado ? '↩ Volver a pendiente' : '✅ Marcar publicado'}
          </button>
          <button onClick={() => setEditing(true)} className="px-4 py-1.5 rounded-full text-xs font-bold text-tinta border border-arena hover:border-tinta-suave transition">
            ✏️ Editar
          </button>
          <button onClick={eliminar} className="text-rosa/70 hover:text-rosa px-2 py-1 text-xs font-semibold transition">
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Nueva publicación ============
function NewPostForm({ defaultDate, onDone }: { defaultDate: string; onDone: () => void }) {
  const [form, setForm] = useState<any>({ fecha: defaultDate, rama: 'podologia' })
  const [saving, setSaving] = useState(false)

  const crear = async () => {
    if (!form.fecha || !form.titulo?.trim()) {
      showToast('Fecha y título son obligatorios', 'error')
      return
    }
    setSaving(true)
    try {
      await createContentPost({
        fecha: form.fecha,
        rama: form.rama,
        titulo: form.titulo.trim(),
        copy_text: form.copy_text?.trim() || null,
        imagen_sugerida: form.imagen_sugerida?.trim() || null,
        hashtags: form.hashtags?.trim() || null,
      })
      showToast('Publicación agregada al plan')
      onDone()
    } catch (err) {
      console.error(err)
      showToast('Error creando la publicación', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-marfil rounded-2xl border-2 border-dashed border-arena shadow-sm p-5 space-y-3 animate-fade-up">
      <p className="font-bold text-tinta text-sm">✍️ Planificar publicación</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputClass} />
        <select value={form.rama} onChange={(e) => setForm({ ...form, rama: e.target.value })} className={inputClass}>
          <option value="podologia">🦶 Podología</option>
          <option value="manicura">💅 Manicura</option>
        </select>
      </div>
      <input value={form.titulo ?? ''} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título / idea del post" className={inputClass} />
      <textarea value={form.copy_text ?? ''} onChange={(e) => setForm({ ...form, copy_text: e.target.value })} rows={4} placeholder="Texto listo para copiar a Instagram..." className={inputClass} />
      <input value={form.imagen_sugerida ?? ''} onChange={(e) => setForm({ ...form, imagen_sugerida: e.target.value })} placeholder="📷 Foto o video sugerido (ej: antes/después de un caso)" className={inputClass} />
      <input value={form.hashtags ?? ''} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="#hashtags #calama #vidadecolores" className={inputClass} />
      <button
        onClick={crear}
        disabled={saving}
        className="bg-rosa text-marfil px-8 py-2.5 rounded-full font-bold hover:opacity-90 transition disabled:opacity-50"
      >
        {saving ? 'Guardando...' : '📌 Agregar al plan'}
      </button>
    </div>
  )
}
