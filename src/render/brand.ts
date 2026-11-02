/**
 * Arte do projeto (não entra na Action): logo, mascote sozinho e prévia social. Tudo com a
 * codorna, a fonte e as cores do próprio Codorna Card, gerado por código.
 */
import type { Character } from '../game/character'
import type { Lang, ThemeName } from '../types'
import { Canvas } from './canvas'
import { CARD_HEIGHT, CARD_WIDTH, drawCard } from './card'
import { measure } from './font'
import { bitmapSize, MASCOT, mascotPalette } from './mascot'
import { THEMES } from './theme'

/** Cores do logo para fundo escuro (`dark`) e para fundo claro (`light`). */
export const LOGO_COLORS: Record<
  ThemeName,
  { outline: string; name: string; accent: string; shadow: string }
> = {
  dark: { outline: '#0b0e14', name: '#f3ecda', accent: '#f2b14c', shadow: '#000000' },
  light: { outline: '#2a1f16', name: '#2a1f16', accent: '#a0561c', shadow: '#e2d5b4' },
}

const NAME = 'CODORNA'
const SUFFIX = 'CARD'

/** Escreve "CODORNA CARD" com sombra de um pixel da fonte. Devolve a largura. */
function wordmark(
  canvas: Canvas,
  x: number,
  y: number,
  scale: number,
  colors: { name: string; accent: string; shadow: string },
): number {
  const space = (measure(`${NAME} `) - measure(NAME)) * scale
  for (const [dx, dy, shadow] of [
    [scale, scale, true],
    [0, 0, false],
  ] as const) {
    const first = canvas.text(NAME, x + dx, y + dy, {
      scale,
      fill: shadow ? colors.shadow : colors.accent,
    })
    canvas.text(SUFFIX, x + dx + first + space, y + dy, {
      scale,
      fill: shadow ? colors.shadow : colors.name,
    })
  }
  return measure(`${NAME} ${SUFFIX}`) * scale + scale
}

/** Logo (codorna + nome) com fundo transparente. `theme` é a cor do fundo onde ele vai. */
export function renderLogo(theme: ThemeName): string {
  const colors = LOGO_COLORS[theme]
  const mascotScale = 3
  const textScale = 5
  const pad = 6
  const mascot = bitmapSize(MASCOT)
  const mascotW = mascot.width * mascotScale
  const mascotH = mascot.height * mascotScale
  const textW = measure(`${NAME} ${SUFFIX}`) * textScale + textScale
  const textH = 7 * textScale + textScale
  const gap = 20
  const width = pad * 2 + mascotW + gap + textW
  const height = pad * 2 + mascotH
  const canvas = new Canvas(width, height)
  canvas.bitmap(MASCOT, mascotPalette(colors.outline), pad, pad, mascotScale)
  wordmark(canvas, pad + mascotW + gap, pad + Math.round((mascotH - textH) / 2), textScale, colors)
  return canvas.toString(
    'Codorna Card',
    'Logo do Codorna Card: a codorna mascote, de headset, ao lado do nome do projeto.',
  )
}

/** Só a codorna, com fundo transparente. */
export function renderMascot(scale = 8): string {
  const { width, height } = bitmapSize(MASCOT)
  const pad = scale
  const canvas = new Canvas(width * scale + pad * 2, height * scale + pad * 2)
  canvas.bitmap(MASCOT, mascotPalette(LOGO_COLORS.light.outline), pad, pad, scale)
  return canvas.toString(
    'Codorna',
    'A codorna, mascote do Codorna Card, de perfil e de headset, em pixel art.',
  )
}

export const SOCIAL_WIDTH = 1280
export const SOCIAL_HEIGHT = 640

/** Textos da prévia social (o título é o mesmo nos dois idiomas). */
const SOCIAL_TEXT: Record<Lang, { lines: string[]; footer: string }> = {
  'pt-BR': {
    lines: ['Sua atividade no GitHub', 'vira um card de RPG', 'em pixel art.'],
    footer: 'GitHub Action · código aberto · MIT',
  },
  en: {
    lines: ['Your GitHub activity', 'as a pixel art RPG card.'],
    footer: 'GitHub Action · open source · MIT',
  },
}

/**
 * Prévia social 1280×640 (a imagem que aparece quando alguém compartilha o link do
 * repositório): a codorna e o nome à esquerda, um card de exemplo à direita.
 */
export function renderSocialPreview(card: Character, lang: Lang = 'pt-BR'): string {
  const theme = THEMES.dark
  const colors = LOGO_COLORS.dark
  const W = SOCIAL_WIDTH
  const H = SOCIAL_HEIGHT
  const canvas = new Canvas(W, H)
  canvas.rect(0, 0, W, H, theme.background)
  // Pontinhos discretos de fundo, numa grade fixa.
  const dots: string[] = []
  for (let y = 16; y < H; y += 32) {
    for (let x = 16; x < W; x += 32) dots.push(`M${x} ${y}h2v2h-2z`)
  }
  canvas.path(dots.join(''), '#1c2230')

  const left = 72
  const mascotScale = 6
  const mascot = bitmapSize(MASCOT)
  // Sombra no chão, embaixo dos pés.
  const floorY = 72 + (mascot.height - 1) * mascotScale
  canvas.rect(left + 8 * mascotScale, floorY, 13 * mascotScale, mascotScale, '#0e1219')
  canvas.rect(
    left + 6 * mascotScale,
    floorY + mascotScale,
    17 * mascotScale,
    mascotScale,
    '#0e1219',
  )
  canvas.bitmap(MASCOT, mascotPalette(colors.outline), left, 72, mascotScale)
  const titleY = 72 + mascot.height * mascotScale + 28
  wordmark(canvas, left, titleY, 6, colors)

  const text = SOCIAL_TEXT[lang]
  text.lines.forEach((line, i) => {
    canvas.text(line, left, titleY + 72 + i * 34, { scale: 3, fill: theme.text })
  })
  canvas.text(text.footer, left, H - 64, { scale: 2, fill: theme.muted })

  // Card de exemplo com sombra.
  const cardX = W - CARD_WIDTH - 64
  const cardY = Math.round((H - CARD_HEIGHT) / 2 / 2) * 2
  canvas.rect(cardX + 12, cardY + 12, CARD_WIDTH - 8, CARD_HEIGHT - 8, '#0b0e14')
  canvas.group(cardX, cardY, () => {
    drawCard(canvas, card, { theme: 'dark', lang })
  })
  return canvas.toString(
    'Codorna Card',
    lang === 'pt-BR'
      ? 'Prévia social do Codorna Card: a codorna mascote, o nome do projeto e um card de exemplo.'
      : 'Codorna Card social preview: the quail mascot, the project name and an example card.',
  )
}
