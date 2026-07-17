'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signIn, signOut, getSession } from '@/lib/supabase'
import { Toaster } from '@/components/toast'
import NotificationBell from '@/components/NotificationBell'

const NAV_ITEMS = [
  { href: '/admin', label: '📅 Agenda' },
  { href: '/admin/patients', label: '👥 Pacientes' },
  { href: '/admin/nails', label: '💅 Nails' },
  { href: '/admin/finance', label: '💰 Finanzas' },
  { href: '/admin/content', label: '🖼 Contenido' },
  { href: '/admin/social', label: '📱 Redes' },
  { href: '/admin/settings', label: '⚙️ Configuración' },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    getSession().then((session) => {
      setAuthed(!!session)
      setChecking(false)
    })
  }, [])

  const handleLogin = async () => {
    if (!email || !password) {
      setLoginError('Ingresa tu email y contraseña')
      return
    }
    setLoggingIn(true)
    setLoginError('')
    try {
      await signIn(email, password)
      setAuthed(true)
      setEmail('')
      setPassword('')
    } catch {
      setLoginError('Email o contraseña incorrectos')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    setAuthed(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-crema flex items-center justify-center">
        <p className="font-display italic text-2xl text-tinta-suave">Cargando...</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-crema flex items-center justify-center p-4">
        <div className="bg-marfil p-9 rounded-3xl shadow-xl shadow-tinta/10 border border-arena max-w-md w-full">
          <div className="text-center mb-7">
            <Image
              src="/pdf-assets/logo.png"
              alt="Vida de Colores"
              width={220}
              height={110}
              className="mx-auto"
            />
            <p className="text-xs tracking-[0.25em] uppercase text-rosa font-bold mt-3">
              Panel administrativo
            </p>
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2.5 border border-arena rounded-xl bg-white mb-3 focus:outline-none focus:ring-2 focus:ring-tinta-suave"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-4 py-2.5 border border-arena rounded-xl bg-white mb-3 focus:outline-none focus:ring-2 focus:ring-tinta-suave"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />

          {loginError && (
            <p className="text-sm text-rosa font-semibold mb-3 text-center">{loginError}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loggingIn}
            className="w-full bg-tinta text-marfil px-4 py-3 rounded-full font-bold hover:bg-tinta-suave transition disabled:opacity-50"
          >
            {loggingIn ? 'Ingresando...' : 'Ingresar'}
          </button>

          <Link
            href="/"
            className="block text-center text-sm text-tinta-suave hover:text-tinta mt-5 transition"
          >
            ← Volver al sitio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-crema flex">
      {/* Sidebar: fijo a la pantalla — menú y cierre de sesión siempre visibles */}
      <aside className="w-60 bg-marfil border-r border-arena flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-5 border-b border-arena">
          <h1 className="font-display italic text-2xl text-tinta font-semibold">
            Vida de Colores
          </h1>
          <p className="text-[11px] tracking-[0.2em] uppercase text-rosa font-bold mt-1">
            Panel administrativo
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2.5 rounded-full font-semibold transition ${
                  active
                    ? 'bg-tinta text-marfil'
                    : 'text-tinta-suave hover:bg-rosa-palo/40 hover:text-tinta'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-arena">
          <Link
            href="/"
            className="block px-4 py-2 text-sm text-tinta-suave hover:bg-arena/50 rounded-full mb-1 transition"
          >
            🌐 Ver sitio público
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-rosa font-semibold hover:bg-rosa-palo/40 rounded-full transition"
          >
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior con la campana de notificaciones */}
        <div className="sticky top-0 z-30 flex justify-end px-6 py-2.5 bg-crema/80 backdrop-blur border-b border-arena/50">
          <NotificationBell />
        </div>
        <main className="p-6">{children}</main>
      </div>

      {/* Notificaciones elegantes */}
      <Toaster />
    </div>
  )
}
