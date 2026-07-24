'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getNotas, createNota, updateNota, deleteNota } from '@/lib/supabase'
import { showToast } from '@/components/toast'

// Colores tipo post-it. Cada uno con fondo suave, borde y un acento
// para el punto selector. Pensados para leerse bien en tablet.
const COLORES: Record<string, { bg: string; border: string; dot: string; nombre: string }> = {
  amarillo: { bg: 'bg-[#fdf6d8]', border: 'border-[#e9d98a]', dot: 'bg-[#e9c94a]', nombre: 'Amarillo' },
  rosa: { bg: 'bg-[#fbe4ec]', border: 'border-[#f0b6cc]', dot: 'bg-[#e987ab]', nombre: 'Rosa' },
  salvia: { bg: 'bg-[#e4f0e6]', border: 'border-[#b3d4ba]', dot: 'bg-[#89b894]', nombre: 'Verde' },
  azul: { bg: 'bg-[#e2edf7]', border: 'border-[#aecbe6]', dot: 'bg-[#7ba7d1]', nombre: 'Azul' },
  lila: { bg: 'bg-[#f0e8f7]', border: 'border-[#cdb6e0]', dot: 'bg-[#a37cc4]', nombre: 'Lila' },
  arena: { bg: 'bg-[#f2ece2]', border: 'border-[#ddceb8]', dot: 'bg-[#c3ab84]', nombre: 'Neutro' },
}
const COLOR_KEYS = Object.keys(COLORES)
const colorDe = (c?: string) => COLORES[c || 'amarillo'] || COLORES.amarillo

const NOTA_VACIA = { titulo: '', contenido: '', color: 'amarillo', fijada: false }

// Cada línea de la nota es una "fila" que se puede tachar. Para no tocar
// la base, una fila tachada se guarda envuelta en ~~ ~~ dentro de
// `contenido`; así las notas antiguas siguen funcionando tal cual.
type Fila = { id: string; texto: string; tachada: boolean }

let _fid = 0
const nuevoId = () => `f${Date.now().toString(36)}${(_fid++).toString(36)}`

function parseFilas(contenido?: string): Fila[] {
  const raw = contenido ?? ''
  if (raw === '') return [{ id: nuevoId(), texto: '', tachada: false }]
  return raw.split('\n').map((linea) => {
    const m = linea.match(/^~~(.*)~~$/)
    return m
      ? { id: nuevoId(), texto: m[1], tachada: true }
      : { id: nuevoId(), texto: linea, tachada: false }
  })
}

function serializeFilas(filas: Fila[]): string {
  return filas.map((f) => (f.tachada ? `~~${f.texto}~~` : f.texto)).join('\n')
}

