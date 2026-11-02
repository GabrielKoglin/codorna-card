import { randomUUID } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { EOL } from 'node:os'

/**
 * O mínimo do toolkit do GitHub Actions (entradas, saídas, logs e resumo),
 * sem dependências: o `dist/` fica pequeno e fácil de auditar.
 */

export type Env = Record<string, string | undefined>

export interface Logger {
  info(message: string): void
  warning(message: string): void
  error(message: string): void
  group<T>(title: string, fn: () => Promise<T>): Promise<T>
  /** Esconde um segredo de todos os logs seguintes do job (como o `setSecret` do toolkit). */
  mask(secret: string): void
}

/** Escapa o texto de um comando de workflow (`::warning::` etc.). */
export function escapeCommand(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

export function consoleLogger(
  write: (line: string) => void = (line) => process.stdout.write(line + EOL),
): Logger {
  return {
    info: (message) => write(message),
    warning: (message) => write(`::warning::${escapeCommand(message)}`),
    error: (message) => write(`::error::${escapeCommand(message)}`),
    async group(title, fn) {
      write(`::group::${escapeCommand(title)}`)
      try {
        return await fn()
      } finally {
        write('::endgroup::')
      }
    },
    // O mesmo comando que o `core.setSecret` do @actions/core emite.
    mask: (secret) => {
      if (secret) write(`::add-mask::${escapeCommand(secret)}`)
    },
  }
}

/** Lê uma entrada da Action (variável `INPUT_<NOME>`). */
export function getInput(env: Env, name: string): string {
  return (env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? '').trim()
}

/** Grava uma saída no arquivo `GITHUB_OUTPUT`. */
export function setOutput(env: Env, name: string, value: string): void {
  const file = env.GITHUB_OUTPUT
  if (!file) return
  const delimiter = `ghadelimiter_${randomUUID()}`
  appendFileSync(file, `${name}<<${delimiter}${EOL}${value}${EOL}${delimiter}${EOL}`, 'utf8')
}

/** Acrescenta markdown ao resumo do job (`GITHUB_STEP_SUMMARY`). */
export function appendSummary(env: Env, markdown: string): void {
  const file = env.GITHUB_STEP_SUMMARY
  if (!file) return
  appendFileSync(file, markdown + EOL, 'utf8')
}
