import type { PlayerData } from './types'

/**
 * Tabela de XP. Toda mudança aqui precisa ser refletida em `docs/regras.md` e `docs/rules.md`.
 * Os tetos existem para que volume artificial (farm) não vire nível.
 *
 * No modo completo (`private-token`), a atividade dos repositórios privados segue esta mesma
 * tabela, e cada teto vale para a soma de público e privado (o diário, no mesmo dia; os anuais, no
 * mesmo ano). Assim ninguém dobra um teto dividindo o trabalho entre os dois.
 */
export const XP_RULES = {
  /** Cada commit vale 2 XP, mas só os 10 primeiros de cada dia contam. */
  commit: { xp: 2, dailyCap: 10 },
  /** Cada issue aberta vale 4 XP, até 150 por ano. */
  issue: { xp: 4, yearlyCap: 150 },
  /** Cada PR aberto vale 5 XP, até 250 por ano. */
  pullRequest: { xp: 5, yearlyCap: 250 },
  /** Cada PR revisado vale 8 XP, até 250 por ano. */
  review: { xp: 8, yearlyCap: 250 },
  /** Cada PR mesclado vale +10 XP (nunca mais PRs mesclados do que PRs abertos contados). */
  mergedPullRequest: { xp: 10 },
  /** Bônus de +10 XP quando o PR mesclado é no repositório de outra pessoa. */
  mergedElsewhereBonus: { xp: 10 },
  /**
   * Opcional (`private-contributions: true`): cada contribuição privada que o GitHub mostra no
   * perfil vale 1 XP, até 1.000 por ano. Vale metade de um commit porque o número mistura todos
   * os tipos, não passa pelo teto diário e ninguém de fora consegue conferir.
   */
  privateContribution: { xp: 1, yearlyCap: 1000 },
} as const

/** Nível máximo. */
export const MAX_LEVEL = 99
/** XP total para chegar ao nível N = LEVEL_FACTOR × (N − 1)². */
export const LEVEL_FACTOR = 50

/** Um total com o teto aplicado. */
export interface CappedCount {
  /** Total sem teto. */
  raw: number
  /** Quanto conta para XP (com o teto). */
  counted: number
}

/** Um tipo de atividade, com a parte pública e a privada (modo completo) separadas. */
export interface Counted extends CappedCount {
  /** Total público, sem teto. */
  raw: number
  /** Total em repositórios privados (modo completo), sem teto. Zero sem `private-token`. */
  privateRaw: number
  /** Quanto conta para XP. Os tetos valem para a soma de público e privado. */
  counted: number
}

export interface CommitSummary extends Counted {
  /** Dias com pelo menos um commit (público ou, no modo completo, privado). */
  activeDays: number
  /** Dias em que o teto diário cortou commits. */
  cappedDays: number
}

export interface CountedActivity {
  commits: CommitSummary
  issues: Counted
  pullRequests: Counted
  reviews: Counted
  merged: Counted
  mergedElsewhere: Counted
  /**
   * Contribuições privadas anônimas do perfil (`private-contributions`). Zero quando a opção
   * está desligada.
   */
  privateContributions: CappedCount
}

export interface XpBreakdown {
  commits: number
  issues: number
  pullRequests: number
  reviews: number
  merged: number
  mergedElsewhere: number
  privateContributions: number
  total: number
}

export interface LevelProgress {
  level: number
  /** XP total da pessoa. */
  xp: number
  /** XP total em que o nível atual começa. */
  levelStart: number
  /** XP total do próximo nível (null no nível máximo). */
  nextLevel: number | null
  /** Progresso dentro do nível atual, de 0 a 1. */
  progress: number
}

export type RankId = 'recruit' | 'apprentice' | 'veteran' | 'master' | 'legend' | 'mythic'

/** Patentes por faixa de nível (a moldura do card muda de material em cada uma). */
export const RANKS: readonly { id: RankId; minLevel: number }[] = [
  { id: 'recruit', minLevel: 1 },
  { id: 'apprentice', minLevel: 5 },
  { id: 'veteran', minLevel: 15 },
  { id: 'master', minLevel: 30 },
  { id: 'legend', minLevel: 50 },
  { id: 'mythic', minLevel: 75 },
]

