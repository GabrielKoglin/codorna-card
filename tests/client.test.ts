import { describe, expect, it, vi } from 'vitest'
import { GitHubClient } from '../src/github/client'
import { CodornaCardError } from '../src/github/errors'

const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })

function client(
  responses: (() => Response | Promise<Response>)[],
  lang: 'pt-BR' | 'en' = 'pt-BR',
  extra: { redact?: boolean; readOnly?: boolean } = {},
) {
  const queue = [...responses]
  const fetchMock = vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('sem resposta preparada')
    return next()
  })
  const sleep = vi.fn(async () => {})
  const warn = vi.fn()
  const instance = new GitHubClient({
    token: 't0k3n',
    lang,
    fetch: fetchMock as unknown as typeof fetch,
    sleep,
    warn,
    ...extra,
  })
  return { instance, fetchMock, sleep, warn }
}

const SECRET_ORG = 'org-ultrassecreta'
const graphqlErrors =
  (errors: unknown[], data: unknown = null) =>
  () =>
    new Response(JSON.stringify({ data, errors }), { status: 200 })

async function failure(promise: Promise<unknown>): Promise<CodornaCardError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof CodornaCardError) return error
    throw error
  }
  throw new Error('era para falhar')
}

describe('cliente da API', () => {
  it('manda o token e devolve os dados', async () => {
    const { instance, fetchMock } = client([() => ok({ hello: 'world' })])
    await expect(instance.graphql('query X { a }', {})).resolves.toEqual({ hello: 'world' })
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init[0]).toBe('https://api.github.com/graphql')
    expect((init[1].headers as Record<string, string>).Authorization).toBe('Bearer t0k3n')
  })

  it('exige token', () => {
    expect(() => new GitHubClient({ token: '', lang: 'en' })).toThrow(/No token provided/)
  })

  it('repete falhas temporárias (502) e depois funciona', async () => {
    const { instance, sleep } = client([
      () => new Response('bad gateway', { status: 502 }),
      () => new Response('bad gateway', { status: 502 }),
      () => ok({ fine: true }),
    ])
    await expect(instance.graphql('query X { a }', {})).resolves.toEqual({ fine: true })
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('repete erro de rede e desiste com mensagem clara', async () => {
    const boom = () => Promise.reject(new TypeError('fetch failed'))
    const { instance } = client([boom, boom, boom, boom])
    const error = await failure(instance.graphql('query X { a }', {}))
    expect(error.code).toBe('network')
    expect(error.message).toContain('Falha de rede')
  })

  it('token recusado vira erro de autenticação', async () => {
    const { instance } = client(
      [() => new Response('{"message":"Bad credentials"}', { status: 401 })],
      'en',
    )
    const error = await failure(instance.graphql('query X { a }', {}))
    expect(error.code).toBe('auth')
    expect(error.message).toContain('rejected the token')
  })

  it('limite de taxa esgotado informa a hora em que renova', async () => {
    const { instance } = client([
      () =>
        new Response('{"message":"API rate limit exceeded"}', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Date.UTC(2026, 10, 2, 15, 30) / 1000),
          },
        }),
    ])
    const error = await failure(instance.graphql('query X { a }', {}))
    expect(error.code).toBe('rate-limit')
    expect(error.message).toContain('15:30 UTC')
  })

  it('limite secundário espera o retry-after e tenta de novo', async () => {
    const { instance, sleep } = client([
      () =>
        new Response('{"message":"You have exceeded a secondary rate limit"}', {
          status: 403,
          headers: { 'retry-after': '5' },
        }),
      () => ok({ again: true }),
    ])
    await expect(instance.graphql('query X { a }', {})).resolves.toEqual({ again: true })
    expect(sleep).toHaveBeenCalledWith(5000)
  })

  it('limite secundário com espera longa demais falha com mensagem clara', async () => {
    const { instance } = client([
      () =>
        new Response('{"message":"secondary rate limit"}', {
          status: 429,
          headers: { 'retry-after': '900' },
        }),
    ])
    const error = await failure(instance.graphql('query X { a }', {}))
    expect(error.code).toBe('secondary-rate-limit')
  })

  it('RATE_LIMITED no GraphQL vira erro de limite', async () => {
    const { instance } = client([
      () =>
        new Response(
          JSON.stringify({
            errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
          }),
          { status: 200 },
        ),
    ])
    expect((await failure(instance.graphql('query X { a }', {}))).code).toBe('rate-limit')
  })

  it('"Something went wrong" do GraphQL é repetido', async () => {
    const { instance, sleep } = client([
      () =>
        new Response(
          JSON.stringify({
            errors: [{ message: 'Something went wrong while executing your query.' }],
          }),
          { status: 200 },
        ),
      () => ok({ second: 'try' }),
    ])
    await expect(instance.graphql('query X { a }', {})).resolves.toEqual({ second: 'try' })
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('NOT_FOUND vira erro identificável', async () => {
    const { instance } = client([
      () =>
        new Response(
          JSON.stringify({ errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }] }),
          { status: 200 },
        ),
    ])
    expect((await failure(instance.graphql('query X { a }', {}))).code).toBe('not-found')
  })

  it('mensagens de FORBIDDEN nunca entram no erro (podem citar organizações)', async () => {
    const { instance } = client([
      graphqlErrors([
        {
          type: 'FORBIDDEN',
          message: `Although you appear to have the correct authorization credentials, the \`${SECRET_ORG}\` organization has enabled OAuth App access restrictions.`,
        },
      ]),
    ])
    const error = await failure(instance.graphql('query X { a }', {}))
    expect(error.code).toBe('graphql')
    expect(error.message).toContain('FORBIDDEN')
    expect(error.message).not.toContain(SECRET_ORG)
  })

  it('com redact, nenhum texto da API entra nas mensagens de erro', async () => {
    const leaky = [
      () => new Response(`{"message":"${SECRET_ORG} bloqueou"}`, { status: 403 }),
      () => new Response(`{"message":"repo ${SECRET_ORG}/x"}`, { status: 422 }),
      () => new Response(`<html>${SECRET_ORG}</html>`, { status: 200 }),
      graphqlErrors([{ type: 'SOMETHING', message: `falhou em ${SECRET_ORG}/repo` }]),
      graphqlErrors([{ type: 'NOT_FOUND', message: `Could not resolve ${SECRET_ORG}/repo` }]),
    ]
    const { instance } = client(leaky, 'pt-BR', { redact: true })
    const codes: string[] = []
    for (let i = 0; i < leaky.length; i++) {
      const error = await failure(instance.graphql('query X { a }', {}))
      codes.push(error.code)
      expect(error.message).not.toContain(SECRET_ORG)
      expect(error.message).toContain('detalhes omitidos')
    }
    expect(codes).toEqual(['forbidden', 'api', 'api', 'graphql', 'not-found'])
  })

  it('resposta parcial: devolve os dados e só o tipo e o caminho de cada erro', async () => {
    const { instance } = client(
      [
        graphqlErrors(
          [
            {
              type: 'FORBIDDEN',
              path: ['viewer', 'repositories', 'nodes', 1],
              extensions: { saml_failure: true },
              message: `Resource protected by organization SAML enforcement (${SECRET_ORG}).`,
            },
            {
              type: 'FORBIDDEN',
              path: ['viewer', 'repositories', 'nodes', 2, 'languages'],
              message: 'Resource not accessible by personal access token',
            },
            { type: 'NOT_FOUND', path: ['node'], message: `sumiu ${SECRET_ORG}` },
          ],
          { viewer: { ok: true }, rateLimit: { remaining: 4000, resetAt: '2026-11-02T16:00:00Z' } },
        ),
      ],
      'en',
      { redact: true },
    )
    const result = await instance.graphqlPartial<{ viewer: { ok: boolean } }>('query X { a }', {})
    expect(result.data.viewer.ok).toBe(true)
    expect(result.errors).toEqual([
      { kind: 'sso', path: ['viewer', 'repositories', 'nodes', 1] },
      { kind: 'forbidden', path: ['viewer', 'repositories', 'nodes', 2, 'languages'] },
      { kind: 'not-found', path: ['node'] },
    ])
    expect(JSON.stringify(result)).not.toContain(SECRET_ORG)
    expect(instance.rateLimit?.remaining).toBe(4000)
  })

  it('resposta parcial ainda falha com limite de taxa ou erro de outro tipo', async () => {
    const { instance } = client(
      [
        graphqlErrors([{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }], { a: 1 }),
        graphqlErrors([{ type: 'INTERNAL', message: `quebrou ${SECRET_ORG}` }], { a: 1 }),
        graphqlErrors([{ type: 'FORBIDDEN', message: 'tudo negado' }], null),
      ],
      'pt-BR',
      { redact: true },
    )
    expect((await failure(instance.graphqlPartial('query X { a }', {}))).code).toBe('rate-limit')
    const other = await failure(instance.graphqlPartial('query X { a }', {}))
    expect(other.code).toBe('graphql')
    expect(other.message).not.toContain(SECRET_ORG)
    // Sem nenhum dado, não há resposta parcial para devolver.
    expect((await failure(instance.graphqlPartial('query X { a }', {}))).code).toBe('graphql')
  })

  it('só leitura: recusa mutação e REST que escreve, sem nem chamar a API', async () => {
    const { instance, fetchMock } = client([() => ok({ fine: true })], 'pt-BR', { readOnly: true })
    const mutation = await failure(instance.graphql('mutation M { addStar { x } }', {}))
    expect(mutation.message).toContain('só de leitura')
    for (const method of ['POST', 'PATCH', 'PUT'] as const) {
      expect((await failure(instance.rest(method, '/repos/a/b/git/trees', {}))).code).toBe('input')
    }
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(instance.graphql('query X { a }', {})).resolves.toEqual({ fine: true })
  })

  it('avisa uma vez quando sobram poucos pontos de API', async () => {
    const low = { rateLimit: { remaining: 42, resetAt: '2026-11-02T16:00:00Z' } }
    const { instance, warn } = client([() => ok(low), () => ok(low)])
    await instance.graphql('query X { a }', {})
    await instance.graphql('query X { a }', {})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('restam 42 pontos')
    expect(instance.rateLimit?.remaining).toBe(42)
  })
})
