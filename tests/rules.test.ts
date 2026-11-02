import { describe, expect, it } from 'vitest'
import {
  computeXp,
  countActivity,
  levelForXp,
  levelProgress,
  MAX_LEVEL,
  rankForLevel,
  summarizeCommits,
  XP_RULES,
  xpForLevel,
} from '../src/game/rules'
import type { PlayerData } from '../src/types'

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    login: 'teste',
    createdAt: '2020-01-01T00:00:00Z',
    years: [],
    mergedPullRequests: 0,
    mergedPullRequestsElsewhere: 0,
    repositories: [],
    ...overrides,
  }
}

describe('commits', () => {
  it('conta no máximo 10 commits por dia', () => {
    const summary = summarizeCommits({ '2026-01-01': 3, '2026-01-02': 40, '2026-01-03': 10 })
    expect(summary).toEqual({ raw: 53, counted: 23, activeDays: 3, cappedDays: 1 })
  })

  it('ignora valores inválidos', () => {
    const summary = summarizeCommits({ a: -5, b: Number.NaN, c: 2.9, d: 0 })
    expect(summary).toEqual({ raw: 2, counted: 2, activeDays: 1, cappedDays: 0 })
  })

  it('soma o mesmo dia vindo de anos diferentes antes de aplicar o teto', () => {
    const activity = countActivity(
      player({
        years: [
          { year: 2025, commitsByDay: { '2025-12-31': 8 }, issues: 0, pullRequests: 0, reviews: 0 },
          { year: 2026, commitsByDay: { '2025-12-31': 8 }, issues: 0, pullRequests: 0, reviews: 0 },
        ],
      }),
    )
    expect(activity.commits.counted).toBe(10)
  })
})

describe('tetos anuais e PRs mesclados', () => {
  const data = player({
    years: [
      { year: 2024, commitsByDay: {}, issues: 200, pullRequests: 300, reviews: 400 },
      { year: 2025, commitsByDay: {}, issues: 10, pullRequests: 20, reviews: 30 },
    ],
    mergedPullRequests: 1000,
    mergedPullRequestsElsewhere: 900,
  })
  const activity = countActivity(data)

  it('aplica o teto por ano em issues, PRs e reviews', () => {
    expect(activity.issues).toEqual({ raw: 210, counted: 150 + 10 })
    expect(activity.pullRequests).toEqual({ raw: 320, counted: 250 + 20 })
    expect(activity.reviews).toEqual({ raw: 430, counted: 250 + 30 })
  })

  it('nunca conta mais PRs mesclados do que PRs abertos contados', () => {
    expect(activity.merged).toEqual({ raw: 1000, counted: 270 })
    expect(activity.mergedElsewhere).toEqual({ raw: 900, counted: 270 })
  })
})

describe('XP', () => {
  it('soma cada tipo com o seu peso', () => {
    const activity = countActivity(
      player({
        years: [
          {
            year: 2026,
            commitsByDay: { '2026-03-01': 5, '2026-03-02': 15 },
            issues: 2,
            pullRequests: 3,
            reviews: 4,
          },
        ],
        mergedPullRequests: 2,
        mergedPullRequestsElsewhere: 1,
      }),
    )
    const xp = computeXp(activity)
    expect(xp).toEqual({
      commits: 15 * 2,
      issues: 2 * 4,
      pullRequests: 3 * 5,
      reviews: 4 * 8,
      merged: 2 * 10,
      mergedElsewhere: 1 * 10,
      total: 30 + 8 + 15 + 32 + 20 + 10,
    })
  })

  it('PR mesclado e review valem mais que commit', () => {
    const merged = XP_RULES.pullRequest.xp + XP_RULES.mergedPullRequest.xp
    expect(merged).toBeGreaterThan(XP_RULES.commit.xp)
    expect(XP_RULES.review.xp).toBeGreaterThan(XP_RULES.commit.xp)
  })

  it('não gera XP sem atividade', () => {
    expect(computeXp(countActivity(player())).total).toBe(0)
  })
})

describe('nível', () => {
  it('segue a curva 50 × (N − 1)²', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(50)
    expect(xpForLevel(3)).toBe(200)
    expect(xpForLevel(10)).toBe(4050)
    expect(xpForLevel(MAX_LEVEL)).toBe(480_200)
  })

  it('acerta as fronteiras', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(49)).toBe(1)
    expect(levelForXp(50)).toBe(2)
    expect(levelForXp(199)).toBe(2)
    expect(levelForXp(200)).toBe(3)
    expect(levelForXp(480_199)).toBe(98)
    expect(levelForXp(480_200)).toBe(99)
    expect(levelForXp(10_000_000)).toBe(99)
    expect(levelForXp(-10)).toBe(1)
  })

  it('é coerente com xpForLevel em todos os níveis', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level)
      if (level > 1) expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1)
    }
  })

  it('calcula o progresso dentro do nível', () => {
    expect(levelProgress(125)).toEqual({
      level: 2,
      xp: 125,
      levelStart: 50,
      nextLevel: 200,
      progress: 0.5,
    })
    const max = levelProgress(600_000)
    expect(max.level).toBe(99)
    expect(max.nextLevel).toBeNull()
    expect(max.progress).toBe(1)
  })
})

describe('patente', () => {
  it('muda nas faixas de nível', () => {
    expect(rankForLevel(1)).toBe('recruit')
    expect(rankForLevel(4)).toBe('recruit')
    expect(rankForLevel(5)).toBe('apprentice')
    expect(rankForLevel(15)).toBe('veteran')
    expect(rankForLevel(30)).toBe('master')
    expect(rankForLevel(50)).toBe('legend')
    expect(rankForLevel(75)).toBe('mythic')
    expect(rankForLevel(99)).toBe('mythic')
  })
})
