/**
 * Modo completo: conta o trabalho em repositórios privados com o `private-token`, direto nos
 * repositórios, com as mesmas regras do público.
 *
 * Privacidade, regra dura: as consultas não pedem nenhum nome (repositório, dono, branch),
 * mensagem, título ou URL, e daqui só saem números e nomes de linguagem. Logs e avisos levam só
 * quantidades. Erros da API chegam sem o texto original (o cliente do token usa `redact`).
 */
import { strings } from '../i18n'
import type { AnonymousRepo, Lang, PrivateActivity, PrivateYearActivity } from '../types'
import type { GitHubClient, PartialError } from './client'
import { CodornaCardError } from './errors'
import {
  PRIVATE_HISTORY_QUERY,
  PRIVATE_PROFILE_QUERY,
  PRIVATE_REPOSITORIES_QUERY,
  PRIVATE_YEAR_QUERY,
  type PrivateHistoryResponse,
  type PrivateProfileResponse,
  type PrivateRepositoriesResponse,
  type PrivateYearResponse,
} from './private-queries'

export interface PrivateWindow {
  year: number
  from: Date
  to: Date
}

export interface PrivateCollectOptions {
  /** Cliente do `private-token` (só leitura e com `redact`). */
  client: GitHubClient
  /** Login da pessoa do card, como a API pública devolveu. */
  login: string
  lang: Lang
  /** Criação da conta: commits antes disso não contam (como no público). */
  createdAt: Date
  now: Date
  /** Os mesmos anos do fluxo público. */
  windows: readonly PrivateWindow[]
  /** Lê também o `restrictedContributionsCount` com este token (`private-contributions`). */
  restricted: boolean
  log?: (message: string) => void
  warn?: (message: string) => void
  /** Páginas de 100 repositórios privados lidas no máximo (padrão 10 = 1.000). */
  maxRepositoryPages?: number
  /** Páginas de 100 commits lidas por repositório no máximo (padrão 100 = 10.000 commits). */
  maxHistoryPages?: number
}

export interface PrivateCollection {
  /** Atividade privada de cada ano das janelas (anos sem nada vêm zerados). */
  years: Map<number, PrivateYearActivity>
  /** `restrictedContributionsCount` visto pelo token, por ano (só com `restricted`). */
  restricted: Map<number, number>
  totals: PrivateActivity
}

interface Candidate {
  id: string
  own: boolean
  languages: AnonymousRepo['languages']
}

type SkipKind = 'sso' | 'forbidden'

/** Data e hora no formato das buscas do GitHub (`2026-01-01T00:00:00+00:00`). */
function searchDate(date: Date): string {
  return `${date.toISOString().slice(0, 19)}+00:00`
}

