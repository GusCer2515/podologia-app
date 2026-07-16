'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signIn, signOut, getSession } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/admin', label: '📅 Agenda' },
  { href: '/admin/patients', label: '👥 Pacientes' },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    getSession().then((session) => {
      setAuthed(!!session)
      setChecking(false)
    })
  }, [])

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Ingresa email y contraseña')
      return
    }
    setLoggingIn(true)
    try {
      await signIn(email, password)
      setAuthed(true)
      setEmail('')
      setPassword('')
    } catch {
      alert('Email o contraseña incorrectos')
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
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-3xl font-bold text-blue-900 mb-2 text-center">🔐 Admin</h1>
          <p className="text-gray-600 text-center mb-6">
            Acceso restringido solo para administrador
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />

          <button
            onClick={handleLogin}
            disabled={loggingIn}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loggingIn ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white shadow-lg flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-900">🦶 Vida de Colores</h1>
          <p className="text-xs text-gray-500 mt-1">Panel Administrativo</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2.5 rounded-lg font-medium transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <Link
            href="/"
            className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg mb-1"
          >
            🌐 Ver sitio público
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-6 overflow-x-auto">{children}</main>
    </div>
  )
}
