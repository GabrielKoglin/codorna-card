/**
 * Prévia local: gera o card de qualquer pessoa com a API de verdade, sem comitar nada.
 * O token vem de GITHUB_TOKEN ou, se a variável estiver vazia, do `gh auth token`.
 * Com `--private-token` (modo completo), o token privado vem de CODORNA_TOKEN ou, se a variável
 * estiver vazia, também do `gh auth token`. Tokens nunca são aceitos na linha de comando.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { buildCharacter, type Character } from '../../src/character'
import { GitHubClient } from '../../src/github/client'
import { collectPlayer } from '../../src/github/collect'
import { CodornaCardError } from '../../src/github/errors'
import { formatNumber, strings } from '../../src/i18n'
import { parseLang } from '../../src/inputs'
import { renderCard } from '../../src/render/card'
import type { Lang, ThemeName } from '../../src/types'
import { writePngIfChanged } from './files'
import { rasterizeSvg } from './raster'

export interface PreviewArgs {
  user: string | null
  lang: Lang
  privateContributions: boolean
  /** Modo completo: conta os repositórios privados com o token de CODORNA_TOKEN ou do gh. */
  privateToken: boolean
  out: string
  help: boolean
}

const LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i
/** Prefixos dos tokens do GitHub (clássico, OAuth, apps e fine-grained). */
const TOKEN_LIKE = /^(gh[pousr]_|github_pat_)/i

const TEXT = {
  'pt-BR': {
    usage: [
      'Uso: npm run preview -- --user <login> [--lang pt-BR|en] [--private] [--private-token] [--out <pasta>]',
      '',
      'Gera o card de qualquer pessoa com a API do GitHub, sem comitar nada.',
      'Token: GITHUB_TOKEN ou, se estiver vazio, o do GitHub CLI (gh auth token).',
      '--private-token: modo completo, conta os seus repositórios privados (só leitura) com o',
      '  token de CODORNA_TOKEN ou, se estiver vazio, o do gh. Só totais: nenhum nome privado.',
      'Saída: preview/<login>-dark.svg, -light.svg, os PNGs e os dados em <login>.json.',
    ],
    invalidUser: (value: string) =>
      `Login inválido: "${value}". Use o login do GitHub (letras, números e hífens).`,
    invalidLang: (value: string) => `Idioma inválido: "${value}". Use pt-BR ou en.`,
    tokenInArgs:
      'Não passe tokens na linha de comando (eles ficam no histórico do terminal). Use a variável CODORNA_TOKEN e só a opção --private-token.',
    noToken: [
      'Nenhum token. Defina GITHUB_TOKEN ou faça login no GitHub CLI (gh auth login).',
      '  PowerShell: $env:GITHUB_TOKEN = "seu-token"',
      '  bash/zsh:   export GITHUB_TOKEN=seu-token',
      'Um token sem permissão nenhuma já basta: a prévia só lê dados públicos.',
    ],
    noPrivateToken: [
      '--private-token precisa de um token: defina CODORNA_TOKEN ou faça login no GitHub CLI (gh auth login).',
      '  PowerShell: $env:CODORNA_TOKEN = "seu-token"',
      '  bash/zsh:   export CODORNA_TOKEN=seu-token',
      'Use um token só de leitura (veja "Modo completo" no README).',
    ],
    tokenFrom: (source: string) => `Token: ${source}.`,
    privateTokenFrom: (source: string) =>
      `Token privado (modo completo, só leitura): ${source}. Só totais aparecem: nenhum nome privado.`,
    privateNote:
      'Com --private, a prévia usa o seu token: contribuições em repositórios privados que ele enxerga não contam como "restritas". O número na Action (com o GITHUB_TOKEN) pode ser maior.',
    files: 'Arquivos (nada foi comitado):',
  },
  en: {
    usage: [
      'Usage: npm run preview -- --user <login> [--lang pt-BR|en] [--private] [--private-token] [--out <dir>]',
      '',
      "Builds anyone's card with the GitHub API, without committing anything.",
      'Token: GITHUB_TOKEN or, if it is empty, the GitHub CLI one (gh auth token).',
      '--private-token: full mode, counts your private repositories (read-only) with the token',
      '  in CODORNA_TOKEN or, if it is empty, the gh one. Totals only: no private names.',
      'Output: preview/<login>-dark.svg, -light.svg, the PNGs and the data in <login>.json.',
    ],
    invalidUser: (value: string) =>
      `Invalid login: "${value}". Use a GitHub login (letters, numbers and hyphens).`,
    invalidLang: (value: string) => `Invalid language: "${value}". Use pt-BR or en.`,
    tokenInArgs:
      'Do not pass tokens on the command line (they stay in your shell history). Use the CODORNA_TOKEN variable and just the --private-token option.',
    noToken: [
      'No token. Set GITHUB_TOKEN or log in to the GitHub CLI (gh auth login).',
      '  PowerShell: $env:GITHUB_TOKEN = "your-token"',
      '  bash/zsh:   export GITHUB_TOKEN=your-token',
      'A token with no permissions at all is enough: the preview only reads public data.',
    ],
    noPrivateToken: [
      '--private-token needs a token: set CODORNA_TOKEN or log in to the GitHub CLI (gh auth login).',
      '  PowerShell: $env:CODORNA_TOKEN = "your-token"',
      '  bash/zsh:   export CODORNA_TOKEN=your-token',
      'Use a read-only token (see "Full mode" in the README).',
    ],
    tokenFrom: (source: string) => `Token: ${source}.`,
    privateTokenFrom: (source: string) =>
      `Private token (full mode, read-only): ${source}. Only totals show up: no private names.`,
    privateNote:
      'With --private, the preview uses your token: contributions in private repositories it can see do not count as "restricted". The number in the Action (with GITHUB_TOKEN) may be higher.',
    files: 'Files (nothing was committed):',
  },
} as const