function count(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Erros parciais que caem dentro de `nodes[index]` da lista de repositórios. */
function errorsAt(errors: readonly PartialError[], index: number): PartialError[] {
  return errors.filter(
    (error) =>
      error.path[0] === 'viewer' &&
      error.path[1] === 'repositories' &&
      error.path[2] === 'nodes' &&
      error.path[3] === index,
  )
}

const skipKind = (errors: readonly PartialError[]): SkipKind =>
  errors.some((error) => error.kind === 'sso') ? 'sso' : 'forbidden'

export async function collectPrivate(options: PrivateCollectOptions): Promise<PrivateCollection> {
  const t = strings(options.lang)
  const { client, login } = options
  const maxRepositoryPages = options.maxRepositoryPages ?? 10
  const maxHistoryPages = options.maxHistoryPages ?? 100
  options.log?.(t.log.privateStart)

  // Erros de autenticação do token viram mensagens que falam do private-token.
  const guard = async <T>(call: () => Promise<T>): Promise<T> => {
    try {
      return await call()
    } catch (error) {
      if (error instanceof CodornaCardError && error.code === 'auth') {
        throw new CodornaCardError('auth', t.errors.privateTokenRejected)
      }
      if (error instanceof CodornaCardError && error.code === 'forbidden') {
        throw new CodornaCardError('forbidden', t.errors.privateTokenForbidden)
      }
      throw error
    }
  }

  // 1. De quem é o token, e os PRs mesclados (a vida toda).
  const profile = await guard(() =>
    client.graphql<PrivateProfileResponse>(PRIVATE_PROFILE_QUERY, {
      merged: `is:pr is:merged is:private author:${login}`,
      mergedElsewhere: `is:pr is:merged is:private author:${login} -user:${login}`,
    }),
  )
  const viewer = profile.viewer
  if (!viewer || viewer.login.toLowerCase() !== login.toLowerCase()) {
    throw new CodornaCardError('input', t.errors.privateTokenOtherAccount(login))
  }

  // 2. Repositórios privados, sem forks, de 100 em 100.
  const candidates: Candidate[] = []
  const skipped: Record<SkipKind, number> = { sso: 0, forbidden: 0 }
  let cursor: string | null = null
  let truncated = false
  for (let page = 0; ; page++) {
    if (page >= maxRepositoryPages) {
      truncated = true
      break
    }
    const { data, errors }: { data: PrivateRepositoriesResponse; errors: PartialError[] } =
      await guard(() =>
        client.graphqlPartial<PrivateRepositoriesResponse>(PRIVATE_REPOSITORIES_QUERY, {
          cursor,
        }),
      )
    const connection = data.viewer?.repositories
    if (!connection) throw new CodornaCardError('forbidden', t.errors.privateListFailed)
    ;(connection.nodes ?? []).forEach((node, index) => {
      const nodeErrors = errorsAt(errors, index)
      if (nodeErrors.length > 0 || !node) {
        skipped[skipKind(nodeErrors)] += 1
        return
      }
      // Defesa extra: mesmo que a API ignore o filtro, público e fork nunca entram aqui.
      if (!node.isPrivate || node.isFork) return
      candidates.push({
        id: node.id,
        own: node.owner?.id === viewer.id,
        languages: (node.languages?.edges ?? [])
          .filter((edge) => edge !== null)
          .map((edge) => ({ name: edge.node.name, color: edge.node.color, size: edge.size })),
      })
    })
    if (!connection.pageInfo.hasNextPage) break
    cursor = connection.pageInfo.endCursor
  }
  if (truncated) options.warn?.(t.log.privateRepositoriesTruncated(maxRepositoryPages * 100))

  // 3. Commits de autoria da pessoa na branch padrão, um repositório de cada vez.
  const days: Record<string, number> = {}
  const seen = new Set<string>()
  const repositories: AnonymousRepo[] = []
  let scanned = 0
  let historyTruncated = 0
  const since = options.createdAt.toISOString()
  const until = options.now.toISOString()
  for (const candidate of candidates) {
    // O mesmo commit em dois repositórios privados (uma cópia, por exemplo) conta uma vez só.
    const found = new Map<string, string>()
    let failed: SkipKind | null = null
    let after: string | null = null
    for (let page = 0; ; page++) {
      if (page >= maxHistoryPages) {
        historyTruncated += 1
        break
      }
      const { data, errors }: { data: PrivateHistoryResponse; errors: PartialError[] } =
        await guard(() =>
          client.graphqlPartial<PrivateHistoryResponse>(PRIVATE_HISTORY_QUERY, {
            id: candidate.id,
            author: viewer.id,
            since,
            until,
            cursor: after,
          }),
        )
      if (errors.length > 0 || !data.node) {
        failed = skipKind(errors)
        break
      }
      const history = data.node.defaultBranchRef?.target?.history
      if (!history) break // repositório vazio
      for (const commit of history.nodes ?? []) {
        if (!commit) continue
        const authored = new Date(commit.authoredDate)
        if (Number.isNaN(authored.getTime())) continue
        if (authored < options.createdAt || authored > options.now) continue
        found.set(commit.oid, authored.toISOString().slice(0, 10))
      }
      if (!history.pageInfo.hasNextPage) break
      after = history.pageInfo.endCursor
    }
    if (failed) {
      skipped[failed] += 1
      continue
    }
    scanned += 1
    for (const [oid, day] of found) {
      if (seen.has(oid)) continue
      seen.add(oid)
      days[day] = (days[day] ?? 0) + 1
    }
    if (candidate.own) repositories.push({ languages: candidate.languages })
  }

  // 4. Issues, PRs abertos e reviews por ano (e as anônimas que nem este token vê).
  const years = new Map<number, PrivateYearActivity>()
  const restricted = new Map<number, number>()
  for (const window of options.windows) {
    const range = `created:${searchDate(window.from)}..${searchDate(window.to)}`
    const data = await guard(() =>
      client.graphql<PrivateYearResponse>(PRIVATE_YEAR_QUERY, {
        login,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        withRestricted: options.restricted,
        issues: `is:issue is:private author:${login} ${range}`,
        pullRequests: `is:pr is:private author:${login} ${range}`,
        reviews: `is:pr is:private reviewed-by:${login} -author:${login} ${range}`,
      }),
    )
    const prefix = String(window.year)
    years.set(window.year, {
      commitsByDay: Object.fromEntries(
        Object.entries(days)
          .filter(([day]) => day.startsWith(prefix))
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
      issues: count(data.issues.issueCount),
      pullRequests: count(data.pullRequests.issueCount),
      reviews: count(data.reviews.issueCount),
    })
    if (options.restricted) {
      restricted.set(
        window.year,
        count(data.user?.contributionsCollection.restrictedContributionsCount),
      )
    }
  }

  // 5. Só quantidades nos logs.
  const skippedTotal = skipped.sso + skipped.forbidden
  if (scanned === 0 && skippedTotal === 0) options.warn?.(t.log.privateNone)
  else options.log?.(t.log.privateRepositories(scanned, repositories.length))
  if (skippedTotal > 0) options.warn?.(t.log.privateSkipped(skipped.sso, skipped.forbidden))
  if (historyTruncated > 0)
    options.warn?.(t.log.privateHistoryTruncated(historyTruncated, maxHistoryPages * 100))
  const sum = (pick: (year: PrivateYearActivity) => number) =>
    [...years.values()].reduce((total, year) => total + pick(year), 0)
  const merged = count(profile.merged.issueCount)
  options.log?.(
    t.log.privateTotals({
      commits: Object.values(days).reduce((total, n) => total + n, 0),
      pullRequests: sum((year) => year.pullRequests),
      merged,
      reviews: sum((year) => year.reviews),
      issues: sum((year) => year.issues),
    }),
  )
  if (options.restricted) {
    const total = [...restricted.values()].reduce((a, b) => a + b, 0)
    options.log?.(t.log.restrictedBeyondToken(total))
  }

  return {
    years,
    restricted,
    totals: {
      mergedPullRequests: merged,
      mergedPullRequestsElsewhere: Math.min(count(profile.mergedElsewhere.issueCount), merged),
      repositories,
      scannedRepositories: scanned,
      skippedRepositories: skippedTotal,
    },
  }
}
