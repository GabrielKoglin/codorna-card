import { describe, expect, it } from 'vitest'
import { attributeValue, computeAttributes, mainLanguages } from '../src/game/attributes'
import { classForLanguage, CLASSES, dominantClass, languageShares } from '../src/game/classes'
import { countActivity } from '../src/game/rules'
import type { RepoLanguages } from '../src/types'

const repo = (name: string, languages: Record<string, number>): RepoLanguages => ({
  name,
  languages: Object.entries(languages).map(([lang, size]) => ({ name: lang, color: null, size })),
})

describe('mapa de linguagens', () => {
  it('não repete linguagem em duas classes', () => {
    const seen = new Map<string, string>()
    for (const def of CLASSES) {
      for (const language of def.languages) {
        const key = language.toLowerCase()
        expect(seen.get(key), `${language} em ${seen.get(key)} e ${def.id}`).toBeUndefined()
        seen.set(key, def.id)
      }
    }
  })

  it('ignora maiúsculas e espaços', () => {
    expect(classForLanguage(' typescript ')).toBe('illusionist')
    expect(classForLanguage('RUST')).toBe('blacksmith')
    expect(classForLanguage('Jupyter Notebook')).toBe('alchemist')
    expect(classForLanguage('Brainfuck')).toBeNull()
  })

  it('tem nome de classe nos dois idiomas', async () => {
    const { strings } = await import('../src/i18n')
    for (const def of CLASSES) {
      expect(strings('pt-BR').classes[def.id]).toBeTruthy()
      expect(strings('en').classes[def.id]).toBeTruthy()
    }
  })
})

describe('votos por repositório', () => {
  it('cada repositório vale um voto, dividido pelo tamanho', () => {
    const shares = languageShares([
      repo('a', { Rust: 900, Shell: 100 }),
      repo('b', { Python: 10 }),
      repo('vazio', {}),
    ])
    expect(shares.map((s) => [s.name, Number(s.share.toFixed(2))])).toEqual([
      ['Python', 0.5],
      ['Rust', 0.45],
      ['Shell', 0.05],
    ])
  })

  it('um repositório gigante não engole os outros', () => {
    const shares = languageShares([
      repo('gigante', { 'C++': 50_000_000 }),
      repo('a', { Go: 10 }),
      repo('b', { Go: 10 }),
    ])
    expect(dominantClass(shares).classId).toBe('ranger')
  })
})

describe('classe', () => {
  it('soma linguagens da mesma família', () => {
    const shares = languageShares([
      repo('front', { JavaScript: 100 }),
      repo('app', { TypeScript: 100 }),
      repo('dados', { Python: 100 }),
    ])
    const result = dominantClass(shares)
    expect(result.classId).toBe('illusionist')
    expect(result.share).toBeCloseTo(2 / 3)
    expect(result.language).toBe('JavaScript')
  })

  it('linguagens desconhecidas não votam', () => {
    const shares = languageShares([
      repo('a', { Brainfuck: 100 }),
      repo('b', { Brainfuck: 100 }),
      repo('c', { Go: 1 }),
    ])
    expect(dominantClass(shares).classId).toBe('ranger')
  })

  it('sem linguagens conhecidas vira Aventureiro', () => {
    expect(dominantClass([]).classId).toBe('adventurer')
    expect(dominantClass(languageShares([repo('a', { Brainfuck: 5 })])).classId).toBe('adventurer')
  })

  it('desempata pela ordem das classes', () => {
    const shares = languageShares([repo('a', { Python: 10 }), repo('b', { Rust: 10 })])
    expect(dominantClass(shares).classId).toBe('blacksmith')
  })
})

describe('atributos', () => {
  it('vão de 1 a 99', () => {
    expect(attributeValue(0, 100)).toBe(1)
    expect(attributeValue(-3, 100)).toBe(1)
    expect(attributeValue(100, 100)).toBe(99)
    expect(attributeValue(1_000, 100)).toBe(99)
    expect(attributeValue(6, 12, 1)).toBe(50)
  })

  it('crescem sempre que a quantidade cresce', () => {
    let previous = 0
    for (const amount of [1, 5, 10, 50, 100, 500, 1_000, 5_000, 20_000]) {
      const value = attributeValue(amount, 20_000)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('INT conta linguagens principais diferentes, só em repositórios com 1 KB ou mais', () => {
    const repos = [
      repo('a', { Rust: 5000, Shell: 4000 }),
      repo('b', { Shell: 3000 }),
      repo('c', { Rust: 2000 }),
      repo('minusculo', { Haskell: 300 }),
    ]
    expect(mainLanguages(repos).sort()).toEqual(['Rust', 'Shell'])
  })

  it('usa a atividade contada (com tetos)', () => {
    const activity = countActivity({
      login: 'x',
      createdAt: '2020-01-01T00:00:00Z',
      years: [
        { year: 2020, commitsByDay: { '2020-01-01': 500 }, issues: 0, pullRequests: 0, reviews: 0 },
      ],
      mergedPullRequests: 0,
      mergedPullRequestsElsewhere: 0,
      repositories: [],
    })
    const attributes = computeAttributes(activity, [])
    expect(attributes.str).toBe(attributeValue(10, 20_000))
    expect(attributes.con).toBe(attributeValue(1, 3_650))
    expect(attributes.int).toBe(1)
  })
})
