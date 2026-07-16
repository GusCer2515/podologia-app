'use client'

// Campos reutilizables para formularios clínicos

const inputClass =
  'w-full px-3 py-2 border border-arena rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-tinta-suave transition'

const labelClass = 'block text-[11px] font-bold uppercase tracking-wide text-tinta-suave mb-1.5'

// Colores semánticos por opción (SI = requiere atención, NO = sano...)
const PILL_ON: Record<string, string> = {
  SI: 'bg-rosa text-marfil border-rosa',
  NO: 'bg-salvia text-marfil border-salvia',
  LEVE: 'bg-[#d9a441] text-white border-[#d9a441]',
  REGULAR: 'bg-[#c9764f] text-white border-[#c9764f]',
  AGUDO: 'bg-[#b0453c] text-white border-[#b0453c]',
  ESCASO: 'bg-[#c9764f] text-white border-[#c9764f]',
  FRECUENTE: 'bg-salvia text-marfil border-salvia',
}

// Selector tipo píldoras: un click marca, click de nuevo desmarca
export function PillSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(active ? '' : o)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                active
                  ? PILL_ON[o] ?? 'bg-tinta text-marfil border-tinta'
                  : 'bg-white text-foreground/50 border-arena hover:border-tinta-suave hover:text-tinta'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className={inputClass}
      />
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="col-span-full">
      <label className={labelClass}>{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={inputClass}
      />
    </div>
  )
}

export function FormSection({
  title,
  icon,
  children,
}: {
  title: string
  icon?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-marfil rounded-2xl border border-arena shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        {icon && (
          <span className="w-9 h-9 rounded-xl bg-rosa-palo/70 flex items-center justify-center text-lg shrink-0">
            {icon}
          </span>
        )}
        <h3 className="font-display text-xl text-tinta font-semibold">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">
        {children}
      </div>
    </div>
  )
}
