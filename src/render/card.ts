import { ATTRIBUTES } from '../game/attributes'
import type { Character } from '../game/character'
import { classDef } from '../game/classes'
import { seededRandom } from '../hash'
import { formatNumber, strings } from '../i18n'
import type { Lang, ThemeName } from '../types'
import { darken, ensureContrast, lighten, mix } from './color'
import { characters, glyph, glyphPath, LETTER_SPACING, measure, truncate } from './font'
import { EMBLEMS, EMBLEM_SIZE } from './icons'
import { parseBitmap, pixelPath } from './pixels'
import { buildSprite } from './sprite'
import { RANK_METALS, THEMES } from './theme'

export const CARD_WIDTH = 640
export const CARD_HEIGHT = 360

export interface RenderOptions {
  theme: ThemeName
  lang: Lang
}

type Align = 'left' | 'center' | 'right'

interface TextOptions {
  scale?: number
  fill: string
  align?: Align
  /** Largura máxima em px; o texto é cortado com reticências. */
  maxWidth?: number
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Monta o SVG com a fonte em `<defs>` (cada glifo usado entra uma vez só). */
class Canvas {
  private readonly glyphs = new Map<string, string>()
  private readonly parts: string[] = []

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

  toString(title: string, desc: string): string {
    const defs = [...this.glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('')
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-labelledby="gc-title gc-desc" shape-rendering="crispEdges">`,
      `<title id="gc-title">${escapeXml(title)}</title>`,
      `<desc id="gc-desc">${escapeXml(desc)}</desc>`,
      `<defs>${defs}</defs>`,
      ...this.parts,
      '</svg>',
      '',
    ].join('\n')
  }
}

/** Retângulo com cantos "arredondados" em degraus de pixel. */
function steppedRect(x: number, y: number, w: number, h: number, step: number): string {
  const s = step
  return (
    `M${x + 2 * s} ${y}h${w - 4 * s}v${s}h${s}v${s}h${s}v${h - 4 * s}h-${s}v${s}h-${s}v${s}` +
    `h-${w - 4 * s}v-${s}h-${s}v-${s}h-${s}v-${h - 4 * s}h${s}v-${s}h${s}z`
  )
}

const CORNER_GEM = ['..##..', '.#gg#.', '#gwgg#', '#gggg#', '.#gg#.', '..##..']

/** Um número do rodapé com o rótulo, ex.: ["1.612", "PRs mesclados"]. */
export type StatItem = [value: string, label: string]

/** Junta os itens do rodapé: "16.772 commits · 1.612 PRs mesclados". */
export function statText(items: readonly StatItem[]): string {
  return items.map(([value, label]) => `${value} ${label}`).join(' · ')
}

/** Largura do rodapé (px) e escala da fonte nele. */
const FOOTER_WIDTH = CARD_WIDTH - 56
const FOOTER_SCALE = 2

/**
 * Números do rodapé, do jeito mais completo que couber: rótulos longos; depois "PRs" no lugar de
 * "PRs mesclados"; depois números compactos (16,7k); em último caso, menos itens. Issues ficam
 * de fora (estão no resumo do job e na descrição acessível). As contribuições privadas só
 * aparecem quando existem, o que exige `private-contributions: true`.
 */
export function footerStats(character: Character, lang: Lang, maxWidth = FOOTER_WIDTH): StatItem[] {
  const t = strings(lang)
  const activity = character.activity
  const entries: [number, (n: number) => string, (n: number) => string][] = [
    [activity.commits.raw, t.card.stats.commits, t.card.stats.commits],
    [activity.merged.raw, t.card.stats.merged, t.card.stats.mergedShort],
    [activity.reviews.raw, t.card.stats.reviews, t.card.stats.reviews],
  ]
  const privateCount = activity.privateContributions.raw
  if (privateCount > 0) entries.push([privateCount, t.card.stats.private, t.card.stats.private])
  const fits = (items: StatItem[]) => measure(statText(items)) * FOOTER_SCALE <= maxWidth
  let items: StatItem[] = []
  for (const [short, compact] of [
    [false, false],
    [true, false],
    [true, true],
  ] as const) {
    items = entries.map(([count, long, shortLabel]) => [
      compact ? t.card.compact(count) : formatNumber(count, lang),
      (short ? shortLabel : long)(count),
    ])
    if (fits(items)) return items
  }
  while (items.length > 1 && !fits(items)) items = items.slice(0, -1)
  return items
}

/** Ajusta um tamanho para a grade de 2 px, para manter tudo nítido. */
function snap(value: number): number {
  return Math.round(value / 2) * 2
}

export function renderCard(character: Character, options: RenderOptions): string {
  const t = strings(options.lang)
  const theme = THEMES[options.theme]
  const metal = RANK_METALS[character.rank]
  const classColor = classDef(character.classId).color
  const accentText = ensureContrast(classColor, theme.background, 4.5)
  const rankText = ensureContrast(
    options.theme === 'dark' ? metal.light : metal.dark,
    theme.background,
    4.5,
  )
  const numberText = (value: number) => formatNumber(value, options.lang)
  const canvas = new Canvas()
  const W = CARD_WIDTH
  const H = CARD_HEIGHT

  // Moldura: contorno, faixa de metal com luz e sombra, contorno interno e fundo.
  canvas.path(steppedRect(0, 0, W, H, 2), theme.outline)
  canvas.path(steppedRect(2, 2, W - 4, H - 4, 2), metal.base)
  canvas.rect(8, 2, W - 16, 2, metal.light)
  canvas.rect(2, 8, 2, H - 16, metal.light)
  canvas.rect(8, H - 4, W - 16, 2, metal.dark)
  canvas.rect(W - 4, 8, 2, H - 16, metal.dark)
  canvas.rect(10, 10, W - 20, H - 20, theme.outline)
  canvas.rect(12, 12, W - 24, H - 24, theme.background)
  for (const [gx, gy] of [
    [0, 0],
    [W - 12, 0],
    [0, H - 12],
    [W - 12, H - 12],
  ] as const) {
    canvas.bitmap(CORNER_GEM, { '#': theme.outline, g: metal.base, w: metal.gem }, gx, gy, 2)
  }

  // Cabeçalho.
  canvas.rect(12, 12, W - 24, 34, theme.panel)
  canvas.rect(12, 46, W - 24, 2, theme.panelEdge)
  canvas.bitmap(
    ['..#..', '.#g#.', '#gwg#', '.#g#.', '..#..'],
    { '#': theme.outline, g: metal.base, w: metal.gem },
    26,
    24,
    2,
  )
  canvas.text(t.card.header, 42, 22, { fill: rankText })
  canvas.text(`${t.card.since(character.memberSince)} · #${character.cardNumber}`, W - 28, 22, {
    fill: theme.muted,
    align: 'right',
  })

