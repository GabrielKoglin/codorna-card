import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCharacter } from '../src/game/character'
import { CLASSES } from '../src/game/classes'
import { RANKS } from '../src/game/rules'
import { strings } from '../src/i18n'
import { renderCard } from '../src/render/card'
import { contrast, ensureContrast } from '../src/render/color'
import { RANK_METALS, THEMES } from '../src/render/theme'
import type { Lang, PlayerData, ThemeName } from '../src/types'

const fixture = (name: string): PlayerData =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'),
  ) as PlayerData

const FIXTURES = ['iniciante', 'veterano'] as const
const THEME_NAMES: ThemeName[] = ['dark', 'light']
const LANGS: Lang[] = ['pt-BR', 'en']

/** Confere se as tags abrem e fecham na ordem certa (o SVG é gerado por nós, sem CDATA). */
function assertWellFormed(svg: string): void {
  const stack: string[] = []
  for (const match of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match
    if (selfClosing) continue
    if (closing) {
      expect(stack.pop(), `fechou ${name}`).toBe(name)
    } else {
      stack.push(name ?? '')
    }
  }
  expect(stack).toEqual([])
}

describe('personagens das fixtures', () => {
  it('iniciante: Ilusionista, Recruta, nível 3', () => {
    const c = buildCharacter(fixture('iniciante'))
    expect(c.classId).toBe('illusionist')
    expect(c.rank).toBe('recruit')
    expect(c.level.level).toBe(3)
    expect(c.xp.total).toBe(374)
    expect(c.activity.commits.cappedDays).toBe(1)
  })

  it('veterano: Ferreiro, Mestre, nível 40', () => {
    const c = buildCharacter(fixture('veterano'))
    expect(c.classId).toBe('blacksmith')
    expect(c.classLanguage).toBe('Rust')
    expect(c.rank).toBe('master')
    expect(c.level.level).toBe(40)
    expect(c.memberSince).toBe(2013)
  })
})

describe('SVG do card', () => {
  for (const name of FIXTURES) {
    for (const theme of THEME_NAMES) {
      for (const lang of LANGS) {
        it(`${name} · ${theme} · ${lang}`, async () => {
          const svg = renderCard(buildCharacter(fixture(name)), { theme, lang })
          await expect(svg).toMatchFileSnapshot(`__snapshots__/${name}-${theme}-${lang}.svg`)

          expect(Buffer.byteLength(svg)).toBeLessThan(50 * 1024)
          expect(svg).toMatch(/<title id="gc-title">[^<]+<\/title>/)
          expect(svg).toMatch(/<desc id="gc-desc">[^<]+<\/desc>/)
          expect(svg).toContain('role="img"')
          // Nada externo: sem imagens, scripts, estilos, fontes ou links.
          expect(svg).not.toMatch(
            /<image|<script|<style|<foreignObject|font-family|@import|xlink:href/,
          )
          expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:/)
          assertWellFormed(svg)
          // Todo <use> aponta para um glifo definido.
          const defined = new Set([...svg.matchAll(/<path id="([^"]+)"/g)].map((m) => m[1]))
          for (const used of svg.matchAll(/<use href="#([^"]+)"/g))
            expect(defined).toContain(used[1])
        })
      }
    }
  }

  it('descreve o card para leitores de tela no idioma escolhido', () => {
    const character = buildCharacter(fixture('veterano'))
    const pt = renderCard(character, { theme: 'dark', lang: 'pt-BR' })
    const en = renderCard(character, { theme: 'dark', lang: 'en' })
    expect(pt).toContain('Guild Card de @demo-veterano')
    expect(pt).toContain('Nível 40 (Mestre), classe Ferreiro')
    expect(en).toContain('Guild Card of @demo-veterano')
    expect(en).toContain('Level 40 (Master), Blacksmith class')
  })

  it('aguenta username longo, conta sem linguagens e nível máximo', () => {
    const base = fixture('iniciante')
    const svg = renderCard(
      buildCharacter({
        ...base,
        login: 'm'.repeat(39),
        repositories: [],
        years: [
          {
            year: 2020,
            commitsByDay: Object.fromEntries(
              Array.from({ length: 30_000 }, (_, i) => [`dia-${i}`, 10]),
            ),
            issues: 0,
            pullRequests: 0,
            reviews: 0,
          },
        ],
      }),
      { theme: 'light', lang: 'pt-BR' },
    )
    expect(svg).toContain('<path id="g2026"') // reticências do nome cortado
    expect(svg).toContain(strings('pt-BR').card.noLanguages)
    expect(svg).toContain('Nível 99 (Mítico)')
    expect(Buffer.byteLength(svg)).toBeLessThan(50 * 1024)
  })
})

describe('legibilidade nos dois temas', () => {
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    it(`textos com contraste AA no tema ${name}`, () => {
      expect(contrast(theme.text, theme.background)).toBeGreaterThanOrEqual(7)
      expect(contrast(theme.text, theme.panel)).toBeGreaterThanOrEqual(7)
      expect(contrast(theme.muted, theme.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme.muted, theme.panel)).toBeGreaterThanOrEqual(4.5)
      for (const def of CLASSES) {
        expect(
          contrast(ensureContrast(def.color, theme.background, 4.5), theme.background),
        ).toBeGreaterThanOrEqual(4.5)
      }
      for (const rank of RANKS) {
        const metal = RANK_METALS[rank.id]
        const color = ensureContrast(
          name === 'dark' ? metal.light : metal.dark,
          theme.background,
          4.5,
        )
        expect(contrast(color, theme.background)).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})