export class UsageError extends Error {}

const truthy = (value: string | undefined) =>
  value !== undefined && ['', 'true', '1', 'yes'].includes(value.trim().toLowerCase())

/** Opções sem valor. */
const FLAGS = new Set(['private', 'private-token', 'help', 'h'])

/**
 * Lê os argumentos. Aceita `--user x`, `--user=x` ou só `x`. No PowerShell, versões antigas do
 * npm engolem o `--`; aí o npm guarda as opções em `npm_config_*`, que também são lidas.
 */
export function parsePreviewArgs(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): PreviewArgs {
  const values: Record<string, string> = {}
  const flags = new Set<string>()
  const positional: string[] = []
  let tokenInArgs = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    const match = /^--?([a-z-]+)(?:=(.*))?$/i.exec(arg)
    if (!match) {
      if (TOKEN_LIKE.test(arg)) tokenInArgs = true
      positional.push(arg)
      continue
    }
    const name = (match[1] ?? '').toLowerCase()
    if (FLAGS.has(name)) {
      // `--private-token=<token>` não é aceito: o token nunca vem da linha de comando.
      if (name === 'private-token' && match[2] !== undefined && !truthy(match[2])) {
        tokenInArgs = true
      }
      flags.add(name === 'h' ? 'help' : name)
    } else if (match[2] !== undefined) {
      values[name] = match[2]
    } else {
      values[name] = argv[++i] ?? ''
    }
  }
  const langValue = values.lang ?? env.npm_config_lang ?? ''
  const lang = parseLang(langValue)
  if (!lang) throw new UsageError(TEXT['pt-BR'].invalidLang(langValue))
  const user = (values.user ?? positional[0] ?? env.npm_config_user ?? '').trim()
  if (tokenInArgs || TOKEN_LIKE.test(user)) throw new UsageError(TEXT[lang].tokenInArgs)
  if (user && !LOGIN.test(user)) throw new UsageError(TEXT[lang].invalidUser(user))
  return {
    user: user || null,
    lang,
    privateContributions: flags.has('private') || truthy(env.npm_config_private),
    privateToken: flags.has('private-token') || truthy(env.npm_config_private_token),
    out: values.out || 'preview',
    help: flags.has('help'),
  }
}

export type RunGh = (args: string[]) => string

export const runGh: RunGh = (args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 15_000,
    windowsHide: true,
  })

/** Token da variável `name`; se estiver vazia, `gh auth token` (quando o GitHub CLI tem login). */
function tokenFrom(
  env: Record<string, string | undefined>,
  name: string,
  gh: RunGh,
): { token: string; source: string } | null {
  const fromEnv = env[name]?.trim()
  if (fromEnv) return { token: fromEnv, source: name }
  try {
    const fromGh = gh(['auth', 'token']).trim()
    if (fromGh) return { token: fromGh, source: 'gh auth token' }
  } catch {
    // gh não instalado ou sem login
  }
  return null
}

