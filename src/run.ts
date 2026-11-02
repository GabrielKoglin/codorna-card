import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { appendSummary, consoleLogger, setOutput, type Env, type Logger } from './actions'
import { buildCharacter, type Character } from './character'
import { GitHubClient } from './github/client'
import { collectPlayer } from './github/collect'
import { commitFiles } from './github/commit'
import { CodornaCardError } from './github/errors'
import { formatNumber, strings } from './i18n'
import { outputFiles, parseLang, readInputs, type Inputs } from './inputs'
import { renderCard } from './render/card'
import type { Lang, PlayerData } from './types'

export interface RunDependencies {
  env: Env
  logger?: Logger
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: Date
}

export interface RunResult {
  character: Character
  files: { path: string; content: string }[]
  committed: boolean
  commitSha: string | null
}

/** Endereço do projeto (usado no resumo do job). */
export const PROJECT_URL = 'https://github.com/GabrielKoglin/codorna-card'
/** Regras completas no idioma do resumo. */
const RULES_URL: Record<Lang, string> = {
  'pt-BR': `${PROJECT_URL}/blob/main/docs/regras.md`,
  en: `${PROJECT_URL}/blob/main/docs/rules.md`,
}

/** Uma linha da conta do XP: público, privado (modo completo), quanto conta e o XP. */
type SummaryRow = [
  label: string,
  raw: number | null,
  privateRaw: number,
  counted: number,
  xp: number,
]

/**
 * Resumo do job com a conta do XP. No modo completo ganha a coluna "Privado" (só totais) e a
 * quantidade de repositórios privados lidos e pulados; nenhum nome privado entra aqui.
 */
