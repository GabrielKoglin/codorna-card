import { describe, expect, it } from 'vitest'
import { GitHubClient } from '../src/github/client'
import { collectPlayer } from '../src/github/collect'
import { CodornaCardError } from '../src/github/errors'
import * as privateQueries from '../src/github/private-queries'
import {
  fakeGitHub,
  privateSample,
  sampleUser,
  SECRET_NAMES,
  type FakeOptions,
  type FakeUser,
} from './helpers/fake-github'

const NOW = new Date('2026-11-02T12:00:00Z')
const PRIVATE_TOKEN = 'ghp_TOKENPRIVADOdeTESTE123'

function fullUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return sampleUser({ ...privateSample(), ...overrides })
}

async function collect(
  user: FakeUser,
  extra: {
    privateContributions?: boolean
    fake?: Partial<FakeOptions>
    maxHistoryPages?: number
  } = {},
) {
  const fake = fakeGitHub({ user, privateToken: PRIVATE_TOKEN, ...extra.fake })
  const sleeps: number[] = []
  const common = {
    lang: 'pt-BR' as const,
    fetch: fake.fetch,
    sleep: async (ms: number) => {
      sleeps.push(ms)
    },
  }
  const client = new GitHubClient({ token: 'gh-actions', ...common })
  const privateClient = new GitHubClient({
    token: PRIVATE_TOKEN,
    redact: true,
    readOnly: true,
    ...common,
  })
  const logs: string[] = []
  const warnings: string[] = []
  const data = await collectPlayer({
    client,
    privateClient,
    login: 'pixel-dev',
    lang: 'pt-BR',
    now: NOW,
    privateContributions: extra.privateContributions,
    maxHistoryPages: extra.maxHistoryPages,
    log: (m) => logs.push(m),
    warn: (m) => warnings.push(m),
  })
  return { data, calls: fake.calls, logs, warnings, sleeps }
}

async function failure(promise: Promise<unknown>): Promise<CodornaCardError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof CodornaCardError) return error
    throw error
  }
  throw new Error('era para falhar')
}

function expectNoSecrets(text: string): void {
  for (const secret of SECRET_NAMES) expect(text, secret).not.toContain(secret)
  expect(text).not.toContain(PRIVATE_TOKEN)
}

