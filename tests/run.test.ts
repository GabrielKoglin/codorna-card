import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Logger } from '../src/actions'
import { main, run } from '../src/run'
import { fakeGitHub, sampleUser } from './helpers/fake-github'

function memoryLogger() {
  const lines: string[] = []
  const logger: Logger = {
    info: (m) => lines.push(m),
    warning: (m) => lines.push(`WARN ${m}`),
    error: (m) => lines.push(`ERROR ${m}`),
    group: async (_title, fn) => fn(),
  }
  return { logger, lines }
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
    expect(lines.some((l) => l.startsWith('Commit c0ffee1 pushed to main'))).toBe(true)
    expect(fake.calls.some((c) => c.method === 'PATCH')).toBe(true)
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
