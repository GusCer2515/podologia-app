'use client'

import { useEffect, useState } from 'react'

// ============================================================
// Toasts con estilo de la marca — reemplazan los alert() nativos
// Uso: showToast('Ficha guardada') o showToast('Error...', 'error')
// ============================================================

type ToastItem = { id: number; message: string; type: 'success' | 'error' }

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }))
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, ...detail }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3500)
    }
    window.addEventListener('app-toast', handler)
    return () => window.removeEventListener('app-toast', handler)
  }, [])

  return (
    <div className="fixed top-5 right-5 z-[100] space-y-2 max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-up flex items-start gap-2 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold bg-marfil ${
            t.type === 'success'
              ? 'border-salvia/50 text-tinta'
              : 'border-rosa/60 text-rosa'
          }`}
        >
          <span>{t.type === 'success' ? '🌸' : '⚠️'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