  // Retrato com o avatar.
  const portraitX = 28
  const portraitY = 60
  canvas.rect(portraitX, portraitY, 120, 120, theme.outline)
  canvas.rect(portraitX + 2, portraitY + 2, 116, 116, theme.panelEdge)
  const portraitBg = mix(theme.portrait, classColor, options.theme === 'dark' ? 0.16 : 0.14)
  canvas.rect(portraitX + 4, portraitY + 4, 112, 112, portraitBg)
  const sparkleRandom = seededRandom(character.hash, 11)
  const sparkles: [number, number][] = []
  for (let i = 0; i < 5; i++) {
    const left = sparkleRandom() < 0.5
    const sx = snap(portraitX + 8 + (left ? 0 : 76) + sparkleRandom() * 22)
    const sy = snap(portraitY + 8 + sparkleRandom() * 60)
    sparkles.push([sx, sy])
  }
  const sparkleColor = mix(portraitBg, lighten(classColor, 0.3), 0.55)
  canvas.path(
    sparkles.map(([sx, sy]) => `M${sx + 2} ${sy}h2v6h-2zM${sx} ${sy + 2}h6v2h-6z`).join(''),
    sparkleColor,
  )
  const spriteScale = 7
  const spriteX = portraitX + 4
  const spriteY = portraitY + 4
  canvas.rect(
    spriteX + 2 * spriteScale,
    spriteY + 15 * spriteScale,
    12 * spriteScale,
    spriteScale - 2,
    theme.floor,
  )
  const sprite = buildSprite(character.hash, character.classId, { outline: theme.outline })
  const byColor = new Map<string, [number, number][]>()
  sprite.pixels.forEach((row, y) =>
    row.forEach((color, x) => {
      if (!color) return
      const list = byColor.get(color) ?? []
      list.push([x, y])
      byColor.set(color, list)
    }),
  )
  for (const [color, pixels] of byColor)
    canvas.path(pixelPath(pixels, spriteScale, spriteX, spriteY), color)

