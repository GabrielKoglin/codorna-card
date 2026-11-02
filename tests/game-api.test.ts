import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCharacter } from '../src/character'
import * as game from '../src/game'
import type { PlayerData } from '../src/types'

const GAME_DIR = new URL('../src/game/', import.meta.url)
const files = readdirSync(GAME_DIR).filter((name) => name.endsWith('.ts'))

/** Código sem comentários (os comentários podem falar de rede, relógio etc. à vontade). */
function code(name: string): string {
  return readFileSync(new URL(name, GAME_DIR), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const fixture = (name: string): PlayerData =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'),
  ) as PlayerData

describe('src/game é puro (pronto para virar pacote)', () => {
  it('só importa arquivos da própria pasta', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const name of files) {
      for (const match of code(name).matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
        expect(match[1], `${name} importa ${match[1]}`).toMatch(/^\.\/[\w-]+$/)
      }
      expect(code(name), name).not.toMatch(/\bimport\s*\(|\brequire\s*\(/)
    }
  })

  it('não faz I/O nem lê relógio, ambiente ou acaso', () => {
    const forbidden =
      /\b(process|console|fetch|globalThis|window|document|setTimeout|setInterval|XMLHttpRequest|Buffer)\b|Date\.now|new Date\(|Math\.random/
    for (const name of files) expect(code(name), name).not.toMatch(forbidden)
  })

  it('a ficha é determinística e não mexe nos dados de entrada', () => {
    const data = deepFreeze(fixture('veterano'))
    const first = game.buildSheet(data)
    expect(game.buildSheet(data)).toEqual(first)
    expect(first.level.level).toBe(40)
    expect(first.classId).toBe('blacksmith')
  })

  it('no modo completo, os repositórios privados próprios votam na classe e contam em INT', () => {
    const base: PlayerData = {
      login: 'x',
      createdAt: '2020-01-01T00:00:00Z',
      years: [],
      mergedPullRequests: 0,
      mergedPullRequestsElsewhere: 0,
      repositories: [{ name: 'publico', languages: [{ name: 'Go', color: null, size: 5000 }] }],
    }
    const publicOnly = game.buildSheet(base)
    expect(publicOnly.classId).toBe('ranger')
    expect(publicOnly.attributes.int).toBe(game.attributeValue(1, 12, 1))

    const full = game.buildSheet({
      ...base,
      private: {
        mergedPullRequests: 0,
        mergedPullRequestsElsewhere: 0,
        scannedRepositories: 2,
        skippedRepositories: 0,
        repositories: [
          { languages: [{ name: 'TypeScript', color: '#3178c6', size: 9000 }] },
          { languages: [{ name: 'JavaScript', color: '#f1e05a', size: 3000 }] },
        ],
      },
    })
    expect(full.classId).toBe('illusionist')
    expect(full.languages.map((lang) => lang.name)).toEqual(['Go', 'JavaScript', 'TypeScript'])
    expect(full.attributes.int).toBe(game.attributeValue(3, 12, 1))
    expect(game.languageRepositories(base)).toHaveLength(1)
  })

  it('o card usa exatamente a ficha das regras', () => {
    for (const name of ['iniciante', 'veterano']) {
      const data = fixture(name)
      const sheet = game.buildSheet(data)
      const character = buildCharacter(data)
      expect(character).toMatchObject(sheet)
      expect(character.login).toBe(data.login)
    }
  })

  it('exporta as peças das regras pelo index', () => {
    for (const name of [
      'buildSheet',
      'countActivity',
      'computeXp',
      'levelProgress',
      'levelForXp',
      'xpForLevel',
      'rankForLevel',
      'languageShares',
      'dominantClass',
      'classForLanguage',
      'computeAttributes',
      'attributeValue',
      'summarizeCommits',
    ] as const) {
      expect(typeof game[name], name).toBe('function')
    }
    expect(game.XP_RULES.commit.dailyCap).toBe(10)
    expect(game.MAX_LEVEL).toBe(99)
    expect(game.RANKS.map((rank) => rank.id)).toEqual([
      'recruit',
      'apprentice',
      'veteran',
      'master',
      'legend',
      'mythic',
    ])
  })
})
