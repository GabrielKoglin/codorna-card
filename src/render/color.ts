/** Utilitários de cor (hex #rrggbb). */

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

export function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`cor inválida: ${hex}`)
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

export function toHex([r, g, b]: readonly [number, number, number]): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`
}

/** Mistura duas cores: amount 0 = a, 1 = b. */
export function mix(a: string, b: string, amount: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  return toHex([
    ca[0] + (cb[0] - ca[0]) * amount,
    ca[1] + (cb[1] - ca[1]) * amount,
    ca[2] + (cb[2] - ca[2]) * amount,
  ])
}

export const darken = (color: string, amount: number): string => mix(color, '#000000', amount)
export const lighten = (color: string, amount: number): string => mix(color, '#ffffff', amount)

function channel(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** Luminância relativa (WCAG 2.x). */
export function luminance(color: string): number {
  const [r, g, b] = parseHex(color)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Razão de contraste (WCAG 2.x), de 1 a 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Escurece (ou clareia) a cor até atingir o contraste mínimo com o fundo.
 * Usado para que a cor da classe também sirva como cor de texto nos dois temas.
 */
export function ensureContrast(color: string, background: string, minimum: number): string {
  if (contrast(color, background) >= minimum) return color
  const target = luminance(background) > 0.5 ? '#000000' : '#ffffff'
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(color, target, step / 20)
    if (contrast(candidate, background) >= minimum) return candidate
  }
  return target
}