describe('modo completo: coleta com o private-token', () => {
  it('conta commits, PRs, issues e reviews dos repositórios privados', async () => {
    const { data } = await collect(fullUser())
    const byYear = Object.fromEntries(data.years.map((year) => [year.year, year]))
    expect(byYear[2024]?.private).toEqual({
      commitsByDay: {},
      issues: 0,
      pullRequests: 0,
      reviews: 0,
    })
    // Só os commits da pessoa: os 7 de outra pessoa no mesmo dia ficam de fora.
    expect(byYear[2025]?.private).toEqual({
      commitsByDay: { '2025-01-15': 3, '2025-03-01': 25 },
      issues: 0,
      pullRequests: 2,
      reviews: 0,
    })
    // 2026-02-10: os mesmos dois commits estão em dois repositórios e contam uma vez.
    // Reviews: só PR de outra pessoa (o review no próprio PR não conta).
    expect(byYear[2026]?.private).toEqual({
      commitsByDay: { '2026-02-10': 2, '2026-06-01': 4 },
      issues: 1,
      pullRequests: 2,
      reviews: 1,
    })
    expect(data.private).toEqual({
      mergedPullRequests: 2,
      mergedPullRequestsElsewhere: 1,
      // Só os repositórios próprios lidos: o da organização, os pulados e o fork ficam de fora.
      repositories: [
        { languages: [{ name: 'TypeScript', color: '#3178c6', size: 50_000 }] },
        { languages: [] },
      ],
      scannedRepositories: 3,
      skippedRepositories: 3,
    })
    // O público continua igual: os privados que aparecem na lista pública seguem descartados.
    expect(byYear[2025]?.commitsByDay).toEqual({ '2025-01-15': 4 })
    expect(byYear[2025]?.issues).toBe(0)
  })

  it('nenhum nome privado entra nos dados, nos logs ou nos avisos', async () => {
    const { data, logs, warnings } = await collect(fullUser(), { privateContributions: true })
    expectNoSecrets(JSON.stringify(data))
    expectNoSecrets([...logs, ...warnings].join('\n'))
    // As linguagens de repositórios pulados, de fork e de organização também não entram.
    const languages = JSON.stringify(data.private?.repositories)
    for (const lang of ['Haskell', 'Ruby', 'Kotlin', 'Python'])
      expect(languages).not.toContain(lang)
  })

  it('avisa só a quantidade de repositórios pulados por SSO ou sem acesso', async () => {
    const { logs, warnings } = await collect(fullUser())
    expect(warnings).toContain(
      '3 repositórios privados pulados (1 em organização com SAML SSO sem o token autorizado; 2 sem acesso pelo token). Por privacidade, os nomes não aparecem.',
    )
    expect(logs).toContain('3 repositórios privados lidos; 2 são seus e entram nas linguagens.')
    expect(logs).toContain(
      'Privado (só totais): 34 commits, 4 PRs abertos (2 mesclados), 1 review e 1 issue.',
    )
  })

  it('as consultas privadas usam só o private-token e as públicas só o token', async () => {
    const { calls } = await collect(fullUser())
    for (const call of calls) {
      expect(call.method).toBe('POST')
      expect(call.url).toBe('https://api.github.com/graphql')
      const isPrivate = call.operation?.startsWith('CodornaPrivate') ?? false
      expect(call.token, call.operation).toBe(isPrivate ? PRIVATE_TOKEN : 'gh-actions')
      expect((call.body as { query: string }).query).not.toMatch(/\bmutation\b/)
    }
    // Histórico: os dois lidos, o sem acesso ao conteúdo e o vazio (SSO e OAuth caem na lista).
    expect(calls.filter((c) => c.operation === 'CodornaPrivateHistory')).toHaveLength(4)
    expect(calls.filter((c) => c.operation === 'CodornaPrivateYear')).toHaveLength(3)
  })

  it('as buscas são só privadas, com o login certo e faixa de datas por ano', async () => {
    const { calls } = await collect(fullUser())
    const profile = calls.find((c) => c.operation === 'CodornaPrivateProfile')?.body as {
      variables: Record<string, string>
    }
    expect(profile.variables).toEqual({
      merged: 'is:pr is:merged is:private author:Pixel-Dev',
      mergedElsewhere: 'is:pr is:merged is:private author:Pixel-Dev -user:Pixel-Dev',
    })
    const year = calls.find((c) => c.operation === 'CodornaPrivateYear')?.body as {
      variables: Record<string, unknown>
    }
    const range = 'created:2024-05-10T12:00:00+00:00..2024-12-31T23:59:59+00:00'
    expect(year.variables).toMatchObject({
      issues: `is:issue is:private author:Pixel-Dev ${range}`,
      pullRequests: `is:pr is:private author:Pixel-Dev ${range}`,
      reviews: `is:pr is:private reviewed-by:Pixel-Dev -author:Pixel-Dev ${range}`,
      withRestricted: false,
    })
  })

  it('o restrictedContributionsCount é lido com o private-token (só o que nem ele vê)', async () => {
    const { data, calls, logs } = await collect(
      fullUser({ restricted: [{ year: 2026, count: 1500 }] }),
      { privateContributions: true },
    )
    for (const call of calls.filter((c) => c.operation === 'CodornaYear')) {
      expect((call.body as { variables: Record<string, unknown> }).variables.withPrivate).toBe(
        false,
      )
    }
    const year = calls.find((c) => c.operation === 'CodornaPrivateYear')?.body as {
      variables: Record<string, unknown>
    }
    expect(year.variables.withRestricted).toBe(true)
    // 5 (o que nem o private-token enxerga), e não os 1.500 que o GITHUB_TOKEN veria.
    expect(data.years.map((y) => y.privateContributions)).toEqual([0, 0, 5])
    expect(logs).toContain('Contribuições privadas anônimas que nem o private-token enxerga: 5.')
  })

  it('pagina repositórios e histórico de 100 em 100', async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `R_m${i}`,
      name: `repo-ultrassecreto-${i}`,
      owner: 'self' as const,
      languages: [{ name: 'Go', color: null, size: 2000 }],
      commits: i === 0 ? [{ day: '2026-05-05', count: 250 }] : [],
    }))
    const { data, calls } = await collect(fullUser({ privateRepos: many, privateItems: [] }))
    expect(calls.filter((c) => c.operation === 'CodornaPrivateRepositories')).toHaveLength(2)
    // 150 repositórios, sendo que o primeiro tem 250 commits: 3 páginas nele, 1 em cada outro.
    expect(calls.filter((c) => c.operation === 'CodornaPrivateHistory')).toHaveLength(152)
    expect(data.years.find((y) => y.year === 2026)?.private?.commitsByDay).toEqual({
      '2026-05-05': 250,
    })
    expect(data.private?.scannedRepositories).toBe(150)
    expect(data.private?.repositories).toHaveLength(150)
  })

  it('para no limite de páginas do histórico e avisa sem citar o repositório', async () => {
    const { data, warnings } = await collect(
      fullUser({
        privateRepos: [
          {
            id: 'R_big',
            name: 'repo-ultrassecreto-gigante',
            owner: 'self',
            languages: [],
            commits: [{ day: '2026-05-05', count: 250 }],
          },
        ],
      }),
      { maxHistoryPages: 2 },
    )
    expect(data.years.find((y) => y.year === 2026)?.private?.commitsByDay).toEqual({
      '2026-05-05': 200,
    })
    expect(warnings).toContain(
      '1 repositório privado tem mais de 200 commits seus: só os 200 mais recentes de cada um contam.',
    )
    expectNoSecrets(warnings.join('\n'))
  })

  it('token que não enxerga nenhum repositório privado: avisa e segue', async () => {
    const { data, warnings } = await collect(fullUser({ privateRepos: [], privateItems: [] }))
    expect(warnings.some((w) => w.startsWith('O private-token não enxerga nenhum'))).toBe(true)
    expect(data.private).toMatchObject({ scannedRepositories: 0, skippedRepositories: 0 })
  })
})

