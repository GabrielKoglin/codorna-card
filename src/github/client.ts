import { strings } from '../i18n'
import type { Lang } from '../types'
import { CodornaCardError } from './errors'

export interface ClientOptions {
  token: string
  lang: Lang
  /** Padrão: https://api.github.com (no GHES, use GITHUB_API_URL). */
  apiUrl?: string
  /** Padrão: `${apiUrl}/graphql` (no GHES, use GITHUB_GRAPHQL_URL). */
  graphqlUrl?: string
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
  warn?: (message: string) => void
  /** Novas tentativas para falhas temporárias (rede, 5xx, limite secundário). */
  maxRetries?: number
  timeoutMs?: number
  /**
   * Nunca põe texto vindo da API nas mensagens de erro (só status e tipo). É o modo do
   * `private-token`: mensagens do GitHub podem citar organizações e repositórios privados.
   */
  redact?: boolean
  /** Recusa mutações GraphQL e chamadas REST que não sejam GET. É o modo do `private-token`. */
  readOnly?: boolean
}

export interface RateLimitInfo {
  remaining: number
  resetAt: Date
}

interface RawResponse {
  status: number
  headers: Headers
  body: string
}

interface GraphQLError {
  type?: string
  message?: string
  path?: (string | number)[]
  extensions?: { saml_failure?: boolean }
}

/**
 * Erro parcial de uma consulta GraphQL, sem a mensagem original (que pode ter nomes privados):
 * só o tipo e o caminho do campo que falhou.
 */
export interface PartialError {
  /** `sso`: organização com SAML SSO e token não autorizado; `forbidden`: sem acesso. */
  kind: 'sso' | 'forbidden' | 'not-found'
  path: (string | number)[]
}

/** Tipos de erro GraphQL que só afetam um pedaço da resposta (o resto dos dados vem). */
const PARTIAL_TYPES = new Set(['FORBIDDEN', 'NOT_FOUND'])

function partialError(error: GraphQLError): PartialError {
  const sso =
    error.extensions?.saml_failure === true ||
    /\bSAML\b|single sign-on|\bSSO\b/i.test(error.message ?? '')
  return {
    kind: error.type === 'NOT_FOUND' ? 'not-found' : sso ? 'sso' : 'forbidden',
    path: Array.isArray(error.path) ? error.path : [],
  }
}

/** Mínimo de pontos de API antes de avisar nos logs. */
const LOW_RATE_LIMIT = 100
/** Espera máxima aceita num `retry-after` antes de desistir (segundos). */
const MAX_RETRY_AFTER = 120

const RETRYABLE_STATUS = new Set([500, 502, 503, 504])

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function messageFrom(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown }
    if (typeof parsed.message === 'string' && parsed.message) return parsed.message
  } catch {
    // corpo não é JSON
  }
  return body.trim().slice(0, 200) || 'sem detalhes'
}

function resetFrom(headers: Headers): Date | null {
  const reset = Number(headers.get('x-ratelimit-reset'))
  return Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : null
}

/** Cliente mínimo da API do GitHub (GraphQL e REST) com novas tentativas e erros claros. */
export class GitHubClient {
  readonly lang: Lang
  rateLimit: RateLimitInfo | null = null
  private readonly token: string
  private readonly apiUrl: string
  private readonly graphqlUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly log: (message: string) => void
  private readonly warn: (message: string) => void
  private readonly maxRetries: number
  private readonly timeoutMs: number
  private readonly redact: boolean
  private readonly readOnly: boolean
  private warnedLowLimit = false

  constructor(options: ClientOptions) {
    const t = strings(options.lang)
    if (!options.token) throw new CodornaCardError('input', t.errors.missingToken)
    this.token = options.token
    this.lang = options.lang
    this.apiUrl = (options.apiUrl || 'https://api.github.com').replace(/\/+$/, '')
    this.graphqlUrl = options.graphqlUrl || `${this.apiUrl}/graphql`
    this.fetchImpl = options.fetch ?? fetch
    this.sleep = options.sleep ?? defaultSleep
    this.log = options.log ?? (() => {})
    this.warn = options.warn ?? this.log
    this.maxRetries = options.maxRetries ?? 3
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.redact = options.redact ?? false
    this.readOnly = options.readOnly ?? false
  }

  private get t() {
    return strings(this.lang)
  }

  /** Texto da API para uma mensagem de erro, ou o aviso de que foi omitido. */
  private detail(text: string): string {
    return this.redact ? this.t.errors.hiddenDetail : text
  }

  /** Detalhe de erros GraphQL. Mensagens de FORBIDDEN nunca entram: podem citar organizações. */
  private graphqlDetail(errors: readonly GraphQLError[]): string {
    if (this.redact) {
      const types = [...new Set(errors.map((error) => error.type || '?'))].join(', ')
      return `${types} (${this.t.errors.hiddenDetail})`
    }
    return errors
      .map((error) =>
        error.type === 'FORBIDDEN' ? 'FORBIDDEN' : (error.message ?? error.type ?? '?'),
      )
      .join('; ')
  }

  private async wait(attempt: number, seconds?: number): Promise<void> {
    const delay = seconds ?? 2 ** (attempt - 1)
    this.log(this.t.log.retrying(attempt + 1, delay))
    await this.sleep(delay * 1000)
  }

