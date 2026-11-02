/**
 * API do GitHub de mentira para os testes: responde às consultas GraphQL do
 * Codorna Card (pelo nome da operação) e às chamadas REST usadas no commit.
 *
 * O modo completo (`private-token`) responde conforme o token: só o `privateToken` enxerga os
 * repositórios e itens privados. Para provar que nada privado vaza, as respostas privadas trazem
 * nomes de repositório, de dono, de branch, mensagens e títulos mesmo quando a consulta não os
 * pede, e os erros de acesso citam a organização, como o GitHub faz nas restrições de OAuth App.
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
  /** O mesmo número visto pelo private-token: só o que nem ele enxerga. */
  restrictedBeyondToken?: { year: number; count: number }[]
  /** Id (nó GraphQL) da pessoa. Padrão: `U_<login>`. */
  id?: string
  /** Repositórios privados que o private-token enxerga (na ordem da lista). */
  privateRepos?: FakePrivateRepo[]
  /** Issues e PRs em repositórios privados, para as buscas com `is:private`. */
  privateItems?: FakePrivateItem[]
}

export interface FakePrivateCommit {
  day: string
  count: number
  /** `other`: commit de outra pessoa no mesmo repositório. */
  author?: 'self' | 'other'
  /** Ids fixos, para testar o mesmo commit em dois repositórios. */
  oids?: string[]
}

export interface FakePrivateRepo {
  id: string
  /** Nome secreto: não pode aparecer em lugar nenhum. */
  name: string
  /** `self`: repositório da pessoa; `other`: de uma organização ou de outra pessoa. */
  owner: 'self' | 'other'
  /** Nome secreto do dono (organização ou pessoa). */
  ownerName?: string
  /** Nome secreto da branch padrão. */
  branch?: string
  isFork?: boolean
  /** Simula a API ignorando o filtro `privacy: PRIVATE`. */
  isPublic?: boolean
  /** Sem branch padrão (repositório vazio). */
  empty?: boolean
  /**
   * `sso`: organização com SAML SSO e token não autorizado; `oauth`: organização com restrição
   * de OAuth App (o erro cita o nome dela); `forbidden`: a lista vem, mas sem acesso ao resto;
   * `history`: lista ok, mas sem acesso ao conteúdo (commits).
   */
  access?: 'ok' | 'sso' | 'oauth' | 'forbidden' | 'history'
  languages: { name: string; color: string | null; size: number }[]
  commits: FakePrivateCommit[]
}

export interface FakePrivateItem {
  kind: 'issue' | 'pr'
  /** Data de criação (AAAA-MM-DD). */
  created: string
  /** Título secreto. */
  title: string
  author?: 'self' | 'other'
  merged?: boolean
  reviewedBySelf?: boolean
  /** Dono do repositório: a própria pessoa ou outra (organização ou pessoa). */
  repoOwner?: 'self' | 'other'
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
  /** Token do cabeçalho Authorization. */
  token?: string
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
  /** Resposta forçada escolhida por chamada (ex.: só na terceira consulta de histórico). */
  intercept?: (call: Call, calls: readonly Call[]) => Response | undefined
  /** Token que enxerga os repositórios privados (o private-token). */
  privateToken?: string
  /** Login do dono do private-token. Padrão: o da pessoa. */
  privateViewer?: string
}

const SAML_MESSAGE =
  'Resource protected by organization SAML enforcement. You must grant your Personal Access token access to this organization.'
const oauthMessage = (org: string) =>
  `Although you appear to have the correct authorization credentials, the \`${org}\` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited.`

/** Commits de um repositório privado, do mais novo para o mais velho. */
function privateCommits(repo: FakePrivateRepo) {
  const list: { oid: string; authoredDate: string; author: 'self' | 'other'; message: string }[] =
    []
  for (const commit of repo.commits) {
    for (let i = 0; i < commit.count; i++) {
      list.push({
        oid: commit.oids?.[i] ?? `${repo.id}-${commit.day}-${commit.author ?? 'self'}-${i}`,
        authoredDate: `${commit.day}T${String(10 + (i % 12)).padStart(2, '0')}:00:00Z`,
        author: commit.author ?? 'self',
        message: `mensagem-secreta do ${repo.name} na ${repo.branch ?? 'main'}`,
      })
    }
  }
  return list.sort((a, b) => b.authoredDate.localeCompare(a.authoredDate))
}