describe('modo completo: falhas sem vazar nada', () => {
  const rateLimited = () =>
    new Response('{"message":"API rate limit exceeded for org-secreta-ltda"}', {
      status: 403,
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Date.UTC(2026, 10, 2, 13, 45) / 1000),
      },
    })

  it('token de outra conta é recusado com mensagem clara', async () => {
    const error = await failure(collect(fullUser(), { fake: { privateViewer: 'outra-pessoa' } }))
    expect(error.code).toBe('input')
    expect(error.message).toBe(
      'O private-token não é da conta @Pixel-Dev. Use um token pessoal da própria pessoa do card (o GITHUB_TOKEN não serve).',
    )
  })

  it('token recusado (401) explica o que fazer', async () => {
    const error = await failure(
      collect(fullUser(), {
        fake: {
          intercept: (call) =>
            call.operation === 'CodornaPrivateProfile'
              ? new Response('{"message":"Bad credentials"}', { status: 401 })
              : undefined,
        },
      }),
    )
    expect(error.code).toBe('auth')
    expect(error.message).toContain('O GitHub recusou o private-token (401)')
  })

  it('token sem acesso nenhum (403) vira erro do private-token, sem o texto da API', async () => {
    const error = await failure(
      collect(fullUser(), {
        fake: {
          intercept: (call) =>
            call.operation === 'CodornaPrivateProfile'
              ? new Response('{"message":"org-secreta-ltda forbids access via a fine-grained"}', {
                  status: 403,
                })
              : undefined,
        },
      }),
    )
    expect(error.code).toBe('forbidden')
    expect(error.message).toContain('negou o acesso do private-token (403)')
    expectNoSecrets(error.message)
  })

  it('lista de repositórios negada por inteiro: erro claro', async () => {
    const error = await failure(
      collect(fullUser(), {
        fake: {
          intercept: (call) =>
            call.operation === 'CodornaPrivateRepositories'
              ? new Response(
                  JSON.stringify({
                    data: { viewer: { repositories: null } },
                    errors: [
                      {
                        type: 'FORBIDDEN',
                        path: ['viewer', 'repositories'],
                        message:
                          'org-secreta-ltda: Resource not accessible by personal access token',
                      },
                    ],
                  }),
                  { status: 200 },
                )
              : undefined,
        },
      }),
    )
    expect(error.message).toContain('não conseguiu listar os repositórios privados')
    expectNoSecrets(error.message)
  })

  it('limite de taxa no meio do histórico: para com a hora em que renova', async () => {
    const error = await failure(
      collect(fullUser(), {
        fake: {
          intercept: (call, calls) =>
            call.operation === 'CodornaPrivateHistory' &&
            calls.filter((c) => c.operation === 'CodornaPrivateHistory').length === 2
              ? rateLimited()
              : undefined,
        },
      }),
    )
    expect(error.code).toBe('rate-limit')
    expect(error.message).toContain('13:45 UTC')
    expectNoSecrets(error.message)
  })

  it('RATE_LIMITED do GraphQL nas buscas também para', async () => {
    const error = await failure(
      collect(fullUser(), {
        fake: {
          intercept: (call) =>
            call.operation === 'CodornaPrivateYear'
              ? new Response(
                  JSON.stringify({
                    errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
                  }),
                  { status: 200 },
                )
              : undefined,
        },
      }),
    )
    expect(error.code).toBe('rate-limit')
  })

  it('limite secundário: espera o retry-after e continua', async () => {
    let tripped = false
    const { data, sleeps } = await collect(fullUser(), {
      fake: {
        intercept: (call) => {
          if (call.operation !== 'CodornaPrivateRepositories' || tripped) return undefined
          tripped = true
          return new Response('{"message":"You have exceeded a secondary rate limit"}', {
            status: 403,
            headers: { 'retry-after': '3' },
          })
        },
      },
    })
    expect(sleeps).toContain(3000)
    expect(data.private?.scannedRepositories).toBe(3)
  })

  it('erro inesperado da API não leva o texto original', async () => {
    const error = await failure(
      collect(fullUser(), {
        fake: {
          intercept: (call) =>
            call.operation === 'CodornaPrivateHistory'
              ? new Response(
                  JSON.stringify({
                    errors: [
                      {
                        type: 'INTERNAL',
                        message: 'falhou ao ler repo-ultrassecreto/branch-secreta',
                      },
                    ],
                  }),
                  { status: 200 },
                )
              : undefined,
        },
      }),
    )
    expect(error.code).toBe('graphql')
    expectNoSecrets(error.message)
  })
})

describe('consultas privadas: privacidade por construção', () => {
  const documents = Object.entries(privateQueries as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )

  it('não pedem nome, título, mensagem nem URL', () => {
    expect(documents.length).toBe(4)
    for (const [name, query] of documents) {
      expect(query, name).not.toMatch(
        /\b(nameWithOwner|title|body|bodyText|message|messageHeadline|url|resourcePath|description|email|qualifiedName|refs)\b/,
      )
      // `name` só aparece nas linguagens; `login` só no viewer (a própria pessoa) e na variável.
      const withoutLanguages = query.replace(/node\s*\{\s*name\s*color\s*\}/g, '')
      expect(withoutLanguages, name).not.toMatch(/\bname\b/)
      const withoutLogin = query
        .replace(/viewer\s*\{\s*id\s*login\s*\}/g, '')
        .replace(/\$login|login: \$login/g, '')
      expect(withoutLogin, name).not.toMatch(/\blogin\b/)
      expect(query, name).not.toMatch(/\bmutation\b/)
    }
  })
})
