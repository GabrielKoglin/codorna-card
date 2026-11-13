import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { consoleLogger, type Logger } from '../src/actions'
import { main, run } from '../src/run'
import {
  fakeGitHub,
  privateSample,
  sampleUser,
  SECRET_NAMES,
  type FakeOptions,
} from './helpers/fake-github'

function memoryLogger() {
  const lines: string[] = []
  const masks: string[] = []
  const logger: Logger = {
    info: (m) => lines.push(m),
    warning: (m) => lines.push(`WARN ${m}`),
    error: (m) => lines.push(`ERROR ${m}`),
    group: async (_title, fn) => fn(),
    mask: (secret) => masks.push(secret),
  }
  return { logger, lines, masks }
}

function workspace(inputs: Record<string, string>, extra: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'codorna-card-'))
  const output = join(dir, 'output.txt')
  const summary = join(dir, 'summary.md')
  writeFileSync(output, '')
  writeFileSync(summary, '')
  const env: Record<string, string> = {
    GITHUB_WORKSPACE: dir,
    GITHUB_OUTPUT: output,
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_REPOSITORY: 'Pixel-Dev/Pixel-Dev',
    GITHUB_REPOSITORY_OWNER: 'Pixel-Dev',
    GITHUB_REF: 'refs/heads/main',
    INPUT_TOKEN: 'segredo',
    ...Object.fromEntries(Object.entries(inputs).map(([k, v]) => [`INPUT_${k.toUpperCase()}`, v])),
    ...extra,
  }
  return { dir, env, output, summary }
}

const NOW = new Date('2026-11-02T12:00:00Z')