function whole(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * Aplica o teto diário de commits. Com commits privados (modo completo), o teto vale para a soma
 * de público e privado de cada dia.
 */
export function summarizeCommits(
  commitsByDay: Record<string, number>,
  privateCommitsByDay: Record<string, number> = {},
  dailyCap: number = XP_RULES.commit.dailyCap,
): CommitSummary {
  const summary: CommitSummary = {
    raw: 0,
    privateRaw: 0,
    counted: 0,
    activeDays: 0,
    cappedDays: 0,
  }
  const days = new Set([...Object.keys(commitsByDay), ...Object.keys(privateCommitsByDay)])
  for (const day of days) {
    const publicCommits = whole(commitsByDay[day] ?? 0)
    const privateCommits = whole(privateCommitsByDay[day] ?? 0)
    const commits = publicCommits + privateCommits
    if (commits === 0) continue
    summary.raw += publicCommits
    summary.privateRaw += privateCommits
    summary.counted += Math.min(commits, dailyCap)
    summary.activeDays += 1
    if (commits > dailyCap) summary.cappedDays += 1
  }
  return summary
}

function addDays(target: Record<string, number>, days: Record<string, number>): void {
  for (const [day, value] of Object.entries(days)) target[day] = (target[day] ?? 0) + whole(value)
}

/** Soma um ano de um tipo, com o teto anual valendo para público + privado. */
function addYear(target: Counted, publicCount: number, privateCount: number, cap: number): void {
  const pub = whole(publicCount)
  const priv = whole(privateCount)
  target.raw += pub
  target.privateRaw += priv
  target.counted += Math.min(pub + priv, cap)
}

const blank = (): Counted => ({ raw: 0, privateRaw: 0, counted: 0 })

/** Junta a atividade de todos os anos aplicando os tetos de cada tipo. */
export function countActivity(data: PlayerData): CountedActivity {
  const commitsByDay: Record<string, number> = {}
  const privateCommitsByDay: Record<string, number> = {}
  const issues = blank()
  const pullRequests = blank()
  const reviews = blank()
  const privateContributions: CappedCount = { raw: 0, counted: 0 }

  for (const year of data.years) {
    addDays(commitsByDay, year.commitsByDay)
    if (year.private) addDays(privateCommitsByDay, year.private.commitsByDay)
    addYear(issues, year.issues, year.private?.issues ?? 0, XP_RULES.issue.yearlyCap)
    addYear(
      pullRequests,
      year.pullRequests,
      year.private?.pullRequests ?? 0,
      XP_RULES.pullRequest.yearlyCap,
    )
    addYear(reviews, year.reviews, year.private?.reviews ?? 0, XP_RULES.review.yearlyCap)
    const yearPrivate = whole(year.privateContributions ?? 0)
    privateContributions.raw += yearPrivate
    privateContributions.counted += Math.min(yearPrivate, XP_RULES.privateContribution.yearlyCap)
  }

  const mergedRaw = whole(data.mergedPullRequests)
  const mergedPrivate = whole(data.private?.mergedPullRequests ?? 0)
  const mergedCounted = Math.min(mergedRaw + mergedPrivate, pullRequests.counted)
  const elsewhereRaw = Math.min(whole(data.mergedPullRequestsElsewhere), mergedRaw)
  const elsewherePrivate = Math.min(
    whole(data.private?.mergedPullRequestsElsewhere ?? 0),
    mergedPrivate,
  )

  return {
    commits: summarizeCommits(commitsByDay, privateCommitsByDay),
    issues,
    pullRequests,
    reviews,
    merged: { raw: mergedRaw, privateRaw: mergedPrivate, counted: mergedCounted },
    mergedElsewhere: {
      raw: elsewhereRaw,
      privateRaw: elsewherePrivate,
      counted: Math.min(elsewhereRaw + elsewherePrivate, mergedCounted),
    },
    privateContributions,
  }
}

/**
 * Total de contribuições privadas, o número que o card mostra como "N privadas": as anônimas do
 * perfil (`private-contributions`) mais commits, issues, PRs abertos e reviews contados nos
 * repositórios privados (modo completo). Sem teto, como os outros números do rodapé.
 */
export function privateTotal(activity: CountedActivity): number {
  return (
    activity.privateContributions.raw +
    activity.commits.privateRaw +
    activity.issues.privateRaw +
    activity.pullRequests.privateRaw +
    activity.reviews.privateRaw
  )
}

export function computeXp(activity: CountedActivity): XpBreakdown {
  const commits = activity.commits.counted * XP_RULES.commit.xp
  const issues = activity.issues.counted * XP_RULES.issue.xp
  const pullRequests = activity.pullRequests.counted * XP_RULES.pullRequest.xp
  const reviews = activity.reviews.counted * XP_RULES.review.xp
  const merged = activity.merged.counted * XP_RULES.mergedPullRequest.xp
  const mergedElsewhere = activity.mergedElsewhere.counted * XP_RULES.mergedElsewhereBonus.xp
  const privateContributions =
    activity.privateContributions.counted * XP_RULES.privateContribution.xp
  return {
    commits,
    issues,
    pullRequests,
    reviews,
    merged,
    mergedElsewhere,
    privateContributions,
    total:
      commits + issues + pullRequests + reviews + merged + mergedElsewhere + privateContributions,
  }
}

/** XP total necessário para chegar a um nível. */
export function xpForLevel(level: number): number {
  const clamped = Math.min(Math.max(Math.floor(level), 1), MAX_LEVEL)
  return LEVEL_FACTOR * (clamped - 1) ** 2
}

export function levelForXp(xp: number): number {
  const total = whole(xp)
  let level = Math.min(MAX_LEVEL, Math.floor(1 + Math.sqrt(total / LEVEL_FACTOR)))
  // Corrige possíveis erros de arredondamento da raiz quadrada.
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= total) level += 1
  while (level > 1 && xpForLevel(level) > total) level -= 1
  return level
}

export function levelProgress(xp: number): LevelProgress {
  const total = whole(xp)
  const level = levelForXp(total)
  const levelStart = xpForLevel(level)
  if (level >= MAX_LEVEL) {
    return { level, xp: total, levelStart, nextLevel: null, progress: 1 }
  }
  const nextLevel = xpForLevel(level + 1)
  return {
    level,
    xp: total,
    levelStart,
    nextLevel,
    progress: (total - levelStart) / (nextLevel - levelStart),
  }
}

export function rankForLevel(level: number): RankId {
  let rank: RankId = 'recruit'
  for (const entry of RANKS) {
    if (level >= entry.minLevel) rank = entry.id
  }
  return rank
}
