import Image from 'next/image'
import Link from 'next/link'
import { CLINIC } from '@/lib/clinicConfig'
import CasosCarousel from '@/components/CasosCarousel'
import ContactButtons from '@/components/ContactButtons'
import Testimonios from '@/components/Testimonios'
import HorasLiberadas from '@/components/HorasLiberadas'

const SERVICIOS = [
  {
    icon: '🦶',
    title: 'Limpieza podológica general',
    desc: 'Higiene profunda, corte y limpieza de laterales ungueales para pies sanos.',
  },
  {
    icon: '✂️',
    title: 'Onicotomía y desbastado',
    desc: 'Corte técnico y reducción del grosor de uñas engrosadas o difíciles.',
  },
  {
    icon: '🔬',
    title: 'Tratamiento de onicomicosis',
    desc: 'Evaluación y tratamiento de hongos en las uñas con seguimiento clínico.',
  },
  {
    icon: '🌡️',
    title: 'Uñas encarnadas e involutas',
    desc: 'Alivio del dolor y corrección profesional de uñas incarnadas.',
  },
  {
    icon: '💙',
    title: 'Cuidado del pie diabético',
    desc: 'Atención especializada y preventiva para pacientes con diabetes.',
  },
  {
    icon: '🦶',
    title: 'Grietas y talones',
    desc: 'Tratamiento de hiperqueratosis y grietas para talones sanos.',
  },
]

