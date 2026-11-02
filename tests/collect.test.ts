import { describe, expect, it } from 'vitest'
import { GitHubClient } from '../src/github/client'
import { collectPlayer, quarterWindows, yearWindows } from '../src/github/collect'
import { CodornaCardError } from '../src/github/errors'
import { fakeGitHub, sampleUser, type FakeUser } from './helpers/fake-github'

const NOW = new Date('2026-11-02T12:00:00Z')

async function collect(user: FakeUser | null, login = 'pixel-dev') {
  const fake = fakeGitHub({ user })
  const client = new GitHubClient({
    token: 'x',
    lang: 'pt-BR',
    fetch: fake.fetch,
    sleep: async () => {},
  })
  const warnings: string[] = []
  const data = await collectPlayer({
    client,
    login,
    lang: 'pt-BR',
    now: NOW,
    warn: (m) => warnings.push(m),
  })
  return { data, calls: fake.calls, warnings }
}

describe('janelas de tempo', () => {
  it('um ano por vez, da criação da conta até hoje', () => {
    const windows = yearWindows(new Date('2024-05-10T12:00:00Z'), NOW)
    expect(windows.map((w) => [w.year, w.from.toISOString(), w.to.toISOString()])).toEqual([
      [2024, '2024-05-10T12:00:00.000Z', '2024-12-31T23:59:59.000Z'],
      [2025, '2025-01-01T00:00:00.000Z', '2025-12-31T23:59:59.000Z'],
      [2026, '2026-01-01T00:00:00.000Z', '2026-11-02T12:00:00.000Z'],
    ])
  })

  it('trimestres cortados nas pontas', () => {
    const quarters = quarterWindows({
      from: new Date('2026-02-10T00:00:00Z'),
      to: new Date('2026-08-01T00:00:00Z'),
    })
    expect(
      quarters.map((q) => [q.from.toISOString().slice(0, 10), q.to.toISOString().slice(0, 10)]),
    ).toEqual([
      ['2026-02-10', '2026-03-31'],
      ['2026-04-01', '2026-06-30'],
      ['2026-07-01', '2026-08-01'],
    ])
  })
})

describe('coleta', () => {
  it('junta tudo e descarta o que é privado', async () => {
    const { data, calls } = await collect(sampleUser())
    expect(data.login).toBe('Pixel-Dev')
    expect(data.createdAt).toBe('2024-05-10T12:00:00Z')
    expect(data.mergedPullRequests).toBe(7)
    expect(data.mergedPullRequestsElsewhere).toBe(2)
    expect(data.repositories.map((r) => r.name)).toEqual(['forja', 'site'])
    expect(data.years.map((y) => y.year)).toEqual([2024, 2025, 2026])
    const [y2024, y2025] = data.years
    expect(y2024?.commitsByDay).toEqual({ '2024-06-01': 15 })
    expect(y2024?.issues).toBe(2)
    expect(y2025?.commitsByDay).toEqual({ '2025-01-15': 4 })
    expect(y2025?.issues).toBe(0)
    expect(y2025?.pullRequests).toBe(5)
    expect(y2025?.reviews).toBe(3)
    // Buscas de PRs mesclados só públicos e com o login certo.
    const profile = calls.find((c) => c.operation === 'CodornaProfile')?.body as {
      variables: Record<string, string>
    }
    expect(profile.variables.merged).toBe('is:pr is:merged is:public author:pixel-dev')
    expect(profile.variables.mergedElsewhere).toBe(
      'is:pr is:merged is:public author:pixel-dev -user:pixel-dev',
    )
    expect(calls.some((c) => c.operation === 'CodornaQuarters')).toBe(false)
  })

  it('relê por trimestre quando um repositório passa de 100 dias de commit no ano', async () => {
    const commits = Array.from({ length: 150 }, (_, i) => ({
      repo: 'forja',
      day: new Date(Date.UTC(2025, 0, 1 + i * 2)).toISOString().slice(0, 10),
      count: 20,
    }))
    const { data, calls } = await collect(sampleUser({ commits }))
    expect(calls.filter((c) => c.operation === 'CodornaQuarters')).toHaveLength(1)
    const days = data.years.find((y) => y.year === 2025)?.commitsByDay ?? {}
    expect(Object.keys(days)).toHaveLength(150)
    expect(Object.values(days).every((n) => n === 20)).toBe(true)
  })

  it('pagina repositórios de 100 em 100', async () => {
    const repositories = Array.from({ length: 230 }, (_, i) => ({
      name: `repo-${i}`,
      languages: [{ name: 'Go', color: null, size: 100 }],
    }))
    const { data, calls } = await collect(sampleUser({ repositories }))
    expect(data.repositories).toHaveLength(230)
    expect(calls.filter((c) => c.operation === 'CodornaRepositories')).toHaveLength(3)
  })

  it('recusa organizações com mensagem clara', async () => {
    const error = await collect(sampleUser({ login: 'minha-org', type: 'Organization' })).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(CodornaCardError)
    expect((error as CodornaCardError).code).toBe('not-user')
    expect((error as CodornaCardError).message).toContain('"minha-org" é uma organização')
  })

  it('usuário inexistente', async () => {
    const error = await collect(null, 'fantasma').catch((e: unknown) => e)
    expect((error as CodornaCardError).code).toBe('not-found')
    expect((error as CodornaCardError).message).toBe('Usuário "fantasma" não encontrado no GitHub.')
  })
})
