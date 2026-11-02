/**
 * Prévia local do card de qualquer pessoa, sem comitar nada.
 * Uso: npm run preview -- --user <login> [--lang pt-BR|en] [--private] [--out <pasta>]
 * Token: GITHUB_TOKEN ou, se estiver vazio, `gh auth token`.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from './lib/preview'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { code } = await preview({ argv: process.argv.slice(2), env: process.env, cwd: root })
process.exitCode = code
