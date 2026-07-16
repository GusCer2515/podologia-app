'use client'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-blue-900">
            🦶 Centro Podológico
          </h1>
          <p className="text-gray-600 mt-2">Tu bienestar, nuestro cuidado</p>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="bg-blue-600 text-white rounded-lg p-12 text-center">
          <h2 className="text-4xl font-bold mb-4">Cuidado Podológico Profesional</h2>
          <p className="text-lg mb-8">
            Especialistas en el cuidado de tus pies con tecnología moderna
          </p>
          <div className="space-x-4">
            <a href="/booking" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 inline-block">
              Agendar Hora Ahora
            </a>
            <a href="/admin" className="bg-blue-800 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-900 inline-block">
              Panel Admin
            </a>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <h3 className="text-3xl font-bold text-center mb-12">Nuestros Servicios</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'Limpieza General', icon: '✨' },
            { title: 'Tratamiento de Hongos', icon: '🔬' },
            { title: 'Cuidado de Uñas', icon: '💅' }
          ].map((service, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow text-center">
              <div className="text-5xl mb-4">{service.icon}</div>
              <h4 className="text-xl font-bold">{service.title}</h4>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>📞 +56 9 8765 4321 | 📧 contacto@podologia.cl</p>
          <p className="text-gray-400 mt-2">© 2026 Centro Podológico. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
