import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCharacter } from '../src/character'
import { CLASSES } from '../src/game/classes'
import { RANKS } from '../src/game/rules'
import { compactNumber, strings } from '../src/i18n'
import { footerStats, renderCard, statText } from '../src/render/card'
import { measure } from '../src/render/font'
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
    expect(pt).toContain('Codorna Card de @demo-veterano')
    expect(pt).toContain('Nível 40 (Mestre), classe Ferreiro')
    expect(en).toContain('Codorna Card of @demo-veterano')
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

describe('rodapé', () => {
  const withPrivate = (
    privateContributions: number,
    scale = 1,
    name: (typeof FIXTURES)[number] = 'veterano',
  ): PlayerData => {
    const base = fixture(name)
    return {
      ...base,
      years: base.years.map((year, i) => ({
        ...year,
        commitsByDay: Object.fromEntries(
          Object.entries(year.commitsByDay).map(([day, n]) => [day, n * scale]),
        ),
        privateContributions: i === 0 ? privateContributions : 0,
      })),
      mergedPullRequests: base.mergedPullRequests * scale,
    }
  }

  it('mostra só o número de privadas, rotulado nos dois idiomas', () => {
    const character = buildCharacter(withPrivate(3456, 1, 'iniciante'))
    expect(statText(footerStats(character, 'pt-BR'))).toBe(
      '169 commits · 3 PRs mesclados · 1 review · 3.456 privadas',
    )
    expect(statText(footerStats(character, 'en'))).toBe(
      '169 commits · 3 merged PRs · 1 review · 3,456 private',
    )
    const svg = renderCard(character, { theme: 'dark', lang: 'pt-BR' })
    expect(svg).toContain('1 review · 3 issues · 3.456 contribuições privadas.')
  })

  it('encurta rótulos e números quando não cabe', () => {
    const character = buildCharacter(withPrivate(3456))
    expect(statText(footerStats(character, 'pt-BR'))).toBe(
      '16,7k commits · 1.612 PRs · 2.494 reviews · 3.456 privadas',
    )
    expect(statText(footerStats(character, 'en'))).toBe(
      '16.7k commits · 1,612 PRs · 2,494 reviews · 3,456 private',
    )
    const svg = renderCard(character, { theme: 'dark', lang: 'pt-BR' })
    expect(svg).toContain('2.494 reviews · 512 issues · 3.456 contribuições privadas.')
  })

  it('sem privadas, o rodapé continua igual', () => {
    const character = buildCharacter(fixture('veterano'))
    expect(statText(footerStats(character, 'pt-BR'))).toBe(
      '16.772 commits · 1.612 PRs mesclados · 2.494 reviews',
    )
  })

  it('sempre cabe, mesmo com números enormes', () => {
    for (const lang of LANGS) {
      for (const scale of [1, 10, 100, 1000]) {
        const character = buildCharacter(withPrivate(123_456_789, scale))
        const text = statText(footerStats(character, lang))
        expect(measure(text) * 2, text).toBeLessThanOrEqual(640 - 56)
      }
    }
  })

  it('números compactos cortam em vez de arredondar', () => {
    expect(compactNumber(9_999, 'pt-BR')).toBe('9.999')
    expect(compactNumber(16_772, 'pt-BR')).toBe('16,7k')
    expect(compactNumber(16_772, 'en')).toBe('16.7k')
    expect(compactNumber(99_999, 'en')).toBe('99.9k')
    expect(compactNumber(100_000, 'en')).toBe('100k')
    expect(compactNumber(10_000, 'en')).toBe('10k')
    expect(compactNumber(1_250_000, 'pt-BR')).toBe('1,2M')
    expect(compactNumber(123_456_789, 'en')).toBe('123M')
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
