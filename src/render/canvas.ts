import { characters, glyph, glyphPath, LETTER_SPACING, measure, truncate } from './font'
import { parseBitmap, pixelPath } from './pixels'

export type Align = 'left' | 'center' | 'right'

export interface TextOptions {
  scale?: number
  fill: string
  align?: Align
  /** Largura máxima em px; o texto é cortado com reticências. */
  maxWidth?: number
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Monta um SVG de pixel art: retângulos, caminhos, bitmaps de papéis e texto na fonte do
 * projeto, com cada glifo usado definido uma vez só em `<defs>`. Usado pelo card, pelo logo e
 * pela prévia social.
 */
export class Canvas {
  private readonly glyphs = new Map<string, string>()
  private readonly parts: string[] = []

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  rect(x: number, y: number, w: number, h: number, fill: string): void {
    if (w <= 0 || h <= 0) return
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`)
  }

  path(d: string, fill: string): void {
    if (d) this.parts.push(`<path fill="${fill}" d="${d}"/>`)
  }

  /** Desenha um bitmap de papéis (um caractere por pixel) com uma cor por papel. */
  bitmap(
    rows: readonly string[],
    colors: Record<string, string>,
    x: number,
    y: number,
    scale: number,
  ): void {
    for (const [role, fill] of Object.entries(colors)) {
      this.path(pixelPath(parseBitmap(rows, role), scale, x, y), fill)
    }
  }

  /** Escreve texto na fonte de pixel. Devolve a largura em px. */
  text(content: string, x: number, y: number, options: TextOptions): number {
    const scale = options.scale ?? 2
    const value =
      options.maxWidth !== undefined
        ? truncate(content, Math.floor(options.maxWidth / scale))
        : content
    const width = measure(value) * scale
    const align = options.align ?? 'left'
    const left = Math.round(align === 'center' ? x - width / 2 : align === 'right' ? x - width : x)
    const uses: string[] = []
    let cursor = 0
    for (const char of characters(value)) {
      const g = glyph(char)
      if (g.pixels.length > 0) {
        if (!this.glyphs.has(g.id)) this.glyphs.set(g.id, glyphPath(g))
        uses.push(cursor === 0 ? `<use href="#${g.id}"/>` : `<use href="#${g.id}" x="${cursor}"/>`)
      }
      cursor += g.width + LETTER_SPACING
    }
    if (uses.length > 0) {
      this.parts.push(
        `<g fill="${options.fill}" transform="translate(${left} ${y}) scale(${scale})">${uses.join('')}</g>`,
      )
    }
    return width
  }

  /** Desenha dentro de um grupo deslocado para (x, y). */
  group(x: number, y: number, draw: () => void): void {
    this.parts.push(`<g transform="translate(${x} ${y})">`)
    draw()
    this.parts.push('</g>')
  }

  toString(title: string, desc: string): string {
    const defs = [...this.glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('')
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" role="img" aria-labelledby="gc-title gc-desc" shape-rendering="crispEdges">`,
      `<title id="gc-title">${escapeXml(title)}</title>`,
      `<desc id="gc-desc">${escapeXml(desc)}</desc>`,
      `<defs>${defs}</defs>`,
      ...this.parts,
      '</svg>',
      '',
    ].join('\n')
  }
}
