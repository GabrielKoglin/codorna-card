import { describe, expect, it } from 'vitest'
import { CLASSES } from '../src/game/classes'
import { loginHash } from '../src/hash'
import { contrast } from '../src/render/color'
import {
  buildSprite,
  composeSprite,
  EYE_COLOR,
  HAIR_COLORS,
  HIGH_CONTRAST_EYES,
  SKIN,
  SPRITE_SIZE,
  spriteTraits,
} from '../src/render/sprite'

const colors = { outline: '#07090d' }
const serialize = (pixels: (string | null)[][]) =>
  pixels.map((row) => row.map((c) => c ?? '.').join(',')).join('\n')

describe('avatar', () => {
  it('é 16×16 e sempre igual para o mesmo username (sem diferenciar maiúsculas)', () => {
    const a = buildSprite(loginHash('GabrielKoglin'), 'alchemist', colors)
    const b = buildSprite(loginHash('gabrielkoglin'), 'alchemist', colors)
    expect(a.pixels).toHaveLength(SPRITE_SIZE)
    for (const row of a.pixels) expect(row).toHaveLength(SPRITE_SIZE)
    expect(serialize(a.pixels)).toBe(serialize(b.pixels))
  })

  it('muda de uma pessoa para outra', () => {
    const logins = Array.from({ length: 30 }, (_, i) => `dev-${i}`)
    const unique = new Set(
      logins.map((login) => serialize(buildSprite(loginHash(login), 'adventurer', colors).pixels)),
    )
    expect(unique.size).toBeGreaterThanOrEqual(27)
  })

  it('desenha todas as classes sem papel de cor desconhecido e com contorno', () => {
    for (const def of CLASSES) {
      const sprite = buildSprite(loginHash('guild'), def.id, colors)
      const flat = sprite.pixels.flat()
      expect(flat, def.id).not.toContain('#ff00ff')
      expect(flat).toContain(colors.outline)
      // A borda do quadro fica livre ou com contorno, nunca com cor de corpo.
      for (const [x, y] of [
        [0, 0],
        [15, 0],
        [0, 15],
        [15, 15],
      ] as const) {
        expect([null, colors.outline]).toContain(sprite.pixels[y]?.[x] ?? null)
      }
    }
  })

  it('evita cabelo da cor da pele e olhos sem brilho em pele escura', () => {
    for (let i = 0; i < 200; i++) {
      const traits = spriteTraits(loginHash(`pessoa-${i}`), 'adventurer')
      const sprite = composeSprite(traits, 'adventurer', colors)
      expect(sprite.pixels.flat().length).toBe(256)
      const skin = SKIN[traits.skin]!
      expect(contrast(HAIR_COLORS[traits.hair]!, skin)).toBeGreaterThanOrEqual(1.7)
      if (contrast(EYE_COLOR, skin) < 3) expect(HIGH_CONTRAST_EYES).toContain(traits.eyes)
    }
  })
})