/** Avalia a busca do GitHub (só os qualificadores que o Codorna Card usa). */
function searchCount(items: readonly FakePrivateItem[], query: string, login: string): number {
  const same = (value: string) => value.toLowerCase() === login.toLowerCase()
  return items.filter((item) => {
    for (const token of query.split(/\s+/).filter(Boolean)) {
      const [key, ...rest] = token.split(':')
      const value = rest.join(':')
      if (token === 'is:pr' && item.kind !== 'pr') return false
      if (token === 'is:issue' && item.kind !== 'issue') return false
      if (token === 'is:public') return false // os itens daqui são todos privados
      if (token === 'is:merged' && !item.merged) return false
      if (key === 'author' && !(same(value) && (item.author ?? 'self') === 'self')) return false
      if (key === '-author' && same(value) && (item.author ?? 'self') === 'self') return false
      if (key === 'reviewed-by' && !(same(value) && item.reviewedBySelf)) return false
      if (key === '-user' && same(value) && (item.repoOwner ?? 'self') === 'self') return false
      if (key === 'created') {
        const [from, to] = value.split('..')
        const time = Date.parse(`${item.created}T12:00:00Z`)
        if (time < Date.parse(from!) || time > Date.parse(to!)) return false
      }
    }
    return true
  }).length
}