// La fila crece hacia abajo si el texto ocupa más de una línea
function autoAlto(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function fechaCorta(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const hoy = new Date()
  const mismoDia = d.toDateString() === hoy.toDateString()
  return mismoDia
    ? `Hoy ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function NotesPage() {
  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tablaOk, setTablaOk] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // Nota abierta en el editor. `null` = editor cerrado.
  // Cuando es una nota nueva todavía sin guardar, id === null.
  const [editando, setEditando] = useState<any>(null)
  const [borrarTarget, setBorrarTarget] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      const data = await getNotas()
      setNotas(data ?? [])
      setTablaOk(true)
    } catch (err) {
      console.error(err)
      setTablaOk(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const abrirNueva = () => setEditando({ ...NOTA_VACIA, id: null })

  const term = busqueda.toLowerCase().trim()
  const filtradas = notas.filter(
    (n) =>
      !term ||
      n.titulo?.toLowerCase().includes(term) ||
      n.contenido?.toLowerCase().includes(term)
  )
  const fijadas = filtradas.filter((n) => n.fijada)
  const normales = filtradas.filter((n) => !n.fijada)

  const confirmarBorrado = async () => {
    try {
      await deleteNota(borrarTarget.id)
      setNotas((prev) => prev.filter((n) => n.id !== borrarTarget.id))
      showToast('Nota eliminada')
    } catch (err) {
      console.error(err)
      showToast('Error eliminando la nota', 'error')
    } finally {
      setBorrarTarget(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="font-display text-3xl text-tinta font-medium">
            Mis <span className="italic">notas</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tu agenda personal. Escribe recordatorios, ideas y pendientes.
          </p>
        </div>
        <button
          onClick={abrirNueva}
          className="bg-tinta text-marfil px-6 py-3 rounded-full font-bold hover:bg-tinta-suave transition shadow-sm"
        >
          ➕ Nueva nota
        </button>
      </div>

      {!tablaOk && (
        <div className="bg-rosa-palo/60 border border-rosa/40 rounded-2xl px-5 py-4 text-sm text-tinta mb-5">
          ⚠️ <strong>Falta un paso:</strong> ejecuta{' '}
          <code className="bg-white px-2 py-0.5 rounded">supabase/fase30_notas.sql</code> en el SQL
          Editor de Supabase para activar esta sección.
        </div>
      )}

      {/* Búsqueda */}
      {notas.length > 0 && (
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar en tus notas..."
          className="w-full max-w-md mb-6 px-4 py-2.5 border border-arena rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tinta-suave"
        />
      )}

      {loading ? (
        <p className="text-gray-500 py-10 text-center">Cargando notas...</p>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 px-4 bg-marfil rounded-3xl border-2 border-dashed border-arena">
          <p className="text-5xl">📝</p>
          <p className="font-display text-2xl text-tinta mt-4">
            {term ? 'Ninguna nota coincide' : 'Aún no tienes notas'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {term
              ? 'Prueba con otra palabra.'
              : 'Crea tu primera nota y deja de cargar la agenda de papel.'}
          </p>
          {!term && (
            <button
              onClick={abrirNueva}
              className="mt-6 bg-salvia text-marfil px-7 py-3 rounded-full font-bold hover:opacity-90 transition"
            >
              ➕ Crear mi primera nota
            </button>
          )}
        </div>
      ) : (
        <>
          {fijadas.length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave mb-2">
                📌 Fijadas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {fijadas.map((n) => (
                  <NotaCard key={n.id} nota={n} onAbrir={() => setEditando(n)} onBorrar={() => setBorrarTarget(n)} />
                ))}
              </div>
            </>
          )}

          {normales.length > 0 && (
            <>
              {fijadas.length > 0 && (
                <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave mb-2">
                  Otras notas
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {normales.map((n) => (
                  <NotaCard key={n.id} nota={n} onAbrir={() => setEditando(n)} onBorrar={() => setBorrarTarget(n)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Editor */}
      {editando && (
        <EditorNota
          nota={editando}
          onClose={() => setEditando(null)}
          onGuardada={(guardada, esNueva) => {
            setNotas((prev) => {
              const sinEsta = prev.filter((n) => n.id !== guardada.id)
              return [guardada, ...sinEsta]
            })
            // mantener el editor apuntando a la versión con id ya real
            if (esNueva) setEditando(guardada)
          }}
          onBorrar={() => {
            setBorrarTarget(editando)
            setEditando(null)
          }}
        />
      )}

      {/* Confirmar borrado */}
      {borrarTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-sm w-full p-8 text-center animate-fade-up">
            <p className="text-4xl">🗑</p>
            <h3 className="font-display text-2xl text-tinta font-medium mt-3">¿Eliminar esta nota?</h3>
            <p className="mt-2 text-sm text-foreground/70">
              {borrarTarget.titulo?.trim() ? `"${borrarTarget.titulo}"` : 'Esta acción no se puede deshacer.'}
            </p>
            <button
              onClick={confirmarBorrado}
              className="mt-5 w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition"
            >
              Sí, eliminar
            </button>
            <button
              onClick={() => setBorrarTarget(null)}
              className="mt-3 w-full py-3 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TARJETA (post-it) EN LA GRILLA
// ============================================================
function NotaCard({ nota, onAbrir, onBorrar }: { nota: any; onAbrir: () => void; onBorrar: () => void }) {
  const c = colorDe(nota.color)
  return (
    <div
      onClick={onAbrir}
      className={`group relative ${c.bg} ${c.border} border rounded-2xl p-4 shadow-sm hover:shadow-md transition cursor-pointer min-h-40 flex flex-col`}
    >
      {nota.fijada && <span className="absolute top-2 right-3 text-base" title="Fijada">📌</span>}

      {nota.titulo?.trim() && (
        <p className="font-bold text-tinta text-base leading-snug pr-6 mb-1.5 break-words">
          {nota.titulo}
        </p>
      )}
      {nota.contenido ? (
        <div className="text-sm text-tinta/85 break-words flex-1 space-y-0.5 overflow-hidden">
          {parseFilas(nota.contenido)
            .slice(0, 9)
            .map((f) => (
              <p
                key={f.id}
                className={`whitespace-pre-wrap ${f.tachada ? 'line-through text-tinta/40' : ''}`}
              >
                {f.texto || ' '}
              </p>
            ))}
        </div>
      ) : (
        <p className="text-sm flex-1">
          <span className="italic text-tinta/40">Sin contenido</span>
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/5">
        <span className="text-[11px] text-tinta/50 font-medium">{fechaCorta(nota.updated_at)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onBorrar()
          }}
          className="opacity-0 group-hover:opacity-100 text-tinta/40 hover:text-rosa transition text-sm px-1"
          title="Eliminar"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

// ============================================================
// EDITOR (modal a pantalla amplia, con autoguardado)
// ============================================================
function EditorNota({
  nota,
  onClose,
  onGuardada,
  onBorrar,
}: {
  nota: any
  onClose: () => void
  onGuardada: (guardada: any, esNueva: boolean) => void
  onBorrar: () => void
}) {
  const [titulo, setTitulo] = useState(nota.titulo ?? '')
  const [filas, setFilas] = useState<Fila[]>(() => parseFilas(nota.contenido))
  const [color, setColor] = useState(nota.color ?? 'amarillo')
  const [fijada, setFijada] = useState(!!nota.fijada)
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'guardado'>('idle')

  // Referencias a cada campo para poder mover el cursor entre filas
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const [focoId, setFocoId] = useState<string | null>(null)

  // id real de la nota (se rellena tras el primer guardado si es nueva)
  const idRef = useRef<string | null>(nota.id)
  // snapshot de lo último guardado, para no guardar sin cambios
  const guardadoRef = useRef({
    titulo: nota.titulo ?? '',
    contenido: nota.contenido ?? '',
    color: nota.color ?? 'amarillo',
    fijada: !!nota.fijada,
  })
  const c = colorDe(color)

  const guardar = useCallback(async () => {
    const actual = { titulo: titulo.trim(), contenido: serializeFilas(filas), color, fijada }
    const prev = guardadoRef.current
    const sinCambios =
      actual.titulo === prev.titulo &&
      actual.contenido === prev.contenido &&
      actual.color === prev.color &&
      actual.fijada === prev.fijada
    // No crear notas totalmente vacías
    if (!idRef.current && !actual.titulo && !actual.contenido.trim()) return
    if (idRef.current && sinCambios) return

    setEstado('guardando')
    try {
      if (idRef.current) {
        await updateNota(idRef.current, actual)
        const guardada = { ...nota, id: idRef.current, ...actual, updated_at: new Date().toISOString() }
        guardadoRef.current = actual
        onGuardada(guardada, false)
      } else {
        const creada = await createNota(actual)
        idRef.current = creada.id
        guardadoRef.current = actual
        onGuardada(creada, true)
      }
      setEstado('guardado')
    } catch (err) {
      console.error(err)
      setEstado('idle')
      showToast('Error guardando la nota', 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, filas, color, fijada])

  // Autoguardado con rebote mientras escribe
  useEffect(() => {
    const t = setTimeout(guardar, 900)
    return () => clearTimeout(t)
  }, [guardar])

  // Cada fila crece sola según el texto que tenga
  useEffect(() => {
    filas.forEach((f) => {
      const el = refs.current[f.id]
      if (el) autoAlto(el)
    })
  }, [filas])

  // Mueve el cursor a la fila recién creada o a la anterior al borrar
  useEffect(() => {
    if (!focoId) return
    const el = refs.current[focoId]
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
    setFocoId(null)
  }, [focoId, filas])

  // En una nota nueva, el cursor parte en la primera fila
  useEffect(() => {
    if (!nota.id && filas[0]) setFocoId(filas[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- Operaciones sobre las filas -----
  const setTextoFila = (id: string, texto: string) =>
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, texto: texto.replace(/\n/g, '') } : f)))

  const toggleTachada = (id: string) =>
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, tachada: !f.tachada } : f)))

  // Enter abre una fila nueva justo debajo
  const filaNuevaTras = (id: string) => {
    const i = filas.findIndex((f) => f.id === id)
    const nueva: Fila = { id: nuevoId(), texto: '', tachada: false }
    const copia = [...filas]
    copia.splice(i + 1, 0, nueva)
    setFilas(copia)
    setFocoId(nueva.id)
  }

  // Borrar en una fila vacía la elimina y sube el cursor
  const borrarFilaVacia = (id: string) => {
    if (filas.length === 1) return
    const i = filas.findIndex((f) => f.id === id)
    const copia = filas.filter((f) => f.id !== id)
    setFilas(copia)
    const anterior = copia[Math.max(0, i - 1)]
    if (anterior) setFocoId(anterior.id)
  }

  const quitarFila = (id: string) =>
    setFilas((fs) =>
      fs.length === 1
        ? [{ id: nuevoId(), texto: '', tachada: false }]
        : fs.filter((f) => f.id !== id)
    )

  const agregarFila = () => {
    const nueva: Fila = { id: nuevoId(), texto: '', tachada: false }
    setFilas((fs) => [...fs, nueva])
    setFocoId(nueva.id)
  }

  // Guardar al cerrar (por si quedó algo en el rebote)
  const cerrar = () => {
    guardar()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-tinta/50 backdrop-blur-sm sm:p-4"
      onClick={cerrar}
    >
      <div
        className={`${c.bg} ${c.border} border sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl sm:my-auto flex flex-col max-h-screen sm:max-h-[90vh] animate-fade-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-black/10 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFijada((f) => !f)}
              className={`h-10 px-3 rounded-full text-sm font-bold transition border ${
                fijada
                  ? 'bg-tinta text-marfil border-tinta'
                  : 'bg-white/60 text-tinta border-black/10 hover:bg-white'
              }`}
              title={fijada ? 'Quitar de fijadas' : 'Fijar arriba'}
            >
              📌 {fijada ? 'Fijada' : 'Fijar'}
            </button>
            <span className="text-xs text-tinta/50 font-medium min-w-16">
              {estado === 'guardando' ? 'Guardando…' : estado === 'guardado' ? '✓ Guardado' : ''}
            </span>
          </div>
          <button
            onClick={cerrar}
            className="w-10 h-10 rounded-full border border-black/10 bg-white/60 text-tinta hover:bg-white transition text-lg leading-none shrink-0"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (opcional)"
            className="w-full bg-transparent text-2xl font-bold text-tinta placeholder:text-tinta/30 focus:outline-none mb-3"
          />
          {/* Cuerpo: una fila por línea, cada una se puede tachar */}
          <div className="space-y-1">
            {filas.map((f) => (
              <div key={f.id} className="flex items-start gap-2.5 group/fila">
                <button
                  onClick={() => toggleTachada(f.id)}
                  className={`mt-1.5 w-8 h-8 shrink-0 rounded-lg border-2 flex items-center justify-center text-sm font-bold transition ${
                    f.tachada
                      ? 'bg-tinta border-tinta text-marfil'
                      : 'border-tinta/25 text-transparent hover:border-tinta/60 hover:text-tinta/25'
                  }`}
                  title={f.tachada ? 'Destachar esta línea' : 'Tachar esta línea'}
                  aria-label={f.tachada ? 'Destachar esta línea' : 'Tachar esta línea'}
                >
                  ✓
                </button>

                <textarea
                  ref={(el) => {
                    refs.current[f.id] = el
                  }}
                  value={f.texto}
                  onChange={(e) => setTextoFila(f.id, e.target.value)}
                  onInput={(e) => autoAlto(e.currentTarget)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      filaNuevaTras(f.id)
                    } else if (e.key === 'Backspace' && f.texto === '') {
                      e.preventDefault()
                      borrarFilaVacia(f.id)
                    }
                  }}
                  rows={1}
                  placeholder="Escribe aquí..."
                  className={`flex-1 min-w-0 bg-transparent py-1.5 text-lg leading-relaxed resize-none overflow-hidden focus:outline-none placeholder:text-tinta/25 ${
                    f.tachada ? 'line-through text-tinta/40' : 'text-tinta/90'
                  }`}
                />

                <button
                  onClick={() => quitarFila(f.id)}
                  className="mt-2 shrink-0 opacity-0 group-hover/fila:opacity-100 focus:opacity-100 text-tinta/30 hover:text-rosa transition text-sm px-1"
                  title="Quitar esta línea"
                  aria-label="Quitar esta línea"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={agregarFila}
            className="mt-3 flex items-center gap-2.5 text-sm font-semibold text-tinta/50 hover:text-tinta transition"
          >
            <span className="w-8 h-8 rounded-lg border-2 border-dashed border-tinta/25 flex items-center justify-center text-base">
              +
            </span>
            Agregar línea
          </button>

          <p className="text-xs text-tinta/40 mt-4">
            Toca el cuadrito para tachar una línea · Enter crea la siguiente
          </p>
        </div>

        {/* Pie: colores + eliminar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-black/10 shrink-0">
          <div className="flex items-center gap-2">
            {COLOR_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setColor(k)}
                className={`w-8 h-8 rounded-full ${COLORES[k].dot} transition ${
                  color === k ? 'ring-2 ring-offset-2 ring-tinta ring-offset-transparent scale-110' : 'hover:scale-110'
                }`}
                title={COLORES[k].nombre}
                aria-label={COLORES[k].nombre}
              />
            ))}
          </div>
          <button
            onClick={onBorrar}
            className="h-10 px-4 rounded-full text-sm font-bold text-rosa border border-rosa/30 hover:bg-rosa/10 transition"
          >
            🗑 Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