const PASOS = [
  {
    num: '01',
    title: 'Elige tu hora',
    desc: 'Revisa la disponibilidad real en línea y reserva el horario que te acomode.',
  },
  {
    num: '02',
    title: 'Confirma tus datos',
    desc: 'Déjanos tu nombre y contacto. Tu hora queda reservada al instante.',
  },
  {
    num: '03',
    title: 'Te esperamos',
    desc: 'Llega a tu consulta y déjate cuidar. Recibirás tus indicaciones por WhatsApp.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-crema text-foreground">
      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 bg-crema/90 backdrop-blur border-b border-arena">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display italic text-2xl text-tinta font-semibold">
              Vida de Colores
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-tinta-suave">
            <a href="#servicios" className="hover:text-tinta transition">Servicios</a>
            <a href="#como-funciona" className="hover:text-tinta transition">Cómo funciona</a>
            <Link href="/blog" className="hover:text-tinta transition">Consejos</Link>
            <a href="#contacto" className="hover:text-tinta transition">Contacto</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm font-semibold text-tinta-suave hover:text-tinta transition"
            >
              🔐 Ingresar
            </Link>
            <Link
              href="/booking"
              className="bg-tinta text-marfil px-5 py-2 rounded-full text-sm font-bold hover:bg-tinta-suave transition"
            >
              Agendar hora
            </Link>
          </div>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="animate-fade-up text-xs tracking-[0.3em] uppercase text-rosa font-bold mb-5">
              Podología clínica
            </p>
            <h1 className="animate-fade-up fade-delay-1 font-display text-5xl md:text-6xl leading-[1.05] text-tinta font-medium">
              Tus pies,
              <br />
              <span className="italic">cuidados con arte</span>
            </h1>
            <p className="animate-fade-up fade-delay-2 mt-6 text-lg text-foreground/75 max-w-md leading-relaxed">
              Atención podológica profesional y personalizada. Agenda tu hora
              en línea y déjate cuidar por manos expertas.
            </p>

            <div className="animate-fade-up fade-delay-3 mt-9 flex flex-wrap gap-4">
              <Link
                href="/booking"
                className="bg-rosa text-marfil px-8 py-3.5 rounded-full font-bold hover:opacity-90 transition shadow-lg shadow-rosa/25"
              >
                Agendar mi hora →
              </Link>
              <a
                href="#servicios"
                className="px-8 py-3.5 rounded-full font-bold text-tinta border-2 border-tinta/20 hover:border-tinta/50 transition"
              >
                Ver servicios
              </a>
            </div>
          </div>

          {/* Logo destacado sobre fondo orgánico */}
          <div className="relative flex justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-80 h-80 md:w-96 md:h-96 rounded-full bg-rosa-palo/60 blur-2xl" />
            </div>
            <div className="relative bg-marfil rounded-[3rem] shadow-xl shadow-tinta/10 px-10 py-14 rotate-1 hover:rotate-0 transition-transform duration-500">
              <Image
                src="/pdf-assets/logo.png"
                alt="Vida de Colores — Podología Clínica y Nails Artist"
                width={380}
                height={190}
                priority
              />
              <p className="text-center text-xs tracking-[0.25em] uppercase text-tinta-suave mt-4">
                {CLINIC.subtitle}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HORAS LIBERADAS / DISPONIBLES (se oculta si no hay) ===== */}
      <HorasLiberadas />

      {/* ================= FRANJA DE CONFIANZA ================= */}
      <section className="bg-tinta text-marfil">
        <div className="max-w-6xl mx-auto px-5 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div>
            <p className="font-display text-2xl italic">Agenda online 24/7</p>
            <p className="text-sm text-marfil/70 mt-1">Reserva cuando quieras, sin llamadas</p>
          </div>
          <div>
            <p className="font-display text-2xl italic">Atención personalizada</p>
            <p className="text-sm text-marfil/70 mt-1">Cada paciente con su ficha clínica</p>
          </div>
          <div>
            <p className="font-display text-2xl italic">Recetas digitales</p>
            <p className="text-sm text-marfil/70 mt-1">Tus indicaciones llegan por WhatsApp</p>
          </div>
        </div>
      </section>

      {/* ================= SERVICIOS ================= */}
      <section id="servicios" className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <p className="text-xs tracking-[0.3em] uppercase text-rosa font-bold text-center">
          Nuestros servicios
        </p>
        <h2 className="font-display text-4xl md:text-5xl text-tinta text-center mt-3 font-medium">
          Cuidado integral <span className="italic">para tus pies</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
          {SERVICIOS.map((s) => (
            <div
              key={s.title}
              className="bg-marfil rounded-3xl p-7 border border-arena shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-2xl bg-rosa-palo flex items-center justify-center text-2xl mb-5">
                {s.icon}
              </div>
              <h3 className="font-display text-2xl text-tinta font-semibold">{s.title}</h3>
              <p className="text-sm text-foreground/70 mt-2 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CASOS REALES (carrusel) ================= */}
      <CasosCarousel />

      {/* ================= CÓMO FUNCIONA ================= */}
      <section id="como-funciona" className="bg-arena/50">
        <div className="max-w-6xl mx-auto px-5 py-20 md:py-24">
          <p className="text-xs tracking-[0.3em] uppercase text-rosa font-bold text-center">
            Cómo funciona
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-tinta text-center mt-3 font-medium">
            Agendar es <span className="italic">así de simple</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-14">
            {PASOS.map((p) => (
              <div key={p.num} className="text-center md:text-left">
                <p className="font-display text-6xl text-rosa/40 font-semibold">{p.num}</p>
                <h3 className="font-display text-2xl text-tinta font-semibold mt-2">{p.title}</h3>
                <p className="text-sm text-foreground/70 mt-2 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <Link
              href="/booking"
              className="inline-block bg-tinta text-marfil px-10 py-4 rounded-full font-bold hover:bg-tinta-suave transition shadow-lg shadow-tinta/20"
            >
              Reservar mi hora ahora
            </Link>
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIOS ================= */}
      <Testimonios />

      {/* ================= CONTACTO / FOOTER ================= */}
      <footer id="contacto" className="relative bg-crema pt-16">
        <div className="max-w-6xl mx-auto px-5 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-tinta font-medium">
            <span className="italic">Conversemos</span>
          </h2>
          <p className="mt-3 text-foreground/70">¿Dudas o consultas? Escríbenos directamente.</p>

          <ContactButtons />

          {/* Flores de la marca */}
          <div className="mt-12 relative">
            <Image
              src="/pdf-assets/flores-pie.png"
              alt=""
              width={1500}
              height={300}
              className="w-full h-auto opacity-90"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-display italic text-xl text-tinta">{CLINIC.professional}</p>
              <p className="text-xs text-foreground/60">Podóloga Clínica</p>
            </div>
          </div>
        </div>

        <div className="border-t border-arena mt-4">
          <div className="max-w-6xl mx-auto px-5 py-5 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/50">
            <p>© {new Date().getFullYear()} {CLINIC.brand}. Todos los derechos reservados.</p>
            <Link href="/admin" className="hover:text-tinta transition">
              Acceso administrador
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
