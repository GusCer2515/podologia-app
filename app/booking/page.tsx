'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { bookAppointment, findPatientByRut } from '@/lib/supabase'
import { getPublicAvailableSlots } from '@/lib/slots'
import { CLINIC, getClinicInfo, type ClinicInfo } from '@/lib/clinicConfig'
import { waLinkClinica } from '@/lib/phone'

type ModalState =
  | { type: 'success'; date: string; time: string; name: string }
  | { type: 'error'; message: string }
  | null

export default function BookingPage() {
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slots, setSlots] = useState<string[]>([])
  const [dayMessage, setDayMessage] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [clinic, setClinic] = useState<ClinicInfo>(CLINIC)

  // Paso 1 = ingresar RUT · Paso 2 = datos + fecha/hora
  const [step, setStep] = useState<1 | 2>(1)
  const [checkingRut, setCheckingRut] = useState(false)
  const [recognized, setRecognized] = useState<string | null>(null) // nombre si es paciente conocido

  useEffect(() => {
    getClinicInfo().then(setClinic).catch(() => {})
  }, [])

  // Si llega desde el aviso de horas liberadas (?fecha=&hora=), se
  // precarga esa hora. Se lee de la URL directamente para que la página
  // siga siendo estática (useSearchParams obligaría a un Suspense).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const fecha = p.get('fecha')
    const hora = p.get('hora')
    if (!fecha) return
    setFormData((prev) => ({ ...prev, date: fecha, time: hora ?? '' }))
    loadSlots(fecha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    rut: '',
    date: '',
    time: '',
    notes: '',
  })

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (e: any) => {
    const date = e.target.value
    setFormData((prev) => ({ ...prev, date, time: '' }))
    loadSlots(date)
  }

  const loadSlots = async (date: string) => {
    setSlots([])
    setDayMessage('')
    if (!date) return
    setLoadingSlots(true)
    try {
      // Horas fijas de atención, filtradas por disponibilidad real del día
      const res = await getPublicAvailableSlots(date)
      setSlots(res.slots)
      setDayMessage(res.message)
    } catch (error) {
      console.error(error)
      setDayMessage('Error cargando horarios. Intenta nuevamente.')
    } finally {
      setLoadingSlots(false)
    }
  }

  // Paso 1: verificar RUT → si es paciente conocido, saludarlo y saltar datos
  const checkRut = async () => {
    const rut = formData.rut.trim()
    if (rut.replace(/[^0-9kK]/g, '').length < 7) {
      setModal({ type: 'error', message: 'Ingresa un RUT válido (ej: 12345678-9).' })
      return
    }
    setCheckingRut(true)
    try {
      const res = await findPatientByRut(rut)
      setRecognized(res.found ? res.name ?? null : null)
      if (res.found && res.name) {
        setFormData((prev) => ({ ...prev, name: res.name! }))
      }
      setStep(2)
    } catch (error) {
      console.error(error)
      // Si falla la verificación, continuar como paciente nuevo
      setRecognized(null)
      setStep(2)
    } finally {
      setCheckingRut(false)
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!formData.time) {
      setModal({ type: 'error', message: 'Selecciona una hora disponible antes de continuar.' })
      return
    }
    setLoading(true)
    try {
      const result = await bookAppointment({
        name: formData.name,
        // Paciente conocido: usamos placeholder; el sistema reconoce por RUT
        email: recognized ? formData.email || 'recurrente@vidadecolores.cl' : formData.email,
        phone: formData.phone,
        rut: formData.rut,
        datetime: `${formData.date}T${formData.time}:00`,
        notes: formData.notes,
        duration: 60,
      })

      if (result.success) {
        // Correos automáticos (el servidor recupera el email real por el id de cita)
        fetch('/api/notify-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: result.appointment_id,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            date: formData.date,
            time: formData.time,
          }),
        }).catch(() => {})

        setModal({ type: 'success', date: formData.date, time: formData.time, name: formData.name })
        setFormData({ name: '', email: '', phone: '', rut: '', date: '', time: '', notes: '' })
        setSlots([])
        setStep(1)
        setRecognized(null)
      } else {
        setModal({ type: 'error', message: result.error || 'No se pudo agendar la hora.' })
        loadSlots(formData.date)
        setFormData((prev) => ({ ...prev, time: '' }))
      }
    } catch (error) {
      setModal({ type: 'error', message: 'Ocurrió un problema de conexión. Intenta nuevamente.' })
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fmtFecha = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })

  const waRespaldo = (m: { date: string; time: string; name: string }) => {
    const msg =
      `Hola 👋 Soy ${m.name}.\n` +
      `Confirmo mi hora agendada en ${clinic.brand} para el ${fmtFecha(m.date)} a las ${m.time} hrs. ✅`
    return waLinkClinica(clinic.phone, msg)
  }

  const inputClass =
    'w-full px-4 py-2.5 border border-arena rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave'

  return (
    <div className="min-h-screen bg-crema relative overflow-hidden">
      {/* Fondos decorativos */}
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-rosa-palo/50 blur-3xl pointer-events-none" />
      <div className="absolute top-10 -right-10 w-72 h-72 rounded-full bg-salvia/15 blur-3xl pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 opacity-15 animate-float pointer-events-none">
        <Image src="/pdf-assets/flores-pie.png" alt="" width={1500} height={300} className="w-full h-auto" />
      </div>

      {/* Navbar */}
      <header className="relative z-10 max-w-2xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="text-sm font-bold text-tinta bg-marfil border border-arena rounded-full px-4 py-2 hover:border-tinta-suave transition">
          ← Volver al inicio
        </Link>
        <Link href="/" className="hidden sm:block font-display italic text-2xl text-tinta font-semibold">
          Vida de Colores
        </Link>
      </header>

      <div className="relative z-10 max-w-md mx-auto px-5 pt-6 pb-16">
        <div className="text-center mb-6">
          <p className="text-xs tracking-[0.3em] uppercase text-rosa font-bold">Podología clínica</p>
          <h1 className="font-display text-4xl text-tinta font-medium mt-2">
            Agenda <span className="italic">tu hora</span>
          </h1>
        </div>

        <div className="bg-marfil/95 backdrop-blur rounded-3xl shadow-xl shadow-tinta/10 border border-arena p-7 animate-fade-up">
          {step === 1 ? (
            /* ===== Paso 1: RUT ===== */
            <div>
              <p className="text-sm text-foreground/75 mb-4 leading-relaxed">
                Ingresa tu RUT para comenzar. Si ya te has atendido con nosotros, te
                reconoceremos y será aún más rápido 🌸
              </p>
              <label className="block text-sm font-semibold text-tinta mb-1">Tu RUT</label>
              <input
                type="text"
                name="rut"
                value={formData.rut}
                onChange={handleChange}
                onKeyDown={(e) => e.key === 'Enter' && checkRut()}
                placeholder="12345678-9"
                autoComplete="off"
                className={inputClass}
              />
              <button
                onClick={checkRut}
                disabled={checkingRut}
                className="mt-5 w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition shadow-lg shadow-rosa/25 disabled:opacity-50"
              >
                {checkingRut ? 'Verificando...' : 'Continuar →'}
              </button>
            </div>
          ) : (
            /* ===== Paso 2: datos + fecha/hora ===== */
            <form onSubmit={handleSubmit} className="space-y-4">
              {recognized ? (
                <div className="bg-salvia/10 border border-salvia/40 rounded-2xl p-4 text-center">
                  <p className="text-2xl">🌸</p>
                  <p className="font-display text-xl text-tinta font-semibold mt-1">
                    ¡Hola, {recognized.split(' ')[0]}!
                  </p>
                  <p className="text-sm text-foreground/70">
                    Te reconocimos. Solo elige el día y la hora que prefieras.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-foreground/70">
                    Es tu primera vez 👋 Cuéntanos tus datos para tu ficha.
                  </p>
                  <input type="text" name="name" placeholder="Nombre completo" value={formData.name} onChange={handleChange} required className={inputClass} />
                  <input type="email" name="email" placeholder="Email (ej: nombre@gmail.com)" value={formData.email} onChange={handleChange} required className={inputClass} />
                  <div>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Ej: +56 9 1234 5678"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-400 mt-1">📱 Tu WhatsApp, así podemos contactarte por tu hora.</p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-tinta mb-1">Fecha de la cita</label>
                <input type="date" name="date" value={formData.date} onChange={handleDateChange} min={todayStr} required className={inputClass} />
              </div>

              {formData.date && (
                <div>
                  <label className="block text-sm font-semibold text-tinta mb-2">Horas disponibles</label>
                  {loadingSlots ? (
                    <p className="text-gray-500 text-sm">Buscando horas disponibles...</p>
                  ) : dayMessage ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                      <p className="text-sm text-orange-700">{dayMessage}</p>
                      <a
                        href={waLinkClinica(
                          clinic.phone,
                          `Hola 👋 Quiero consultar por un posible sobrecupo para el ${
                            formData.date ? fmtFecha(formData.date) : 'día que tengo en mente'
                          }. ¿Tendrían alguna hora disponible?`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block w-full text-center bg-salvia text-marfil py-2.5 rounded-full text-sm font-bold hover:opacity-90 transition"
                      >
                        💬 Consultar por un sobrecupo
                      </a>
                      <p className="text-[11px] text-orange-700/70 mt-2 text-center">
                        Escríbenos por WhatsApp y vemos si podemos hacerte un espacio.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, time }))}
                          className={`px-2 py-2 rounded-lg text-sm font-semibold border transition ${
                            formData.time === time
                              ? 'bg-tinta text-marfil border-tinta'
                              : 'bg-white text-foreground border-arena hover:border-tinta-suave hover:bg-rosa-palo/40'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <textarea name="notes" placeholder="¿Algún motivo o consulta? (opcional)" value={formData.notes} onChange={handleChange} className={inputClass} rows={2} />

              <button type="submit" disabled={loading || !formData.time} className="w-full bg-rosa text-marfil py-3 rounded-full font-bold hover:opacity-90 transition shadow-lg shadow-rosa/25 disabled:opacity-50 disabled:shadow-none">
                {loading ? 'Agendando...' : formData.time ? `Agendar a las ${formData.time}` : 'Selecciona fecha y hora'}
              </button>
              <button type="button" onClick={() => { setStep(1); setRecognized(null) }} className="w-full text-sm text-tinta-suave hover:text-tinta transition">
                ← Cambiar RUT
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Modal confirmación / error */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 backdrop-blur-sm p-4">
          <div className="bg-marfil rounded-3xl shadow-2xl border border-arena max-w-sm w-full p-8 text-center animate-fade-up">
            {modal.type === 'success' ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-rosa-palo flex items-center justify-center text-3xl">🌸</div>
                <h2 className="font-display text-3xl text-tinta font-medium mt-4">¡Tu hora está <span className="italic">reservada!</span></h2>
                <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
                  Te esperamos el <strong className="text-tinta">{fmtFecha(modal.date)}</strong><br />a las <strong className="text-tinta">{modal.time} hrs</strong>.
                </p>
                <p className="mt-3 text-xs text-foreground/60 bg-arena/50 rounded-xl px-4 py-2">📧 Te enviamos la confirmación a tu correo.</p>
                <a href={waRespaldo(modal)} target="_blank" rel="noopener noreferrer" className="mt-4 block w-full bg-salvia text-marfil py-3 rounded-full font-bold hover:opacity-90 transition">💬 Enviar confirmación a la clínica</a>
                <p className="text-[11px] text-gray-400 mt-1.5">Abre WhatsApp con un mensaje listo para {clinic.brand}.</p>
                <button onClick={() => setModal(null)} className="mt-3 w-full py-3 rounded-full font-bold text-tinta border-2 border-tinta/15 hover:border-tinta/40 transition">Cerrar</button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-arena flex items-center justify-center text-3xl">🕐</div>
                <h2 className="font-display text-3xl text-tinta font-medium mt-4">No pudimos <span className="italic">agendar</span></h2>
                <p className="mt-3 text-sm text-foreground/75 leading-relaxed">{modal.message}</p>
                <button onClick={() => setModal(null)} className="mt-6 w-full bg-tinta text-marfil py-3 rounded-full font-bold hover:bg-tinta-suave transition">Entendido</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
