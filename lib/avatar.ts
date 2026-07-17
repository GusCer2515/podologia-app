// Avatar con iniciales y color estable según el nombre del paciente

const AVATAR_COLORS = ['bg-tinta', 'bg-rosa', 'bg-salvia', 'bg-[#d9a441]', 'bg-tinta-suave']

export const initials = (name?: string) =>
  String(name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export const colorFor = (name?: string) =>
  AVATAR_COLORS[
    (String(name ?? 'A').charCodeAt(0) + String(name ?? 'A').length) % AVATAR_COLORS.length
  ]
