import { describe, expect, it, vi } from 'vitest'
import { GitHubClient } from '../src/github/client'
import { GuildCardError } from '../src/github/errors'

const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 })

function client(responses: (() => Response | Promise<Response>)[], lang: 'pt-BR' | 'en' = 'pt-BR') {
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
  })
  return { instance, fetchMock, sleep, warn }
}

async function failure(promise: Promise<unknown>): Promise<GuildCardError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof GuildCardError) return error
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
