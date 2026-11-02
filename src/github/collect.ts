import { strings } from '../i18n'
import type { Lang, PlayerData, RepoLanguages, YearActivity } from '../types'
import type { GitHubClient } from './client'
import { CodornaCardError } from './errors'
import {
  PROFILE_QUERY,
  quartersQuery,
  REPOSITORIES_QUERY,
  YEAR_QUERY,
  type CommitDaysByRepository,
  type CountByRepository,
  type ProfileResponse,
  type QuartersResponse,
  type RepositoriesResponse,
  type YearResponse,
} from './queries'

export interface CollectOptions {
  client: GitHubClient
  login: string
  lang: Lang
  /** Data de referência (padrão: agora). */
  now?: Date
  log?: (message: string) => void
  warn?: (message: string) => void
  /** Páginas de 100 repositórios lidas no máximo (padrão 10 = 1.000 repositórios). */
  maxRepositoryPages?: number
  /**
   * Lê também o número de contribuições privadas que o GitHub mostra no perfil
   * (`restrictedContributionsCount`, ano a ano). Padrão: false.
   */
  privateContributions?: boolean
}

/** Limite de repositórios por período que a API devolve em cada lista. */
const MAX_REPOSITORIES = 100

export interface Window {
  from: Date
  to: Date
}

/** Janelas de um ano do calendário (UTC), cortadas na criação da conta e em `now`. */
export function yearWindows(createdAt: Date, now: Date): (Window & { year: number })[] {
  const windows: (Window & { year: number })[] = []
  for (let year = createdAt.getUTCFullYear(); year <= now.getUTCFullYear(); year++) {
    const start = new Date(Date.UTC(year, 0, 1))
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59))
    const from = start < createdAt ? createdAt : start
    const to = end > now ? now : end
    if (from <= to) windows.push({ year, from, to })
  }
  return windows
}

/** Divide uma janela anual em trimestres (cada um com no máximo 92 dias). */
export function quarterWindows(window: Window): Window[] {
  const year = window.from.getUTCFullYear()
  const result: Window[] = []
  for (let quarter = 0; quarter < 4; quarter++) {
    const start = new Date(Date.UTC(year, quarter * 3, 1))
    const end = new Date(Date.UTC(year, quarter * 3 + 3, 0, 23, 59, 59))
    const from = start < window.from ? window.from : start
    const to = end > window.to ? window.to : end
    if (from <= to) result.push({ from, to })
  }
  return result
}

interface CommitDays {
  days: Record<string, number>
  /** Algum repositório tinha mais dias do que a página trouxe. */
  incomplete: boolean
  /** A lista bateu no limite de repositórios por período. */
  hitLimit: boolean
}

/** Soma commits públicos por dia. O dia vem da data de `occurredAt`. */
export function commitDays(entries: readonly CommitDaysByRepository[]): CommitDays {
  const days: Record<string, number> = {}
  let incomplete = false
  for (const entry of entries) {
    if (!entry.repository || entry.repository.isPrivate) continue
    const nodes = (entry.contributions.nodes ?? []).filter((node) => node !== null)
    if (entry.contributions.totalCount > nodes.length) incomplete = true
    for (const node of nodes) {
      const day = node.occurredAt.slice(0, 10)
      days[day] = (days[day] ?? 0) + Math.max(0, node.commitCount)
    }
  }
  return { days, incomplete, hitLimit: entries.length >= MAX_REPOSITORIES }
}

/** Soma contribuições de repositórios públicos. */
export function publicCount(entries: readonly CountByRepository[]): number {
  return entries.reduce(
    (sum, entry) =>
      entry.repository && !entry.repository.isPrivate ? sum + entry.contributions.totalCount : sum,
    0,
  )
}

function sortDays(days: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)))
}

function periodLabel(window: Window): string {
  return `${window.from.toISOString().slice(0, 10)}..${window.to.toISOString().slice(0, 10)}`
}

async function collectRepositories(
  options: CollectOptions,
  login: string,
): Promise<RepoLanguages[]> {
  const t = strings(options.lang)
  const maxPages = options.maxRepositoryPages ?? 10
  const repositories: RepoLanguages[] = []
  let cursor: string | null = null
  for (let page = 0; page < maxPages; page++) {
    const data: RepositoriesResponse = await options.client.graphql<RepositoriesResponse>(
      REPOSITORIES_QUERY,
      { login, cursor },
    )
    const connection = data.user?.repositories
    if (!connection) break
    for (const node of connection.nodes) {
      if (!node || node.isPrivate) continue
      repositories.push({
        name: node.name,
        languages: (node.languages?.edges ?? [])
          .filter((edge) => edge !== null)
          .map((edge) => ({ name: edge.node.name, color: edge.node.color, size: edge.size })),
      })
    }
    if (!connection.pageInfo.hasNextPage) return repositories
    cursor = connection.pageInfo.endCursor
  }
  if (cursor) options.warn?.(t.log.repositoriesTruncated(maxPages * 100))
  return repositories
}