describe('Action de ponta a ponta (API falsa)', () => {
  it('gera os dois temas, comita e preenche saídas e resumo', async () => {
    const ws = workspace({ theme: 'both', lang: 'en' })
    const fake = fakeGitHub({
      user: sampleUser(),
      repo: { branch: 'main', headSha: 'abc', files: [] },
    })
    const { logger, lines } = memoryLogger()
    const result = await run({
      env: ws.env,
      logger,
      fetch: fake.fetch,
      now: NOW,
      sleep: async () => {},
    })

    expect(result.committed).toBe(true)
    expect(result.files.map((f) => f.path)).toEqual([
      'codorna-card-dark.svg',
      'codorna-card-light.svg',
    ])
    const dark = readFileSync(join(ws.dir, 'codorna-card-dark.svg'), 'utf8')
    expect(dark).toContain('Codorna Card of @Pixel-Dev')
    expect(readFileSync(join(ws.dir, 'codorna-card-light.svg'), 'utf8')).toContain('#f7f0de')

    const outputs = readFileSync(ws.output, 'utf8')
    expect(outputs).toMatch(/^level<<ghadelimiter_/m)
    expect(outputs).toContain(`xp<<`)
    expect(outputs).toMatch(/committed<<ghadelimiter_[^\n]+\ntrue\n/)
    expect(readFileSync(ws.summary, 'utf8')).toContain('| Commits (up to 10 per day) |')
    expect(readFileSync(ws.summary, 'utf8')).toContain('/blob/main/docs/rules.md')
    expect(lines.some((l) => l.startsWith('Commit c0ffee1 pushed to main'))).toBe(true)
    expect(fake.calls.some((c) => c.method === 'PATCH')).toBe(true)
  })

  it('private-contributions: soma as privadas, mostra no card e no resumo', async () => {
    const ws = workspace({ 'private-contributions': 'true', commit: 'false', lang: 'en' })
    const fake = fakeGitHub({
      user: sampleUser({ restricted: [{ year: 2026, count: 1234 }] }),
    })
    const { logger } = memoryLogger()
    const result = await run({ env: ws.env, logger, fetch: fake.fetch, now: NOW })
    expect(result.character.activity.privateContributions).toEqual({ raw: 1234, counted: 1000 })
    expect(result.character.xp.privateContributions).toBe(1000)
    const svg = readFileSync(join(ws.dir, 'codorna-card.svg'), 'utf8')
    expect(svg).toContain('1,234 private contributions')
    expect(readFileSync(ws.summary, 'utf8')).toContain(
      '| Private contributions (up to 1,000 per year) | 1,234 | 1,000 | 1,000 |',
    )
  })

  it('sem a opção, o resumo não tem linha de privadas', async () => {
    const ws = workspace({ commit: 'false' })
    const fake = fakeGitHub({ user: sampleUser({ restricted: [{ year: 2026, count: 99 }] }) })
    const result = await run({
      env: ws.env,
      logger: memoryLogger().logger,
      fetch: fake.fetch,
      now: NOW,
    })
    expect(result.character.xp.privateContributions).toBe(0)
    expect(readFileSync(ws.summary, 'utf8')).not.toContain('privadas')
    expect(readFileSync(ws.summary, 'utf8')).toContain('/blob/main/docs/regras.md')
  })

  it('commit: false só gera o arquivo', async () => {
    const ws = workspace({ commit: 'false', output: 'img/card.svg' })
    const fake = fakeGitHub({ user: sampleUser() })
    const result = await run({
      env: ws.env,
      logger: memoryLogger().logger,
      fetch: fake.fetch,
      now: NOW,
    })
    expect(result.committed).toBe(false)
    expect(readFileSync(join(ws.dir, 'img/card.svg'), 'utf8')).toContain('<svg')
    expect(fake.calls.every((c) => c.url.endsWith('/graphql'))).toBe(true)
  })

  it('fora de uma branch (PR) gera o card e avisa que não comitou', async () => {
    const ws = workspace({}, { GITHUB_REF: 'refs/pull/7/merge' })
    const fake = fakeGitHub({ user: sampleUser() })
    const { logger, lines } = memoryLogger()
    const result = await run({ env: ws.env, logger, fetch: fake.fetch, now: NOW })
    expect(result.committed).toBe(false)
    expect(lines.some((l) => l.startsWith('WARN') && l.includes('refs/pull/7/merge'))).toBe(true)
  })

  it('sem private-token, nada de consulta privada e o resumo continua igual', async () => {
    const ws = workspace({ commit: 'false' })
    const fake = fakeGitHub({ user: sampleUser(privateSample()), privateToken: PRIVATE_TOKEN })
    const result = await run({
      env: ws.env,
      logger: memoryLogger().logger,
      fetch: fake.fetch,
      now: NOW,
    })
    expect(fake.calls.some((c) => c.operation?.startsWith('CodornaPrivate'))).toBe(false)
    expect(result.character.activity.commits.privateRaw).toBe(0)
    const summary = readFileSync(ws.summary, 'utf8')
    expect(summary).toContain('| Fonte | Total público | Conta para XP | XP |')
    expect(summary).not.toContain('Modo completo')
  })

  it('main devolve 1 e mostra o erro sem stack trace', async () => {
    const ws = workspace({ username: 'minha-org' })
    const { logger, lines } = memoryLogger()
    const fake = fakeGitHub({ user: sampleUser({ login: 'minha-org', type: 'Organization' }) })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fake.fetch
    try {
      expect(await main(ws.env, logger)).toBe(1)
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(lines.at(-1)).toBe(
      'ERROR "minha-org" é uma organização. O Codorna Card é de pessoas: informe o seu login em `username`.',
    )
  })
})

const PRIVATE_TOKEN = 'github_pat_11SEGREDOdoTESTE_abcdefghijklmnop'

describe('modo completo na Action (private-token)', () => {
  async function fullRun(
    inputs: Record<string, string> = {},
    fakeOptions: Partial<FakeOptions> = {},
  ) {
    const ws = workspace({ 'private-token': PRIVATE_TOKEN, theme: 'both', ...inputs })
    const fake = fakeGitHub({
      user: sampleUser(privateSample()),
      repo: { branch: 'main', headSha: 'abc', files: [] },
      privateToken: PRIVATE_TOKEN,
      ...fakeOptions,
    })
    const log = memoryLogger()
    const result = await run({
      env: ws.env,
      logger: log.logger,
      fetch: fake.fetch,
      now: NOW,
      sleep: async () => {},
    })
    const everything = [
      ...result.files.map((file) => readFileSync(join(ws.dir, file.path), 'utf8')),
      readFileSync(ws.summary, 'utf8'),
      readFileSync(ws.output, 'utf8'),
      ...log.lines,
    ].join('\n')
    return { ws, fake, result, everything, ...log }
  }

  it('soma o trabalho privado com os tetos sobre a soma e mostra os totais no card', async () => {
    const { result } = await fullRun()
    const c = result.character
    // Commits: 2024-06-01 15→10; 2025-01-15 4+3=7; 2025-03-01 25→10; 2026-02-10 2; 2026-06-01 4.
    expect(c.activity.commits).toEqual({
      raw: 19,
      privateRaw: 34,
      counted: 33,
      activeDays: 5,
      cappedDays: 2,
    })
    expect(c.activity.pullRequests).toEqual({ raw: 5, privateRaw: 4, counted: 9 })
    expect(c.activity.merged).toEqual({ raw: 7, privateRaw: 2, counted: 9 })
    expect(c.activity.mergedElsewhere).toEqual({ raw: 2, privateRaw: 1, counted: 3 })
    expect(c.xp.total).toBe(66 + 12 + 45 + 32 + 90 + 30)
    const dark = result.files[0]!.content
    // Os números somam o público e o privado: commits 19 + 34, PRs mesclados 7 + 2,
    // reviews 3 + 1 e issues 2 + 1. Sem private-contributions, não há privadas anônimas.
    expect(dark).toContain('53 commits · 9 PRs mesclados · 4 reviews · 3 issues.')
    expect(dark).not.toContain('contribuições privadas')
  })

  it('nenhum nome privado vaza: SVG, logs, resumo e saídas', async () => {
    const { everything } = await fullRun({ 'private-contributions': 'true' })
    for (const secret of SECRET_NAMES) expect(everything, secret).not.toContain(secret)
  })

  it('o token é mascarado e nunca aparece; só lê, e só pela API GraphQL', async () => {
    const { everything, masks, fake, result } = await fullRun()
    expect(masks).toContain(PRIVATE_TOKEN)
    expect(masks).toContain('segredo') // o token do workflow também
    expect(everything).not.toContain(PRIVATE_TOKEN)
    expect(result.committed).toBe(true)
    const withPrivate = fake.calls.filter((call) => call.token === PRIVATE_TOKEN)
    expect(withPrivate.length).toBeGreaterThan(0)
    for (const call of withPrivate) {
      expect(call.method).toBe('POST')
      expect(call.url).toBe('https://api.github.com/graphql')
      expect(call.operation).toMatch(/^CodornaPrivate/)
      expect((call.body as { query: string }).query).not.toMatch(/\bmutation\b/)
    }
    // O commit (REST) é todo com o token do workflow.
    const rest = fake.calls.filter((call) => !call.url.endsWith('/graphql'))
    expect(rest.length).toBeGreaterThan(0)
    expect(rest.every((call) => call.token === 'segredo')).toBe(true)
  })

  it('o resumo ganha a coluna Privado e só conta repositórios', async () => {
    const { ws } = await fullRun({ 'private-contributions': 'true' })
    const summary = readFileSync(ws.summary, 'utf8')
    expect(summary).toContain('| Fonte | Público | Privado | Conta para XP | XP |')
    expect(summary).toContain('| Commits (até 10 por dia) | 19 | 34 | 33 | 66 |')
    expect(summary).toContain(
      '| Contribuições privadas anônimas, fora do alcance do token (até 1.000 por ano) | — | 5 | 5 | 5 |',
    )
    expect(summary).toContain(
      'Modo completo (private-token, só leitura): 3 repositórios privados lidos, 3 pulados por SSO ou falta de acesso.',
    )
  })

  it('erro do private-token falha o job sem vazar nome nem token', async () => {
    const ws = workspace({ 'private-token': PRIVATE_TOKEN, commit: 'false' })
    const fake = fakeGitHub({
      user: sampleUser(privateSample()),
      privateToken: PRIVATE_TOKEN,
      intercept: (call) =>
        call.operation === 'CodornaPrivateHistory'
          ? new Response(
              JSON.stringify({
                errors: [{ type: 'INTERNAL', message: 'repo-ultrassecreto em org-secreta-ltda' }],
              }),
              { status: 200 },
            )
          : undefined,
    })
    const written: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = fake.fetch
    try {
      expect(
        await main(
          ws.env,
          consoleLogger((line) => written.push(line)),
        ),
      ).toBe(1)
    } finally {
      globalThis.fetch = originalFetch
    }
    // A máscara vem antes de tudo; depois disso, o token não aparece em linha nenhuma.
    expect(written.slice(0, 2)).toEqual(['::add-mask::segredo', `::add-mask::${PRIVATE_TOKEN}`])
    const rest = written.slice(2).join('\n')
    expect(rest).not.toContain(PRIVATE_TOKEN)
    for (const secret of SECRET_NAMES) expect(rest, secret).not.toContain(secret)
    expect(written.at(-1)).toMatch(/^::error::A API GraphQL do GitHub respondeu com erro: INTERNAL/)
  })
})
