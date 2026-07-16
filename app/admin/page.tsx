'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase, signIn, signOut, getSession } from '@/lib/supabase'

export default function AdminPage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Al cargar, verificar si ya hay sesión activa
  useEffect(() => {
    getSession().then((session) => {
      setIsAuthenticated(!!session)
      setCheckingSession(false)
    })
  }, [])

  // Login con Supabase Auth (seguro, sin contraseñas en el código)
  const handleLogin = async () => {
    if (!email || !password) {
      alert('Ingresa email y contraseña')
      return
    }
    setLoggingIn(true)
    try {
      await signIn(email, password)
      setIsAuthenticated(true)
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
    setIsAuthenticated(false)
  }

  // Cargar citas
  useEffect(() => {
    if (isAuthenticated) {
      loadAppointments()
    }
  }, [isAuthenticated])

  const loadAppointments = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(name, email, phone, insurance)')
        .order('appointment_date', { ascending: true })

      if (error) throw error
      setAppointments(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Verificando sesión al cargar
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  // Si no está autenticado, mostrar login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-3xl font-bold text-blue-900 mb-6 text-center">
            🔐 Admin
          </h1>
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

  // Panel Admin
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-blue-900">
            📊 Panel Administrativo
          </h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Contenido */}
      <section className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600">Citas Hoy</p>
            <p className="text-3xl font-bold text-blue-600">
              {appointments.filter(a => 
                new Date(a.appointment_date).toDateString() === new Date().toDateString()
              ).length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600">Total de Citas</p>
            <p className="text-3xl font-bold text-green-600">{appointments.length}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600">Citas Completadas</p>
            <p className="text-3xl font-bold text-purple-600">
              {appointments.filter(a => a.status === 'completed').length}
            </p>
          </div>
        </div>

        {/* Tabla de Citas */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold">Citas Agendadas</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center">Cargando...</div>
          ) : appointments.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              No hay citas agendadas
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Paciente</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Fecha/Hora</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Teléfono</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Convenio</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{apt.patients?.name}</td>
                      <td className="px-6 py-4 text-sm">
                        {new Date(apt.appointment_date).toLocaleString('es-CL')}
                      </td>
                      <td className="px-6 py-4 text-sm">{apt.patients?.phone}</td>
                      <td className="px-6 py-4 text-sm">{apt.patients?.insurance}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          apt.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          apt.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {apt.status === 'scheduled' ? 'Agendada' :
                           apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-bold">
            📅 Configurar Horarios
          </button>
          <button className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition font-bold">
            🚫 Bloquear Días
          </button>
          <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-bold">
            📄 Generar Boletas
          </button>
        </div>
      </section>
    </div>
  )
}