async function collectYear(
  options: CollectOptions,
  login: string,
  window: Window & { year: number },
): Promise<YearActivity> {
  const t = strings(options.lang)
  const withPrivate = options.privateContributions === true
  const data = await options.client.graphql<YearResponse>(YEAR_QUERY, {
    login,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    withPrivate,
  })
  const collection = data.user?.contributionsCollection
  if (!collection) throw new CodornaCardError('not-found', t.errors.userNotFound(login))

  let commits = commitDays(collection.commitContributionsByRepository)
  if (commits.incomplete) {
    // Algum repositório teve mais de 100 dias de commit no ano: relê por trimestre.
    options.log?.(t.log.quarters(window.year))
    const quarters = quarterWindows(window)
    const variables: Record<string, string> = { login }
    quarters.forEach((quarter, i) => {
      variables[`from${i}`] = quarter.from.toISOString()
      variables[`to${i}`] = quarter.to.toISOString()
    })
    const result = await options.client.graphql<QuartersResponse>(
      quartersQuery(quarters.length),
      variables,
    )
    const days: Record<string, number> = {}
    let hitLimit = false
    quarters.forEach((quarter, i) => {
      const part = commitDays(result.user?.[`q${i}`]?.commitContributionsByRepository ?? [])
      for (const [day, count] of Object.entries(part.days)) days[day] = (days[day] ?? 0) + count
      if (part.hitLimit) {
        hitLimit = true
        options.warn?.(t.log.tooManyRepositories(periodLabel(quarter)))
      }
    })
    commits = { days, incomplete: false, hitLimit }
  } else if (commits.hitLimit) {
    options.warn?.(t.log.tooManyRepositories(periodLabel(window)))
  }

  for (const list of [
    collection.issueContributionsByRepository,
    collection.pullRequestContributionsByRepository,
    collection.pullRequestReviewContributionsByRepository,
  ]) {
    if (list.length >= MAX_REPOSITORIES)
      options.warn?.(t.log.tooManyRepositories(periodLabel(window)))
  }

  const year: YearActivity = {
    year: window.year,
    commitsByDay: sortDays(commits.days),
    issues: publicCount(collection.issueContributionsByRepository),
    pullRequests: publicCount(collection.pullRequestContributionsByRepository),
    reviews: publicCount(collection.pullRequestReviewContributionsByRepository),
  }
  if (withPrivate) {
    const restricted = Number(collection.restrictedContributionsCount ?? 0)
    year.privateContributions = Number.isFinite(restricted)
      ? Math.max(0, Math.floor(restricted))
      : 0
  }
  return year
}

/** Lê toda a atividade pública de uma pessoa pela API GraphQL. */
export async function collectPlayer(options: CollectOptions): Promise<PlayerData> {
  const t = strings(options.lang)
  const now = options.now ?? new Date()
  options.log?.(t.log.fetching(options.login))

  let profile: ProfileResponse
  try {
    profile = await options.client.graphql<ProfileResponse>(PROFILE_QUERY, {
      login: options.login,
      merged: `is:pr is:merged is:public author:${options.login}`,
      mergedElsewhere: `is:pr is:merged is:public author:${options.login} -user:${options.login}`,
    })
  } catch (error) {
    if (error instanceof CodornaCardError && error.code === 'not-found') {
      throw new CodornaCardError('not-found', t.errors.userNotFound(options.login))
    }
    throw error
  }
  const owner = profile.owner
  if (!owner) throw new CodornaCardError('not-found', t.errors.userNotFound(options.login))
  if (owner.__typename !== 'User' || !owner.createdAt) {
    throw new CodornaCardError('not-user', t.errors.isOrganization(owner.login))
  }
  const login = owner.login
  const createdAt = new Date(owner.createdAt)

  const repositories = await collectRepositories(options, login)
  options.log?.(t.log.repositories(repositories.length))

  const windows = yearWindows(createdAt, now)
  const first = windows[0]
  const last = windows[windows.length - 1]
  if (first && last) options.log?.(t.log.years(windows.length, first.year, last.year))
  const years: YearActivity[] = []
  for (const window of windows) years.push(await collectYear(options, login, window))

  if (options.privateContributions) {
    const total = years.reduce((sum, year) => sum + (year.privateContributions ?? 0), 0)
    if (total > 0) options.log?.(t.log.privateContributions(total))
    else options.warn?.(t.log.noPrivateContributions)
  }

  return {
    login,
    createdAt: owner.createdAt,
    years,
    mergedPullRequests: profile.merged.issueCount,
    mergedPullRequestsElsewhere: profile.mergedElsewhere.issueCount,
    repositories,
  }
}