  // Placa do nível.
  const plaqueY = 190
  canvas.rect(portraitX, plaqueY, 120, 66, theme.outline)
  canvas.rect(portraitX + 2, plaqueY + 2, 116, 62, theme.panel)
  canvas.rect(portraitX + 2, plaqueY + 2, 116, 2, metal.base)
  canvas.text(t.card.level, portraitX + 60, plaqueY + 14, { fill: theme.muted, align: 'center' })
  canvas.text(String(character.level.level), portraitX + 60, plaqueY + 32, {
    fill: theme.text,
    align: 'center',
    scale: 4,
  })

  // Nome, classe e patente.
  const columnX = 168
  const columnW = W - 28 - columnX
  const login = `@${character.login}`
  if (measure(login) * 3 <= columnW) {
    canvas.text(login, columnX, 62, { fill: theme.text, scale: 3 })
  } else {
    canvas.text(login, columnX, 66, { fill: theme.text, scale: 2, maxWidth: columnW })
  }
  const emblem = EMBLEMS[character.classId]
  canvas.bitmap(
    emblem,
    {
      '#': theme.outline,
      a: classColor,
      b: lighten(classColor, 0.55),
      c: '#8b5a3c',
      d: '#cdd4de',
    },
    columnX,
    98,
    2,
  )
  let cursor = columnX + EMBLEM_SIZE * 2 + 8
  cursor += canvas.text(t.classes[character.classId], cursor, 100, { fill: accentText })
  cursor += canvas.text(' · ', cursor, 100, { fill: theme.muted })
  canvas.text(t.ranks[character.rank], cursor, 100, { fill: rankText })

  // Barra de XP.
  const barY = 130
  canvas.rect(columnX, barY, columnW, 18, theme.outline)
  canvas.rect(columnX + 2, barY + 2, columnW - 4, 14, theme.track)
  const inner = columnW - 4
  const fill =
    character.level.progress > 0 ? Math.max(2, snap(inner * character.level.progress)) : 0
  canvas.rect(columnX + 2, barY + 2, fill, 14, classColor)
  canvas.rect(columnX + 2, barY + 2, fill, 4, lighten(classColor, 0.35))
  canvas.rect(columnX + 2, barY + 14, fill, 2, darken(classColor, 0.25))
  const notches: string[] = []
  for (let i = 1; i < 10; i++)
    notches.push(`M${columnX + 2 + snap((inner * i) / 10)} ${barY + 2}h2v14h-2z`)
  canvas.path(notches.join(''), mix(theme.outline, theme.track, 0.45))

  const xpLabel = canvas.text(`${t.card.xp} `, columnX, 156, { fill: theme.muted })
  const next = character.level.nextLevel
  canvas.text(
    next === null
      ? numberText(character.xp.total)
      : `${numberText(character.xp.total)} / ${numberText(next)}`,
    columnX + xpLabel,
    156,
    { fill: theme.text },
  )
  canvas.text(
    next === null ? t.card.maxLevel : t.card.toNext(numberText(next - character.xp.total)),
    W - 28,
    156,
    { fill: theme.muted, align: 'right' },
  )

  // Atributos em duas colunas.
  const colWidth = (columnW - 20) / 2
  ATTRIBUTES.forEach((def, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const ax = columnX + col * (colWidth + 20)
    const ay = 186 + row * 24
    const value = character.attributes[def.id]
    canvas.text(t.attributes[def.id].short, ax, ay, { fill: theme.text })
    const segments = Math.ceil(value / 10)
    const barX = ax + 44
    const barW = 10 * 14 - 2
    canvas.rect(barX - 2, ay - 2, barW + 4, 18, theme.outline)
    const on: string[] = []
    const shine: string[] = []
    const off: string[] = []
    for (let i = 0; i < 10; i++) {
      const sx = barX + i * 14
      if (i < segments) {
        on.push(`M${sx} ${ay}h12v14h-12z`)
        shine.push(`M${sx} ${ay}h12v4h-12z`)
      } else {
        off.push(`M${sx} ${ay}h12v14h-12z`)
      }
    }
    const barColor = options.theme === 'dark' ? def.color : darken(def.color, 0.08)
    canvas.path(off.join(''), theme.track)
    canvas.path(on.join(''), barColor)
    canvas.path(shine.join(''), lighten(barColor, 0.3))
    canvas.text(String(value), ax + colWidth, ay, { fill: theme.text, align: 'right' })
  })

