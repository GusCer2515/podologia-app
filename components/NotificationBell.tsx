'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getRecentWebBookings } from '@/lib/supabase'

const SEEN_KEY = 'vdc_notif_last_seen'

// Campana de avisos de reservas hechas desde el sitio web público
export default function NotificationBell() {
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState<number>(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    getRecentWebBookings(20)
      .then((d) => setItems(d || []))
      .catch(() => {})
  }

  useEffect(() => {
    setLastSeen(Number(localStorage.getItem(SEEN_KEY) || 0))
    load()
    // Refrescar cada 60s para captar reservas nuevas
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [])

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const nuevos = items.filter((i) => new Date(i.created_at).getTime() > lastSeen).length

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      const now = Date.now()
      localStorage.setItem(SEEN_KEY, String(now))
      setLastSeen(now)
    }
  }

  const fechaRel = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'recién'
    if (min < 60) return `hace ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `hace ${h} h`
    return `hace ${Math.floor(h / 24)} d`
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative w-10 h-10 rounded-full bg-marfil border border-arena hover:bg-arena/50 transition flex items-center justify-center"
        title="Reservas desde el sitio web"
      >
        <span className="text-lg">🔔</span>
        {nuevos > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rosa text-marfil text-[10px] font-bold flex items-center justify-center">
            {nuevos}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-marfil rounded-2xl border border-arena shadow-2xl z-50 overflow-hidden animate-fade-up">
          <div className="px-4 py-3 border-b border-arena bg-arena/40">
            <p className="font-display text-lg text-tinta font-semibold">🔔 Reservas web</p>
            <p className="text-xs text-gray-500">Horas que los pacientes tomaron en el sitio</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 p-5 text-center">Aún no hay reservas desde la web</p>
            ) : (
              items.map((i) => {
                const esNuevo = new Date(i.created_at).getTime() > lastSeen
                const cancelada = i.status === 'cancelled'
                return (
                  <Link
                    key={i.id}
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 border-b border-arena/60 hover:bg-rosa-palo/20 transition ${esNuevo ? 'bg-rosa-palo/15' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-bold text-tinta ${cancelada ? 'line-through text-gray-400' : ''}`}>
                        {i.patients?.name || 'Paciente'}
                      </p>
                      {esNuevo && <span className="w-2 h-2 rounded-full bg-rosa shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500">
                      📅 {new Date(i.appointment_date).toLocaleDateString('es-CL')} ·{' '}
                      {String(i.appointment_date).substring(11, 16)} hrs
                      {cancelada && ' · cancelada'}
                    </p>
                    <p className="text-[11px] text-gray-400">Reservó {fechaRel(i.created_at)}</p>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
