/**
 * API do GitHub de mentira para os testes: responde às consultas GraphQL do
 * Codorna Card (pelo nome da operação) e às chamadas REST usadas no commit.
 */

export interface FakeRepo {
  name: string
  isPrivate?: boolean
  languages: { name: string; color: string | null; size: number }[]
}

export interface FakeCommit {
  repo: string
  isPrivate?: boolean
  day: string
  count: number
}

export interface FakeYearly {
  year: number
  repo: string
  isPrivate?: boolean
  count: number
}

export interface FakeUser {
  login: string
  type?: 'User' | 'Organization'
  createdAt: string
  merged: number
  mergedElsewhere: number
  repositories: FakeRepo[]
  commits: FakeCommit[]
  issues?: FakeYearly[]
  pullRequests?: FakeYearly[]
  reviews?: FakeYearly[]
  /**
   * Contribuições privadas por ano, como o GitHub informa em `restrictedContributionsCount`
   * (zero quando a pessoa não liga "Private contributions" no perfil).
   */
  restricted?: { year: number; count: number }[]
}

export interface FakeFile {
  path: string
  sha: string
}

export interface FakeRepoState {
  branch: string
  headSha: string
  files: FakeFile[]
}

export interface Call {
  method: string
  url: string
  operation?: string
  body?: unknown
}

const RATE = { remaining: 4900, resetAt: '2026-11-02T13:00:00Z' }

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function inWindow(day: string, from: string, to: string): boolean {
  const time = Date.parse(`${day}T12:00:00Z`)
  return time >= Date.parse(from) && time <= Date.parse(to)
}

function commitList(user: FakeUser, from: string, to: string) {
  const byRepo = new Map<
    string,
    { isPrivate: boolean; nodes: { occurredAt: string; commitCount: number }[] }
  >()
  for (const commit of user.commits) {
    if (!inWindow(commit.day, from, to)) continue
    const entry = byRepo.get(commit.repo) ?? { isPrivate: commit.isPrivate ?? false, nodes: [] }
    entry.nodes.push({ occurredAt: `${commit.day}T07:00:00Z`, commitCount: commit.count })
    byRepo.set(commit.repo, entry)
  }
  return [...byRepo.values()].slice(0, 100).map((entry) => ({
    repository: { isPrivate: entry.isPrivate },
    contributions: { totalCount: entry.nodes.length, nodes: entry.nodes.slice(0, 100) },
  }))
}

function yearlyList(list: FakeYearly[] | undefined, from: string) {
  const year = new Date(from).getUTCFullYear()
  return (list ?? [])
    .filter((entry) => entry.year === year)
    .map((entry) => ({
      repository: { isPrivate: entry.isPrivate ?? false },
      contributions: { totalCount: entry.count },
    }))
}

export interface FakeOptions {
  user?: FakeUser | null
  repo?: FakeRepoState
  /** Respostas forçadas, consumidas em ordem antes do comportamento normal. */
  queue?: (() => Response | Promise<Response>)[]
}