  // Linguagens.
  const bottomX = 28
  const bottomW = W - 56
  canvas.rect(bottomX, 264, bottomW, 2, theme.panelEdge)
  const langY = 274
  canvas.rect(bottomX, langY, bottomW, 14, theme.outline)
  canvas.rect(bottomX + 2, langY + 2, bottomW - 4, 10, theme.track)
  const top = character.languages.slice(0, 6)
  const fallbackColor = options.theme === 'dark' ? '#8b93a5' : '#9a8b70'
  if (top.length > 0) {
    let x = bottomX + 2
    const innerW = bottomW - 4
    for (const lang of top) {
      const w = snap(innerW * lang.share)
      if (w <= 0) continue
      canvas.rect(
        x,
        langY + 2,
        Math.min(w, bottomX + 2 + innerW - x),
        10,
        lang.color ?? fallbackColor,
      )
      x += w
    }
    const labels = character.languages.slice(0, 4)
    for (let count = labels.length; count >= 1; count--) {
      const items = labels.slice(0, count)
      const widths = items.map(
        (lang) => 14 + measure(`${lang.name} ${t.card.percent(lang.share)}`) * 2,
      )
      const total = widths.reduce((sum, w) => sum + w, 0) + 20 * (count - 1)
      if (total > bottomW && count > 1) continue
      let lx = bottomX
      items.forEach((lang, i) => {
        canvas.rect(lx, 300, 10, 10, theme.outline)
        canvas.rect(lx + 2, 302, 6, 6, lang.color ?? fallbackColor)
        const nameW = canvas.text(lang.name, lx + 14, 298, {
          fill: theme.text,
          maxWidth: count === 1 ? bottomW - 80 : undefined,
        })
        canvas.text(` ${t.card.percent(lang.share)}`, lx + 14 + nameW, 298, { fill: theme.muted })
        lx += (widths[i] ?? 0) + 20
      })
      break
    }
  } else {
    canvas.text(t.card.noLanguages, bottomX, 298, { fill: theme.muted })
  }

  // Números públicos (e as contribuições privadas, quando a opção está ligada).
  let sx = bottomX
  footerStats(character, options.lang, bottomW).forEach(([value, label], i) => {
    if (i > 0) sx += canvas.text(' · ', sx, 326, { fill: theme.muted })
    sx += canvas.text(value, sx, 326, { fill: theme.text })
    sx += canvas.text(` ${label}`, sx, 326, { fill: theme.muted })
  })
  const activity = character.activity
  const descItems: StatItem[] = [
    [numberText(activity.commits.raw), t.card.stats.commits(activity.commits.raw)],
    [numberText(activity.merged.raw), t.card.stats.merged(activity.merged.raw)],
    [numberText(activity.reviews.raw), t.card.stats.reviews(activity.reviews.raw)],
    [numberText(activity.issues.raw), t.card.stats.issues(activity.issues.raw)],
  ]
  const privateCount = activity.privateContributions.raw
  if (privateCount > 0)
    descItems.push([numberText(privateCount), t.card.stats.privateLong(privateCount)])
  const descStats = statText(descItems)

  const attributes = ATTRIBUTES.map(
    (def) => `${t.attributes[def.id].short} ${character.attributes[def.id]}`,
  ).join(', ')
  const languages =
    character.languages
      .slice(0, 3)
      .map((lang) => `${lang.name} ${t.card.percent(lang.share)}`)
      .join(', ') || t.card.noLanguages
  const desc = t.a11y.desc({
    level: character.level.level,
    rank: t.ranks[character.rank],
    className: t.classes[character.classId],
    xp: numberText(character.xp.total),
    attributes,
    languages,
    stats: descStats,
  })
  return canvas.toString(t.a11y.title(character.login), desc)
}