/** GITHUB_TOKEN; se estiver vazio, `gh auth token` (quando o GitHub CLI existe e tem login). */
export function resolveToken(
  env: Record<string, string | undefined>,
  gh: RunGh = runGh,
): { token: string; source: string } | null {
  return tokenFrom(env, 'GITHUB_TOKEN', gh)
}

/** Token do modo completo: CODORNA_TOKEN; se estiver vazio, `gh auth token`. */
export function resolvePrivateToken(
  env: Record<string, string | undefined>,
  gh: RunGh = runGh,
): { token: string; source: string } | null {
  return tokenFrom(env, 'CODORNA_TOKEN', gh)
}

export interface PreviewDeps {
  argv: readonly string[]
  env: Record<string, string | undefined>
  /** Pasta onde `preview/` (ou `--out`) é criada. */
  cwd: string
  fetch?: typeof fetch
  gh?: RunGh
  print?: (line: string) => void
  now?: Date
}

export interface PreviewResult {
  character: Character
  files: string[]
}

/** Roda a prévia. Devolve o código de saída (0 ok, 1 erro, 2 uso errado). */
export async function preview(
  deps: PreviewDeps,
): Promise<{ code: number; result?: PreviewResult }> {
  const print = deps.print ?? ((line: string) => console.log(line))
  let args: PreviewArgs
  try {
    args = parsePreviewArgs(deps.argv, deps.env)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    print(error.message)
    print('')
    TEXT['pt-BR'].usage.forEach((line) => print(line))
    return { code: 2 }
  }
  const text = TEXT[args.lang]
  if (args.help || !args.user) {
    text.usage.forEach((line) => print(line))
    return { code: args.help ? 0 : 2 }
  }
  const auth = resolveToken(deps.env, deps.gh)
  if (!auth) {
    text.noToken.forEach((line) => print(line))
    return { code: 1 }
  }
  const privateAuth = args.privateToken ? resolvePrivateToken(deps.env, deps.gh) : null
  if (args.privateToken && !privateAuth) {
    text.noPrivateToken.forEach((line) => print(line))
    return { code: 1 }
  }
  print(text.tokenFrom(auth.source))
  if (privateAuth) print(text.privateTokenFrom(privateAuth.source))
  else if (args.privateContributions) print(text.privateNote)
  const t = strings(args.lang)
  try {
    const common = {
      lang: args.lang,
      apiUrl: deps.env.GITHUB_API_URL,
      graphqlUrl: deps.env.GITHUB_GRAPHQL_URL,
      fetch: deps.fetch,
      log: print,
      warn: (message: string) => print(`! ${message}`),
    }
    const client = new GitHubClient({ token: auth.token, ...common })
    const privateClient = privateAuth
      ? new GitHubClient({ token: privateAuth.token, redact: true, readOnly: true, ...common })
      : undefined
    const data = await collectPlayer({
      client,
      privateClient,
      login: args.user,
      lang: args.lang,
      now: deps.now,
      privateContributions: args.privateContributions,
      log: print,
      warn: (message) => print(`! ${message}`),
    })
    const character = buildCharacter(data)
    const dir = resolve(deps.cwd, args.out)
    mkdirSync(dir, { recursive: true })
    const files: string[] = []
    for (const theme of ['dark', 'light'] as ThemeName[]) {
      const svg = renderCard(character, { theme, lang: args.lang })
      const base = join(dir, `${data.login}-${theme}`)
      writeFileSync(`${base}.svg`, svg)
      writePngIfChanged(`${base}.png`, rasterizeSvg(svg))
      files.push(`${base}.svg`, `${base}.png`)
    }
    // Os dados lidos, no formato das fixtures. No modo completo, só números e linguagens.
    const json = join(dir, `${data.login}.json`)
    writeFileSync(json, `${JSON.stringify(data, null, 2)}\n`)
    files.push(json)
    print('')
    print(
      `@${character.login}: ${t.summary.level} ${character.level.level} · ` +
        `${t.classes[character.classId]} · ${t.ranks[character.rank]} · ` +
        `${formatNumber(character.xp.total, args.lang)} XP`,
    )
    print(text.files)
    for (const file of files) print(`  ${relative(deps.cwd, file) || file}`)
    return { code: 0, result: { character, files } }
  } catch (error) {
    const message =
      error instanceof CodornaCardError
        ? error.message
        : t.errors.unexpected(error instanceof Error ? error.message : String(error))
    print(message)
    return { code: 1 }
  }
}