export function fakeGitHub(options: FakeOptions) {
  const calls: Call[] = []
  const queue = [...(options.queue ?? [])]
  const repoState = options.repo

  const handler = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const operation = body?.query ? /(?:query|mutation) (\w+)/.exec(body.query)?.[1] : undefined
    const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization
    const token = authorization?.replace(/^Bearer /, '')
    const call: Call = { method, url, operation, body, token }
    calls.push(call)

    const forced = queue.shift()
    if (forced) return forced()
    const intercepted = options.intercept?.(call, calls)
    if (intercepted) return intercepted

    if (url.endsWith('/graphql')) {
      const user = options.user ?? null
      const vars = body.variables as Record<string, string>
      const seesPrivate = Boolean(options.privateToken) && token === options.privateToken
      const userId = user?.id ?? `U_${user?.login ?? 'ninguem'}`
      const privateItems = seesPrivate ? (user?.privateItems ?? []) : []
      const privateRepos = seesPrivate ? (user?.privateRepos ?? []) : []
      switch (operation) {
        case 'CodornaPrivateProfile': {
          const viewerLogin = options.privateViewer ?? user?.login ?? 'alguem'
          const same = viewerLogin.toLowerCase() === (user?.login ?? '').toLowerCase()
          return json(200, {
            data: {
              rateLimit: RATE,
              viewer: { id: same ? userId : 'U_outra-conta', login: viewerLogin },
              merged: { issueCount: searchCount(privateItems, vars.merged!, viewerLogin) },
              mergedElsewhere: {
                issueCount: searchCount(privateItems, vars.mergedElsewhere!, viewerLogin),
              },
            },
          })
        }
        case 'CodornaPrivateRepositories': {
          const page = Number(vars.cursor ?? 0)
          const slice = privateRepos.slice(page * 100, page * 100 + 100)
          const hasNextPage = (page + 1) * 100 < privateRepos.length
          const errors: unknown[] = []
          const nodes = slice.map((repo, index) => {
            const path = ['viewer', 'repositories', 'nodes', index]
            const access = repo.access ?? 'ok'
            if (access === 'sso') {
              errors.push({
                type: 'FORBIDDEN',
                path,
                extensions: { saml_failure: true },
                message: `${SAML_MESSAGE} (${repo.ownerName ?? 'org'})`,
              })
              return null
            }
            if (access === 'oauth') {
              errors.push({
                type: 'FORBIDDEN',
                path,
                message: oauthMessage(repo.ownerName ?? 'org'),
              })
              return null
            }
            const leaky = {
              id: repo.id,
              // Campos que o Codorna Card não pede, mas que provam que nada disso vaza.
              name: repo.name,
              nameWithOwner: `${repo.ownerName ?? user?.login}/${repo.name}`,
              url: `https://github.com/${repo.ownerName ?? user?.login}/${repo.name}`,
              defaultBranchRef: { name: repo.branch ?? 'main' },
              isPrivate: !repo.isPublic,
              isFork: repo.isFork ?? false,
              owner: {
                id: repo.owner === 'self' ? userId : `O_${repo.ownerName ?? 'outra'}`,
                login: repo.ownerName ?? user?.login,
              },
            }
            if (access === 'forbidden') {
              errors.push({
                type: 'FORBIDDEN',
                path: [...path, 'languages'],
                message: `Resource not accessible by personal access token (${repo.name})`,
              })
              return { ...leaky, languages: null }
            }
            return {
              ...leaky,
              languages: {
                edges: repo.languages.map((lang) => ({
                  size: lang.size,
                  node: { name: lang.name, color: lang.color },
                })),
              },
            }
          })
          return json(200, {
            data: {
              rateLimit: RATE,
              viewer: {
                repositories: {
                  pageInfo: { hasNextPage, endCursor: hasNextPage ? String(page + 1) : null },
                  nodes,
                },
              },
            },
            ...(errors.length > 0 ? { errors } : {}),
          })
        }
        case 'CodornaPrivateHistory': {
          const repo = privateRepos.find((entry) => entry.id === vars.id)
          if (!repo) return json(200, { data: { rateLimit: RATE, node: null } })
          if (repo.access === 'history') {
            return json(200, {
              data: { rateLimit: RATE, node: { defaultBranchRef: null } },
              errors: [
                {
                  type: 'FORBIDDEN',
                  path: ['node', 'defaultBranchRef'],
                  message: `Resource not accessible by personal access token (${repo.name})`,
                },
              ],
            })
          }
          if (repo.empty) {
            return json(200, { data: { rateLimit: RATE, node: { defaultBranchRef: null } } })
          }
          const since = Date.parse(vars.since!)
          const until = Date.parse(vars.until!)
          const mine = privateCommits(repo).filter(
            (commit) =>
              (vars.author === userId ? commit.author === 'self' : false) &&
              Date.parse(commit.authoredDate) >= since &&
              Date.parse(commit.authoredDate) <= until,
          )
          const offset = Number(vars.cursor ?? 0)
          const page = mine.slice(offset, offset + 100)
          const hasNextPage = offset + 100 < mine.length
          return json(200, {
            data: {
              rateLimit: RATE,
              node: {
                name: repo.name,
                defaultBranchRef: {
                  name: repo.branch ?? 'main',
                  target: {
                    history: {
                      totalCount: mine.length,
                      pageInfo: {
                        hasNextPage,
                        endCursor: hasNextPage ? String(offset + 100) : null,
                      },
                      nodes: page,
                    },
                  },
                },
              },
            },
          })
        }
        case 'CodornaPrivateYear': {
          const raw = body.variables as Record<string, unknown>
          const year = new Date(vars.from!).getUTCFullYear()
          const restricted = (user?.restrictedBeyondToken ?? [])
            .filter((entry) => entry.year === year)
            .reduce((sum, entry) => sum + entry.count, 0)
          const login = user?.login ?? ''
          return json(200, {
            data: {
              rateLimit: RATE,
              ...(raw.withRestricted === true
                ? {
                    user: {
                      contributionsCollection: { restrictedContributionsCount: restricted },
                    },
                  }
                : {}),
              issues: { issueCount: searchCount(privateItems, vars.issues!, login) },
              pullRequests: { issueCount: searchCount(privateItems, vars.pullRequests!, login) },
              reviews: { issueCount: searchCount(privateItems, vars.reviews!, login) },
              // Títulos que ninguém pediu, só para provar que não vazam.
              nodes: privateItems.map((item) => ({ title: item.title })),
            },
          })
        }
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

/** Nomes secretos usados nos dados privados de exemplo. Nenhum pode aparecer em saída alguma. */
export const SECRET_NAMES = [
  'repo-ultrassecreto',
  'cofre-da-firma',
  'app-da-org',
  'org-secreta-ltda',
  'org-com-sso',
  'branch-secreta',
  'mensagem-secreta',
  'titulo-secreto',
  'colega-secreto',
] as const

/** Modo completo de exemplo: repositórios privados de todo tipo, com nomes secretos. */
export function privateSample(): Pick<
  FakeUser,
  'privateRepos' | 'privateItems' | 'restrictedBeyondToken'
> {
  return {
    privateRepos: [
      {
        id: 'R_1',
        name: 'repo-ultrassecreto',
        owner: 'self',
        branch: 'branch-secreta',
        languages: [{ name: 'TypeScript', color: '#3178c6', size: 50_000 }],
        commits: [
          { day: '2025-01-15', count: 3 }, // no mesmo dia de 4 commits públicos
          { day: '2025-03-01', count: 25 }, // passa do teto diário
          { day: '2025-03-01', count: 7, author: 'other' },
          { day: '2026-02-10', count: 2, oids: ['shared-1', 'shared-2'] },
        ],
      },
      {
        id: 'R_2',
        name: 'cofre-da-firma',
        owner: 'other',
        ownerName: 'org-secreta-ltda',
        branch: 'branch-secreta',
        languages: [{ name: 'Python', color: '#3572A5', size: 80_000 }],
        commits: [
          { day: '2026-02-10', count: 2, oids: ['shared-1', 'shared-2'] }, // os mesmos dois
          { day: '2026-06-01', count: 4 },
        ],
      },
      {
        id: 'R_3',
        name: 'app-da-org',
        owner: 'other',
        ownerName: 'org-com-sso',
        access: 'sso',
        languages: [{ name: 'Kotlin', color: '#A97BFF', size: 1000 }],
        commits: [{ day: '2026-01-05', count: 9 }],
      },
      {
        id: 'R_4',
        name: 'repo-ultrassecreto-oauth',
        owner: 'other',
        ownerName: 'org-secreta-ltda',
        access: 'oauth',
        languages: [],
        commits: [{ day: '2026-01-06', count: 9 }],
      },
      {
        id: 'R_5',
        name: 'repo-ultrassecreto-sem-conteudo',
        owner: 'self',
        access: 'history',
        languages: [{ name: 'Haskell', color: null, size: 99_999 }],
        commits: [{ day: '2026-01-07', count: 9 }],
      },
      {
        id: 'R_6',
        name: 'repo-ultrassecreto-fork',
        owner: 'self',
        isFork: true,
        languages: [{ name: 'Ruby', color: null, size: 99_999 }],
        commits: [{ day: '2026-01-08', count: 9 }],
      },
      {
        id: 'R_7',
        name: 'repo-ultrassecreto-vazio',
        owner: 'self',
        empty: true,
        languages: [],
        commits: [],
      },
    ],
    privateItems: [
      { kind: 'pr', created: '2025-02-01', title: 'titulo-secreto 1', merged: true },
      {
        kind: 'pr',
        created: '2025-02-02',
        title: 'titulo-secreto 2',
        merged: true,
        repoOwner: 'other',
      },
      { kind: 'pr', created: '2026-03-01', title: 'titulo-secreto 3' },
      {
        kind: 'pr',
        created: '2026-03-02',
        title: 'titulo-secreto 4',
        author: 'other',
        reviewedBySelf: true,
      },
      { kind: 'pr', created: '2026-03-03', title: 'titulo-secreto 5', reviewedBySelf: true }, // o próprio PR
      {
        kind: 'pr',
        created: '2026-03-04',
        title: 'titulo-secreto colega-secreto',
        author: 'other',
      },
      { kind: 'issue', created: '2026-04-01', title: 'titulo-secreto 6' },
      { kind: 'issue', created: '2023-04-01', title: 'titulo-secreto 7' }, // antes da conta
    ],
    restrictedBeyondToken: [{ year: 2026, count: 5 }],
  }
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
