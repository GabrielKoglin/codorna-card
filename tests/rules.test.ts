import { describe, expect, it } from 'vitest'
import {
  computeXp,
  countActivity,
  levelForXp,
  levelProgress,
  MAX_LEVEL,
  privateTotal,
  rankForLevel,
  summarizeCommits,
  XP_RULES,
  xpForLevel,
} from '../src/game/rules'
import type { PlayerData, PrivateActivity, YearActivity } from '../src/types'

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
    expect(summary).toEqual({ raw: 53, privateRaw: 0, counted: 23, activeDays: 3, cappedDays: 1 })
  })

  it('ignora valores inválidos', () => {
    const summary = summarizeCommits({ a: -5, b: Number.NaN, c: 2.9, d: 0 })
    expect(summary).toEqual({ raw: 2, privateRaw: 0, counted: 2, activeDays: 1, cappedDays: 0 })
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
    expect(activity.issues).toEqual({ raw: 210, privateRaw: 0, counted: 150 + 10 })
    expect(activity.pullRequests).toEqual({ raw: 320, privateRaw: 0, counted: 250 + 20 })
    expect(activity.reviews).toEqual({ raw: 430, privateRaw: 0, counted: 250 + 30 })
  })

  it('nunca conta mais PRs mesclados do que PRs abertos contados', () => {
    expect(activity.merged).toEqual({ raw: 1000, privateRaw: 0, counted: 270 })
    expect(activity.mergedElsewhere).toEqual({ raw: 900, privateRaw: 0, counted: 270 })
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
      privateContributions: 0,
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

describe('contribuições privadas (opcional)', () => {
  it('valem 1 XP cada, até 1.000 por ano, e não mexem no resto', () => {
    const data = player({
      years: [
        {
          year: 2025,
          commitsByDay: { '2025-02-01': 4 },
          issues: 0,
          pullRequests: 0,
          reviews: 0,
          privateContributions: 2500,
        },
        {
          year: 2026,
          commitsByDay: {},
          issues: 0,
          pullRequests: 0,
          reviews: 0,
          privateContributions: 300,
        },
      ],
    })
    const activity = countActivity(data)
    expect(activity.privateContributions).toEqual({ raw: 2800, counted: 1000 + 300 })
    expect(activity.commits.counted).toBe(4)
    const xp = computeXp(activity)
    expect(xp.privateContributions).toBe(1300 * XP_RULES.privateContribution.xp)
    expect(xp.total).toBe(4 * 2 + 1300)
  })

  it('sem a opção (campo ausente) não somam nada', () => {
    const activity = countActivity(
      player({
        years: [{ year: 2026, commitsByDay: {}, issues: 0, pullRequests: 0, reviews: 0 }],
      }),
    )
    expect(activity.privateContributions).toEqual({ raw: 0, counted: 0 })
    expect(computeXp(activity).privateContributions).toBe(0)
  })

  it('valem menos que um commit público e ignoram valores inválidos', () => {
    expect(XP_RULES.privateContribution.xp).toBeLessThan(XP_RULES.commit.xp)
    const activity = countActivity(
      player({
        years: [
          {
            year: 2026,
            commitsByDay: {},
            issues: 0,
            pullRequests: 0,
            reviews: 0,
            privateContributions: -40,
          },
        ],
      }),
    )
    expect(activity.privateContributions).toEqual({ raw: 0, counted: 0 })
  })
})

describe('modo completo (private-token): mesmas regras, tetos sobre a soma', () => {
  const year = (overrides: Partial<YearActivity>): YearActivity => ({
    year: 2026,
    commitsByDay: {},
    issues: 0,
    pullRequests: 0,
    reviews: 0,
    ...overrides,
  })
  const totals = (overrides: Partial<PrivateActivity> = {}): PrivateActivity => ({
    mergedPullRequests: 0,
    mergedPullRequestsElsewhere: 0,
    repositories: [],
    scannedRepositories: 0,
    skippedRepositories: 0,
    ...overrides,
  })
  const noPrivate = { commitsByDay: {}, issues: 0, pullRequests: 0, reviews: 0 }

  it('o teto diário vale para público + privado do mesmo dia', () => {
    const activity = countActivity(
      player({
        years: [
          year({
            commitsByDay: { '2026-03-01': 6, '2026-03-02': 2 },
            private: { ...noPrivate, commitsByDay: { '2026-03-01': 7, '2026-03-05': 4 } },
          }),
        ],
      }),
    )
    // 03-01: 6 + 7 = 13 → 10. 03-02: 2. 03-05 (só privado): 4.
    expect(activity.commits).toEqual({
      raw: 8,
      privateRaw: 11,
      counted: 10 + 2 + 4,
      activeDays: 3,
      cappedDays: 1,
    })
  })

  it('dividir o dia entre anos e entre público e privado não dobra o teto', () => {
    const summary = summarizeCommits({ '2026-05-01': 10 }, { '2026-05-01': 10 })
    expect(summary.counted).toBe(10)
    expect(summarizeCommits({}, { '2026-05-01': 30 }).counted).toBe(10)
    expect(summarizeCommits({ a: 3 }, { a: -2, b: Number.NaN }).counted).toBe(3)
  })

  it('os tetos anuais valem para a soma de cada ano', () => {
    const activity = countActivity(
      player({
        years: [
          year({
            year: 2025,
            issues: 100,
            pullRequests: 200,
            private: { ...noPrivate, issues: 100, pullRequests: 100, reviews: 300 },
          }),
          year({ year: 2026, issues: 1, private: { ...noPrivate, issues: 2 } }),
        ],
      }),
    )
    expect(activity.issues).toEqual({ raw: 101, privateRaw: 102, counted: 150 + 3 })
    expect(activity.pullRequests).toEqual({ raw: 200, privateRaw: 100, counted: 250 })
    expect(activity.reviews).toEqual({ raw: 0, privateRaw: 300, counted: 250 })
  })

  it('PRs mesclados privados somam, sem passar dos PRs abertos contados', () => {
    const activity = countActivity(
      player({
        years: [year({ pullRequests: 50, private: { ...noPrivate, pullRequests: 200 } })],
        mergedPullRequests: 5,
        mergedPullRequestsElsewhere: 2,
        private: totals({ mergedPullRequests: 300, mergedPullRequestsElsewhere: 900 }),
      }),
    )
    expect(activity.merged).toEqual({ raw: 5, privateRaw: 300, counted: 250 })
    // Mesclados em outro lugar nunca passam dos mesclados (900 vira 300).
    expect(activity.mergedElsewhere).toEqual({ raw: 2, privateRaw: 300, counted: 250 })
  })

  it('cada atividade privada vale o mesmo XP da pública', () => {
    const activity = countActivity(
      player({
        years: [
          year({
            private: {
              commitsByDay: { '2026-01-10': 3 },
              issues: 1,
              pullRequests: 2,
              reviews: 1,
            },
          }),
        ],
        private: totals({ mergedPullRequests: 1, mergedPullRequestsElsewhere: 1 }),
      }),
    )
    expect(computeXp(activity)).toEqual({
      commits: 3 * 2,
      issues: 4,
      pullRequests: 2 * 5,
      reviews: 8,
      merged: 10,
      mergedElsewhere: 10,
      privateContributions: 0,
      total: 6 + 4 + 10 + 8 + 10 + 10,
    })
  })

  it('o total de privadas soma as anônimas e as do modo completo', () => {
    const activity = countActivity(
      player({
        years: [
          year({
            commitsByDay: { '2026-02-01': 5 },
            issues: 9,
            privateContributions: 40,
            private: { commitsByDay: { '2026-02-01': 30 }, issues: 2, pullRequests: 3, reviews: 4 },
          }),
        ],
        private: totals({ mergedPullRequests: 3 }),
      }),
    )
    // Os PRs mesclados não somam de novo: o PR já contou quando foi aberto.
    expect(privateTotal(activity)).toBe(40 + 30 + 2 + 3 + 4)
    expect(privateTotal(countActivity(player()))).toBe(0)
  })

  it('sem private-token (campos ausentes), nada muda', () => {
    const data = player({
      years: [year({ commitsByDay: { '2026-04-01': 12 }, issues: 3, pullRequests: 2 })],
      mergedPullRequests: 1,
    })
    const activity = countActivity(data)
    expect(activity.commits).toEqual({
      raw: 12,
      privateRaw: 0,
      counted: 10,
      activeDays: 1,
      cappedDays: 1,
    })
    expect(computeXp(activity).total).toBe(20 + 12 + 10 + 10)
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
