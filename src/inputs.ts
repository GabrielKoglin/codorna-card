import { posix } from 'node:path'
import { getInput, type Env } from './actions'
import { CodornaCardError } from './github/errors'
import { strings } from './i18n'
import type { Lang, ThemeName } from './types'

export type ThemeInput = ThemeName | 'both'

export interface Inputs {
  username: string
  token: string
  output: string
  theme: ThemeInput
  lang: Lang
  commit: boolean
  /** Soma ao XP o número de contribuições privadas que o GitHub mostra no perfil. */
  privateContributions: boolean
  /**
   * Modo completo: token pessoal só de leitura para contar os repositórios privados. Vazio
   * quando não foi informado. Nunca é usado para escrever (o commit usa `token`).
   */
  privateToken: string
}

const LOGIN_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

export function parseLang(value: string): Lang | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized.startsWith('pt')) return 'pt-BR'
  if (normalized.startsWith('en')) return 'en'
  return null
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (['true', 'yes', 'on', '1'].includes(normalized)) return true
  if (['false', 'no', 'off', '0'].includes(normalized)) return false
  return null
}

/** Normaliza e valida o caminho de saída (relativo, dentro do repositório, terminado em .svg). */
export function normalizeOutput(value: string): string | null {
  const raw = (value || 'codorna-card.svg').trim().replace(/\\/g, '/')
  if (raw.startsWith('/') || /^[a-z]:/i.test(raw)) return null
  const normalized = posix.normalize(raw).replace(/^\.\//, '')
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../'))
    return null
  if (!/\.svg$/i.test(normalized) || normalized === '.svg' || normalized.endsWith('/.svg'))
    return null
  if (normalized.split('/').some((part) => part === '.git')) return null
  return normalized
}

/** Arquivos que serão gerados: um por tema (`both` gera `-dark` e `-light`). */
export function outputFiles(
  output: string,
  theme: ThemeInput,
): { theme: ThemeName; path: string }[] {
  if (theme !== 'both') return [{ theme, path: output }]
  const base = output.replace(/\.svg$/i, '')
  return [
    { theme: 'dark', path: `${base}-dark.svg` },
    { theme: 'light', path: `${base}-light.svg` },
  ]
}

/** Lê e valida as entradas. Mensagens de erro saem no idioma escolhido. */
export function readInputs(env: Env): Inputs {
  const langInput = getInput(env, 'lang')
  const lang = parseLang(langInput)
  if (!lang) {
    throw new CodornaCardError(
      'input',
      `${strings('pt-BR').errors.invalidLang(langInput)} / ${strings('en').errors.invalidLang(langInput)}`,
    )
  }
  const t = strings(lang)

  const username = getInput(env, 'username') || (env.GITHUB_REPOSITORY_OWNER ?? '').trim()
  if (!LOGIN_PATTERN.test(username))
    throw new CodornaCardError('input', t.errors.invalidUsername(username))

  const token = getInput(env, 'token')
  if (!token) throw new CodornaCardError('input', t.errors.missingToken)

  const outputInput = getInput(env, 'output')
  const output = normalizeOutput(outputInput)
  if (!output) throw new CodornaCardError('input', t.errors.invalidOutput(outputInput))

  const themeInput = getInput(env, 'theme').toLowerCase() || 'dark'
  if (themeInput !== 'dark' && themeInput !== 'light' && themeInput !== 'both') {
    throw new CodornaCardError('input', t.errors.invalidTheme(themeInput))
  }

  const commitInput = getInput(env, 'commit')
  const commit = commitInput === '' ? true : parseBoolean(commitInput)
  if (commit === null)
    throw new CodornaCardError('input', t.errors.invalidBoolean('commit', commitInput))

  const privateInput = getInput(env, 'private-contributions')
  const privateContributions = privateInput === '' ? false : parseBoolean(privateInput)
  if (privateContributions === null) {
    throw new CodornaCardError(
      'input',
      t.errors.invalidBoolean('private-contributions', privateInput),
    )
  }

  const privateToken = getInput(env, 'private-token')

  return {
    username,
    token,
    output,
    theme: themeInput,
    lang,
    commit,
    privateContributions,
    privateToken,
  }
}