function summaryMarkdown(
  character: Character,
  inputs: Inputs,
  files: string[],
  data: PlayerData,
): string {
  const t = strings(inputs.lang)
  const n = (value: number) => formatNumber(value, inputs.lang)
  const a = character.activity
  const xp = character.xp
  const full = data.private
  const rows: SummaryRow[] = [
    [t.summary.rows.commits, a.commits.raw, a.commits.privateRaw, a.commits.counted, xp.commits],
    [t.summary.rows.issues, a.issues.raw, a.issues.privateRaw, a.issues.counted, xp.issues],
    [
      t.summary.rows.pullRequests,
      a.pullRequests.raw,
      a.pullRequests.privateRaw,
      a.pullRequests.counted,
      xp.pullRequests,
    ],
    [t.summary.rows.reviews, a.reviews.raw, a.reviews.privateRaw, a.reviews.counted, xp.reviews],
    [t.summary.rows.merged, a.merged.raw, a.merged.privateRaw, a.merged.counted, xp.merged],
    [
      t.summary.rows.mergedElsewhere,
      a.mergedElsewhere.raw,
      a.mergedElsewhere.privateRaw,
      a.mergedElsewhere.counted,
      xp.mergedElsewhere,
    ],
  ]
  if (inputs.privateContributions) {
    rows.push(
      full
        ? [
            t.summary.rows.restrictedBeyondToken,
            null,
            a.privateContributions.raw,
            a.privateContributions.counted,
            xp.privateContributions,
          ]
        : [
            t.summary.rows.privateContributions,
            a.privateContributions.raw,
            0,
            a.privateContributions.counted,
            xp.privateContributions,
          ],
    )
  }
  const table = full
    ? [
        `| ${t.summary.source} | ${t.summary.publicLabel} | ${t.summary.privateLabel} | ${t.summary.counted} | XP |`,
        '| --- | ---: | ---: | ---: | ---: |',
        ...rows.map(
          ([label, raw, privateRaw, counted, points]) =>
            `| ${label} | ${raw === null ? '—' : n(raw)} | ${n(privateRaw)} | ${n(counted)} | ${n(points)} |`,
        ),
        `| **Total** | | | | **${n(xp.total)}** |`,
        '',
        t.summary.fullMode(full.scannedRepositories, full.skippedRepositories),
      ]
    : [
        `| ${t.summary.source} | ${t.summary.rawLabel} | ${t.summary.counted} | XP |`,
        '| --- | ---: | ---: | ---: |',
        ...rows.map(
          ([label, raw, , counted, points]) =>
            `| ${label} | ${n(raw ?? 0)} | ${n(counted)} | ${n(points)} |`,
        ),
        `| **Total** | | | **${n(xp.total)}** |`,
      ]
  return [
    `## ${t.summary.title(character.login)}`,
    '',
    `**${t.summary.level} ${character.level.level}** · ${t.classes[character.classId]} · ${t.ranks[character.rank]} · ${n(xp.total)} XP`,
    '',
    ...table,
    '',
    `${t.summary.files}: ${files.map((file) => `\`${file}\``).join(', ')}`,
    '',
    `${t.summary.rules}: ${RULES_URL[inputs.lang]}`,
    '',
  ].join('\n')
}

/** Executa a Action: coleta, calcula, desenha, salva e (opcionalmente) comita. */
export async function run(deps: RunDependencies): Promise<RunResult> {
  const env = deps.env
  const logger = deps.logger ?? consoleLogger()
  const inputs = readInputs(env)
  const t = strings(inputs.lang)
  // Antes de qualquer log: os tokens nunca aparecem, nem por engano.
  logger.mask(inputs.token)
  if (inputs.privateToken) logger.mask(inputs.privateToken)

  const common = {
    lang: inputs.lang,
    apiUrl: env.GITHUB_API_URL,
    graphqlUrl: env.GITHUB_GRAPHQL_URL,
    fetch: deps.fetch,
    sleep: deps.sleep,
    log: (message: string) => logger.info(message),
    warn: (message: string) => logger.warning(message),
  }
  const client = new GitHubClient({ token: inputs.token, ...common })
  // O private-token só lê (nada de mutação nem REST que escreve) e os erros dele nunca levam
  // texto da API, que pode citar repositórios e organizações privadas.
  const privateClient = inputs.privateToken
    ? new GitHubClient({ token: inputs.privateToken, redact: true, readOnly: true, ...common })
    : undefined

  const data = await logger.group(`Codorna Card · @${inputs.username}`, () =>
    collectPlayer({
      client,
      privateClient,
      login: inputs.username,
      lang: inputs.lang,
      now: deps.now,
      privateContributions: inputs.privateContributions,
      log: (message) => logger.info(message),
      warn: (message) => logger.warning(message),
    }),
  )
  const character = buildCharacter(data)
  logger.info(
    t.log.result(
      character.level.level,
      t.classes[character.classId],
      formatNumber(character.xp.total, inputs.lang),
    ),
  )

  const workspace = env.GITHUB_WORKSPACE || process.cwd()
  const files = outputFiles(inputs.output, inputs.theme).map(({ theme, path }) => ({
    path,
    content: renderCard(character, { theme, lang: inputs.lang }),
  }))
  for (const file of files) {
    const target = resolve(workspace, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.content, 'utf8')
    logger.info(t.log.wrote(file.path))
  }

  let committed = false
  let commitSha: string | null = null
  if (!inputs.commit) {
    logger.info(t.log.commitDisabled)
  } else {
    const [owner, repo] = (env.GITHUB_REPOSITORY ?? '').split('/')
    const ref = env.GITHUB_REF ?? ''
    if (!owner || !repo) {
      logger.warning(t.log.noRepository)
    } else if (!ref.startsWith('refs/heads/')) {
      logger.warning(t.log.notOnBranch(ref))
    } else {
      const branch = ref.slice('refs/heads/'.length)
      const result = await commitFiles({
        client,
        owner,
        repo,
        branch,
        files,
        message: t.commitMessage,
        lang: inputs.lang,
      })
      committed = result.committed
      commitSha = result.sha
      logger.info(result.sha ? t.log.committed(result.sha, branch) : t.log.unchanged)
    }
  }

  setOutput(env, 'level', String(character.level.level))
  setOutput(env, 'xp', String(character.xp.total))
  setOutput(env, 'class', character.classId)
  setOutput(env, 'class-name', t.classes[character.classId])
  setOutput(env, 'rank', character.rank)
  setOutput(env, 'files', files.map((file) => file.path).join('\n'))
  setOutput(env, 'committed', String(committed))
  appendSummary(
    env,
    summaryMarkdown(
      character,
      inputs,
      files.map((file) => file.path),
      data,
    ),
  )

  return { character, files, committed, commitSha }
}

/** Ponto de entrada: transforma qualquer erro em falha do step, com mensagem clara. */
export async function main(
  env: Env = process.env,
  logger: Logger = consoleLogger(),
): Promise<number> {
  try {
    await run({ env, logger })
    return 0
  } catch (error) {
    const lang = parseLang(env.INPUT_LANG ?? '') ?? 'pt-BR'
    const message =
      error instanceof CodornaCardError
        ? error.message
        : strings(lang).errors.unexpected(error instanceof Error ? error.message : String(error))
    logger.error(message)
    return 1
  }
}