export function fakeGitHub(options: FakeOptions) {
  const calls: Call[] = []
  const queue = [...(options.queue ?? [])]
  const repoState = options.repo

  const handler = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const operation = body?.query ? /query (\w+)/.exec(body.query)?.[1] : undefined
    calls.push({ method, url, operation, body })

    const forced = queue.shift()
    if (forced) return forced()

    if (url.endsWith('/graphql')) {
      const user = options.user ?? null
      const vars = body.variables as Record<string, string>
      switch (operation) {
        case 'CodornaProfile':
          return json(200, {
            data: {
              rateLimit: RATE,
              owner: user
                ? {
                    __typename: user.type ?? 'User',
                    login: user.login,
                    ...(user.type === 'Organization' ? {} : { createdAt: user.createdAt }),
                  }
                : null,
              merged: { issueCount: user?.merged ?? 0 },
              mergedElsewhere: { issueCount: user?.mergedElsewhere ?? 0 },
            },
          })
        case 'CodornaRepositories': {
          const page = Number(vars.cursor ?? 0)
          const repos = user?.repositories ?? []
          const slice = repos.slice(page * 100, page * 100 + 100)
          const hasNextPage = (page + 1) * 100 < repos.length
          return json(200, {
            data: {
              rateLimit: RATE,
              user: {
                repositories: {
                  pageInfo: { hasNextPage, endCursor: hasNextPage ? String(page + 1) : null },
                  nodes: slice.map((repo) => ({
                    name: repo.name,
                    isPrivate: repo.isPrivate ?? false,
                    languages: {
                      edges: repo.languages.map((lang) => ({
                        size: lang.size,
                        node: { name: lang.name, color: lang.color },
                      })),
                    },
                  })),
                },
              },
            },
          })
        }
        case 'CodornaYear': {
          if (!user) return json(200, { data: { rateLimit: RATE, user: null } })
          // Como o @include(if: $withPrivate) da consulta: o campo só vem quando pedido.
          const withPrivate = (body.variables as Record<string, unknown>).withPrivate === true
          const year = new Date(vars.from!).getUTCFullYear()
          const restricted = (user.restricted ?? [])
            .filter((entry) => entry.year === year)
            .reduce((sum, entry) => sum + entry.count, 0)
          return json(200, {
            data: {
              rateLimit: RATE,
              user: {
                contributionsCollection: {
                  ...(withPrivate ? { restrictedContributionsCount: restricted } : {}),
                  commitContributionsByRepository: commitList(user, vars.from!, vars.to!),
                  issueContributionsByRepository: yearlyList(user.issues, vars.from!),
                  pullRequestContributionsByRepository: yearlyList(user.pullRequests, vars.from!),
                  pullRequestReviewContributionsByRepository: yearlyList(user.reviews, vars.from!),
                },
              },
            },
          })
        }
        case 'CodornaQuarters': {
          if (!user) return json(200, { data: { rateLimit: RATE, user: null } })
          const result: Record<string, unknown> = {}
          for (let i = 0; vars[`from${i}`]; i++) {
            result[`q${i}`] = {
              commitContributionsByRepository: commitList(user, vars[`from${i}`]!, vars[`to${i}`]!),
            }
          }
          return json(200, { data: { rateLimit: RATE, user: result } })
        }
        default:
          return json(400, { message: `operação desconhecida: ${operation}` })
      }
    }

    // REST (commit)
    if (!repoState) return json(404, { message: 'Not Found' })
    const path = new URL(url).pathname
    const refMatch = /\/git\/ref\/heads\/(.+)$/.exec(path)
    if (method === 'GET' && refMatch) {
      if (decodeURIComponent(refMatch[1]!) !== repoState.branch)
        return json(404, { message: 'Not Found' })
      return json(200, { object: { sha: repoState.headSha } })
    }
    const contentsMatch = /\/contents\/(.+)$/.exec(path)
    if (method === 'GET' && contentsMatch) {
      const file = repoState.files.find((f) => f.path === decodeURIComponent(contentsMatch[1]!))
      return file ? json(200, { type: 'file', sha: file.sha }) : json(404, { message: 'Not Found' })
    }
    if (method === 'GET' && /\/git\/commits\/\w+$/.test(path))
      return json(200, { tree: { sha: 'tree-base' } })
    if (method === 'POST' && path.endsWith('/git/trees')) return json(201, { sha: 'tree-new' })
    if (method === 'POST' && path.endsWith('/git/commits'))
      return json(201, { sha: 'c0ffee1234567890' })
    if (method === 'PATCH' && /\/git\/refs\/heads\//.test(path)) {
      repoState.headSha = String(body.sha)
      return json(200, { object: { sha: body.sha } })
    }
    return json(404, { message: 'Not Found' })
  }

  return { fetch: handler as typeof fetch, calls }
}

/** Usuário de exemplo pequeno para os testes de coleta. */
export function sampleUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    login: 'Pixel-Dev',
    createdAt: '2024-05-10T12:00:00Z',
    merged: 7,
    mergedElsewhere: 2,
    repositories: [
      {
        name: 'forja',
        languages: [
          { name: 'Rust', color: '#dea584', size: 9000 },
          { name: 'Shell', color: '#89e051', size: 1000 },
        ],
      },
      { name: 'site', languages: [{ name: 'TypeScript', color: '#3178c6', size: 5000 }] },
      {
        name: 'segredo',
        isPrivate: true,
        languages: [{ name: 'Go', color: '#00ADD8', size: 9999 }],
      },
    ],
    commits: [
      { repo: 'forja', day: '2024-06-01', count: 3 },
      { repo: 'site', day: '2024-06-01', count: 12 },
      { repo: 'forja', day: '2025-01-15', count: 4 },
      { repo: 'privado', isPrivate: true, day: '2025-01-16', count: 50 },
    ],
    issues: [
      { year: 2024, repo: 'forja', count: 2 },
      { year: 2025, repo: 'privado', isPrivate: true, count: 9 },
    ],
    pullRequests: [{ year: 2025, repo: 'forja', count: 5 }],
    reviews: [{ year: 2025, repo: 'site', count: 3 }],
    ...overrides,
  }
}
