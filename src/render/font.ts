import { parseBitmap, pixelPath } from './pixels'

/**
 * Fonte bitmap própria do Codorna Card (5×7, proporcional), desenhada à mão para este
 * projeto. Coordenadas: a linha 0 é o topo das maiúsculas, a linha base fica abaixo da
 * linha 6 e as descendentes ocupam as linhas 7 e 8. Acentos sobem até a linha −3.
 */

interface GlyphDef {
  /** Linha onde o desenho começa. */
  y?: number
  rows: string[]
  /** Largura para glifos sem pixels (espaço). */
  width?: number
}

const G: Record<string, GlyphDef> = {
  ' ': { rows: [], width: 3 },
  A: { rows: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'] },
  B: { rows: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'] },
  C: { rows: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'] },
  D: { rows: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'] },
  E: { rows: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'] },
  F: { rows: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'] },
  G: { rows: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'] },
  H: { rows: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'] },
  I: { rows: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'] },
  J: { rows: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'] },
  K: { rows: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'] },
  L: { rows: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'] },
  M: { rows: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'] },
  N: { rows: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'] },
  O: { rows: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'] },
  P: { rows: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'] },
  Q: { rows: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'] },
  R: { rows: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'] },
  S: { rows: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'] },
  T: { rows: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'] },
  U: { rows: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'] },
  V: { rows: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'] },
  W: { rows: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'] },
  X: { rows: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'] },
  Y: { rows: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'] },
  Z: { rows: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'] },
  a: { y: 2, rows: ['.###.', '....#', '.####', '#...#', '.####'] },
  b: { rows: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'] },
  c: { y: 2, rows: ['.####', '#....', '#....', '#....', '.####'] },
  d: { rows: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'] },
  e: { y: 2, rows: ['.###.', '#...#', '#####', '#....', '.####'] },
  f: { rows: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'] },
  g: { y: 2, rows: ['.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'] },
  h: { rows: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'] },
  i: { rows: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'] },
  ı: { y: 2, rows: ['##.', '.#.', '.#.', '.#.', '###'] },
  j: { rows: ['...#', '....', '..##', '...#', '...#', '...#', '...#', '#..#', '.##.'] },
  k: { rows: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'] },
  l: { rows: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'] },
  m: { y: 2, rows: ['##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'] },
  n: { y: 2, rows: ['####.', '#...#', '#...#', '#...#', '#...#'] },
  o: { y: 2, rows: ['.###.', '#...#', '#...#', '#...#', '.###.'] },
  p: { y: 2, rows: ['####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'] },
  q: { y: 2, rows: ['.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'] },
  r: { y: 2, rows: ['#.##', '##..', '#...', '#...', '#...'] },
  s: { y: 2, rows: ['.####', '#....', '.###.', '....#', '####.'] },
  t: { rows: ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'] },
  u: { y: 2, rows: ['#...#', '#...#', '#...#', '#...#', '.####'] },
  v: { y: 2, rows: ['#...#', '#...#', '#...#', '.#.#.', '..#..'] },
  w: { y: 2, rows: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'] },
  x: { y: 2, rows: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] },
  y: { y: 2, rows: ['#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'] },
  z: { y: 2, rows: ['#####', '...#.', '..#..', '.#...', '#####'] },
  '0': { rows: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'] },
  '1': { rows: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'] },
  '2': { rows: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'] },
  '3': { rows: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'] },
  '4': { rows: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'] },
  '5': { rows: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'] },
  '6': { rows: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'] },
  '7': { rows: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'] },
  '8': { rows: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'] },
  '9': { rows: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'] },
  '.': { y: 6, rows: ['#'] },
  ',': { y: 6, rows: ['.#', '#.'] },
  ':': { y: 2, rows: ['#', '.', '.', '.', '#'] },
  ';': { y: 2, rows: ['.#', '..', '..', '.#', '#.'] },
  '-': { y: 3, rows: ['###'] },
  _: { y: 6, rows: ['#####'] },
  '+': { y: 1, rows: ['..#..', '..#..', '#####', '..#..', '..#..'] },
  '=': { y: 2, rows: ['#####', '.....', '#####'] },
  '#': { rows: ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'] },
  '/': { rows: ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'] },
  '%': { rows: ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'] },
  '<': { rows: ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'] },
  '>': { rows: ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'] },
  "'": { rows: ['#', '#'] },
  '"': { rows: ['#.#', '#.#'] },
  '!': { rows: ['#', '#', '#', '#', '#', '.', '#'] },
  '?': { rows: ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'] },
  '(': { rows: ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'] },
  ')': { rows: ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'] },
  '[': { rows: ['###', '#..', '#..', '#..', '#..', '#..', '###'] },
  ']': { rows: ['###', '..#', '..#', '..#', '..#', '..#', '###'] },
  '|': { rows: ['#', '#', '#', '#', '#', '#', '#'] },
  '*': { y: 1, rows: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'] },
  '&': { rows: ['.##..', '#..#.', '.##..', '.#...', '#.#.#', '#..#.', '.##.#'] },
  '@': { rows: ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.####'] },
  '·': { y: 3, rows: ['#'] },
  '…': { y: 6, rows: ['#.#.#'] },
}

/** Diacríticos combinantes (NFD). `below` desenha embaixo da letra. */
const MARKS: Record<string, { rows: string[]; below?: boolean }> = {
  '̀': { rows: ['#.', '.#'] },
  '́': { rows: ['.#', '#.'] },
  '̂': { rows: ['.#.', '#.#'] },
  '̃': { rows: ['.#.#', '#.#.'] },
  '̈': { rows: ['#.#'] },
  '̊': { rows: ['.#.', '#.#', '.#.'] },
  '̧': { rows: ['.#.', '##.'], below: true },
}

export const LETTER_SPACING = 1
export const FALLBACK = '?'

export interface Glyph {
  /** Identificador estável para o `<defs>` do SVG. */
  id: string
  width: number
  pixels: [number, number][]
}

const cache = new Map<string, Glyph>()

function glyphId(char: string): string {
  return `g${[...char].map((c) => (c.codePointAt(0) ?? 63).toString(16)).join('-')}`
}

function baseGlyph(char: string): Glyph | null {
  const def = G[char]
  if (!def) return null
  const pixels = parseBitmap(def.rows).map(([x, y]): [number, number] => [x, y + (def.y ?? 0)])
  return { id: glyphId(char), width: def.width ?? def.rows[0]?.length ?? 0, pixels }
}

function composedGlyph(char: string): Glyph | null {
  const [base, ...marks] = [...char.normalize('NFD')]
  if (!base || marks.length === 0 || !marks.every((mark) => MARKS[mark])) return null
  const baseDef = G[base === 'i' ? 'ı' : base]
  if (!baseDef) return null
  const pixels = parseBitmap(baseDef.rows).map(([x, y]): [number, number] => [
    x,
    y + (baseDef.y ?? 0),
  ])
  const width = baseDef.rows[0]?.length ?? 0
  const top = baseDef.y ?? 0
  const bottom = top + baseDef.rows.length
  let above = top - 1
  for (const mark of marks) {
    const markDef = MARKS[mark]
    if (!markDef) return null
    const markWidth = markDef.rows[0]?.length ?? 0
    const offsetX = Math.floor((width - markWidth) / 2)
    const offsetY = markDef.below ? bottom : above - markDef.rows.length
    for (const [x, y] of parseBitmap(markDef.rows)) pixels.push([x + offsetX, y + offsetY])
    if (!markDef.below) above -= markDef.rows.length + 1
  }
  return { id: glyphId(char), width, pixels }
}

/** Glifo de um caractere (com acentos compostos e "?" quando não há desenho). */
export function glyph(char: string): Glyph {
  const cached = cache.get(char)
  if (cached) return cached
  const found = baseGlyph(char) ?? composedGlyph(char) ?? baseGlyph(FALLBACK)
  if (!found) throw new Error('fonte sem glifo de fallback')
  cache.set(char, found)
  return found
}

/** Divide o texto em caracteres visíveis (pares acentuados viram um caractere só). */
export function characters(text: string): string[] {
  return [...text.normalize('NFC')].filter((char) => char !== '\n' && char !== '\r')
}

/** Largura do texto em pixels da fonte (sem escala). */
export function measure(text: string): number {
  const chars = characters(text)
  if (chars.length === 0) return 0
  return (
    chars.reduce((sum, char) => sum + glyph(char).width, 0) + LETTER_SPACING * (chars.length - 1)
  )
}

/** Corta o texto com reticências até caber na largura (em pixels da fonte). */
export function truncate(text: string, maxWidth: number): string {
  if (measure(text) <= maxWidth) return text
  const chars = characters(text)
  while (chars.length > 0 && measure(`${chars.join('')}…`) > maxWidth) chars.pop()
  return chars.length > 0 ? `${chars.join('').trimEnd()}…` : ''
}

/** Caminho do glifo em coordenadas da fonte (1 unidade = 1 pixel). */
export function glyphPath(g: Glyph): string {
  return pixelPath(g.pixels)
}
