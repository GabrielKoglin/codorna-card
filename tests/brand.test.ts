import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { levelUpFrames } from '../scripts/lib/level-up'
import { rasterizeSvg } from '../scripts/lib/raster'
import { buildCharacter } from '../src/character'
import {
  renderLogo,
  renderMascot,
  renderSocialPreview,
  SOCIAL_HEIGHT,
  SOCIAL_WIDTH,
} from '../src/render/brand'
import { renderCard } from '../src/render/card'
import type { PlayerData } from '../src/types'

const character = (name: string) =>
  buildCharacter(
    JSON.parse(
      readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'),
    ) as PlayerData,
  )

/** O mesmo cuidado do card: nada externo e tudo na fonte e nos pixels do projeto. */
function assertSelfContained(svg: string): void {
  expect(svg).not.toMatch(/<image|<script|<style|<foreignObject|font-family|@import|xlink:href/)
  expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:/)
  expect(svg).toMatch(/<title id="gc-title">[^<]+<\/title>/)
}

describe('logo e codorna', () => {
  it('logo para fundo escuro e claro, com fundo transparente', () => {
    const dark = renderLogo('dark')
    const light = renderLogo('light')
    for (const svg of [dark, light]) {
      assertSelfContained(svg)
      const raster = rasterizeSvg(svg)
      expect(raster.data[3]).toBe(0) // canto transparente
      expect(Buffer.byteLength(svg)).toBeLessThan(20 * 1024)
    }
    // Mesmo desenho, cores do nome diferentes.
    expect(dark).not.toBe(light)
    expect(dark).toContain('#f3ecda')
    expect(light).toContain('#2a1f16')
  })

  it('codorna sozinha', () => {
    const svg = renderMascot(8)
    assertSelfContained(svg)
    const raster = rasterizeSvg(svg)
    expect(raster.width % 8).toBe(0)
  })
})

describe('prévia social', () => {
  it('1280×640, opaca e com o card de exemplo', () => {
    for (const lang of ['pt-BR', 'en'] as const) {
      const svg = renderSocialPreview(character('veterano'), lang)
      assertSelfContained(svg)
      const raster = rasterizeSvg(svg)
      expect([raster.width, raster.height]).toEqual([SOCIAL_WIDTH, SOCIAL_HEIGHT])
      for (let i = 3; i < raster.data.length; i += 4) {
        if (raster.data[i] !== 255) throw new Error(`pixel transparente na prévia (${lang})`)
      }
    }
  })
})

describe('GIF do nível 3 ao 40', () => {
  const from = character('iniciante')
  const to = character('veterano')
  const frames = levelUpFrames(from, to)

  it('começa no XP do iniciante e termina igual ao card do veterano', () => {
    expect(frames[0]?.character.xp.total).toBe(from.xp.total)
    expect(frames[0]?.character.level.level).toBe(3)
    const last = frames.at(-1)!.character
    expect(last.level.level).toBe(40)
    const options = { theme: 'dark', lang: 'pt-BR' } as const
    expect(renderCard(last, options)).toBe(renderCard(to, options))
  })

  it('sobe sem voltar, passa por todas as molduras e acende em cada patente nova', () => {
    const levels = frames.map((f) => f.character.level.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    const ranks = [...new Set(frames.map((f) => f.character.rank))]
    expect(ranks).toEqual(['recruit', 'apprentice', 'veteran', 'master'])
    const flashes = frames.filter((f) => f.flash).map((f) => f.character.level.level)
    expect(flashes).toEqual([5, 15, 30])
    const seconds = frames.reduce((sum, f) => sum + f.delay, 0) / 100
    expect(seconds).toBeGreaterThan(4)
    expect(seconds).toBeLessThan(12)
  })
})