  /** Faz a requisição, repetindo falhas temporárias. Erros de limite viram CodornaCardError. */
  private async request(url: string, init: RequestInit): Promise<RawResponse> {
    for (let attempt = 1; ; attempt++) {
      let response: Response
      let body: string
      try {
        response = await this.fetchImpl(url, {
          ...init,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'User-Agent': 'codorna-card-action',
            ...(init.headers as Record<string, string> | undefined),
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        })
        body = await response.text()
      } catch (error) {
        if (attempt <= this.maxRetries) {
          await this.wait(attempt)
          continue
        }
        const name = error instanceof Error ? error.name : ''
        if (name === 'TimeoutError' || name === 'AbortError') {
          throw new CodornaCardError('timeout', this.t.errors.timeout)
        }
        const detail = error instanceof Error ? error.message : String(error)
        throw new CodornaCardError('network', this.t.errors.network(detail))
      }

      if (RETRYABLE_STATUS.has(response.status) && attempt <= this.maxRetries) {
        await this.wait(attempt)
        continue
      }

      if (response.status === 401) throw new CodornaCardError('auth', this.t.errors.badCredentials)

      if (response.status === 403 || response.status === 429) {
        if (response.headers.get('x-ratelimit-remaining') === '0') {
          throw new CodornaCardError(
            'rate-limit',
            this.t.errors.rateLimited(resetFrom(response.headers)),
          )
        }
        const retryAfter = Number(response.headers.get('retry-after'))
        const secondary =
          /secondary rate limit|abuse/i.test(body) ||
          (Number.isFinite(retryAfter) && retryAfter > 0)
        if (secondary) {
          const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60
          if (attempt <= this.maxRetries && seconds <= MAX_RETRY_AFTER) {
            await this.wait(attempt, seconds)
            continue
          }
          throw new CodornaCardError('secondary-rate-limit', this.t.errors.secondaryRateLimit)
        }
      }

      return { status: response.status, headers: response.headers, body }
    }
  }

  /** Consulta GraphQL. Erros parciais viram exceção (com tipo NOT_FOUND identificado). */
  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    return (await this.execute<T>(query, variables, false)).data
  }

  /**
   * Consulta GraphQL que aceita resposta parcial: quando só alguns campos falham por falta de
   * acesso (FORBIDDEN, inclusive SSO) ou por não existirem (NOT_FOUND), devolve os dados que
   * vieram e a lista desses erros, sem as mensagens originais. Qualquer outro erro vira exceção.
   */
  async graphqlPartial<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<{ data: T; errors: PartialError[] }> {
    return this.execute<T>(query, variables, true)
  }

  private async execute<T>(
    query: string,
    variables: Record<string, unknown>,
    allowPartial: boolean,
  ): Promise<{ data: T; errors: PartialError[] }> {
    if (this.readOnly && /\bmutation\b/i.test(query)) {
      throw new CodornaCardError('input', this.t.errors.readOnlyClient)
    }
    for (let attempt = 1; ; attempt++) {
      const response = await this.request(this.graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      })
      if (response.status === 403) {
        throw new CodornaCardError(
          'forbidden',
          this.t.errors.forbidden(this.detail(messageFrom(response.body))),
        )
      }
      if (response.status >= 400) {
        throw new CodornaCardError(
          'api',
          this.t.errors.api(response.status, this.detail(messageFrom(response.body))),
        )
      }
      let payload: {
        data?: (T & { rateLimit?: { remaining: number; resetAt: string } }) | null
        errors?: GraphQLError[]
      }
      try {
        payload = JSON.parse(response.body)
      } catch {
        throw new CodornaCardError(
          'api',
          this.t.errors.api(response.status, this.detail(messageFrom(response.body))),
        )
      }
      const errors = Array.isArray(payload.errors) ? payload.errors : []
      if (errors.length > 0) {
        if (errors.some((error) => error.type === 'RATE_LIMITED')) {
          throw new CodornaCardError(
            'rate-limit',
            this.t.errors.rateLimited(resetFrom(response.headers)),
          )
        }
        if (
          allowPartial &&
          payload.data &&
          errors.every((error) => PARTIAL_TYPES.has(error.type ?? ''))
        ) {
          this.trackRateLimit(payload.data.rateLimit)
          return { data: payload.data, errors: errors.map(partialError) }
        }
        const notFound = errors.find((error) => error.type === 'NOT_FOUND')
        if (notFound) {
          throw new CodornaCardError(
            'not-found',
            this.t.errors.graphql(this.graphqlDetail([notFound])),
          )
        }
        const messages = errors.map((error) => error.message ?? '').join('; ')
        // O GitHub às vezes responde "Something went wrong" quando a consulta demora; vale repetir.
        const transient = /something went wrong|timeout|timed out/i.test(messages)
        if (transient && attempt <= this.maxRetries) {
          await this.wait(attempt)
          continue
        }
        throw new CodornaCardError(
          transient ? 'timeout' : 'graphql',
          this.t.errors.graphql(this.graphqlDetail(errors)),
        )
      }
      if (!payload.data)
        throw new CodornaCardError('graphql', this.t.errors.graphql(this.t.errors.noData))
      this.trackRateLimit(payload.data.rateLimit)
      return { data: payload.data, errors: [] }
    }
  }

  private trackRateLimit(info: { remaining: number; resetAt: string } | undefined): void {
    if (!info) return
    this.rateLimit = { remaining: info.remaining, resetAt: new Date(info.resetAt) }
    if (info.remaining < LOW_RATE_LIMIT && !this.warnedLowLimit) {
      this.warnedLowLimit = true
      this.warn(this.t.log.rateLimitLow(info.remaining, this.rateLimit.resetAt))
    }
  }

  /** Chamada REST. Devolve status e JSON; quem chama decide o que cada status significa. */
  async rest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: T | null; message: string }> {
    if (this.readOnly && method !== 'GET') {
      throw new CodornaCardError('input', this.t.errors.readOnlyClient)
    }
    const response = await this.request(`${this.apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    let data: T | null
    try {
      data = response.body ? (JSON.parse(response.body) as T) : null
    } catch {
      data = null
    }
    return { status: response.status, data, message: this.detail(messageFrom(response.body)) }
  }
}
