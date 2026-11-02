import { createHash } from 'node:crypto'
import { strings } from '../i18n'
import type { Lang } from '../types'
import type { GitHubClient } from './client'
import { CodornaCardError } from './errors'

export interface CommitFile {
  /** Caminho dentro do repositório, com barras normais. */
  path: string
  content: string
}

export interface CommitOptions {
  client: GitHubClient
  owner: string
  repo: string
  branch: string
  files: readonly CommitFile[]
  message: string
  lang: Lang
}

export interface CommitResult {
  committed: boolean
  sha: string | null
}

/**
 * Autor fixo do commit: o bot do GitHub Actions. Assim o commit diário do card
 * nunca conta como contribuição da pessoa, mesmo quando o token é pessoal.
 */
export const BOT_AUTHOR = {
  name: 'github-actions[bot]',
  email: '41898282+github-actions[bot]@users.noreply.github.com',
}

/** SHA-1 de blob do git, para saber se o arquivo mudou sem baixar o conteúdo. */
export function gitBlobSha(content: string): string {
  const bytes = Buffer.from(content, 'utf8')
  return createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`, 'utf8'), bytes]))
    .digest('hex')
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/**
 * Comita os arquivos com a API Git Data (um commit só, mesmo com dois temas).
 * Não precisa de `actions/checkout`. Pula o commit quando nada mudou.
 */
export async function commitFiles(options: CommitOptions, attempt = 1): Promise<CommitResult> {
  const t = strings(options.lang)
  const { client, owner, repo, branch } = options
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  const fail = (status: number, message: string, writing: boolean): never => {
    if (status === 409 || /repository is empty/i.test(message)) {
      throw new CodornaCardError('empty-repository', t.errors.emptyRepository)
    }
    if (/protected branch|branch protection|rule violations|repository rule/i.test(message)) {
      throw new CodornaCardError('protected-branch', t.errors.protectedBranch(branch))
    }
    if (status === 403 || (writing && status === 404)) {
      throw new CodornaCardError('permission', t.errors.noWritePermission)
    }
    throw new CodornaCardError('api', t.errors.api(status, message))
  }

  const ref = await client.rest<{ object: { sha: string } }>(
    'GET',
    `${base}/git/ref/heads/${encodePath(branch)}`,
  )
  if (ref.status === 404) throw new CodornaCardError('branch', t.errors.branchNotFound(branch))
  if (ref.status !== 200 || !ref.data) fail(ref.status, ref.message, false)
  const parentSha = ref.data?.object.sha ?? ''

  const changed: CommitFile[] = []
  for (const file of options.files) {
    const current = await client.rest<{ sha?: string; type?: string } | unknown[]>(
      'GET',
      `${base}/contents/${encodePath(file.path)}?ref=${encodeURIComponent(parentSha)}`,
    )
    if (current.status === 404) {
      changed.push(file)
      continue
    }
    if (current.status !== 200 || !current.data) fail(current.status, current.message, false)
    const existing = Array.isArray(current.data) ? null : current.data
    if (!existing || existing.sha !== gitBlobSha(file.content)) changed.push(file)
  }
  if (changed.length === 0) return { committed: false, sha: null }

  const parent = await client.rest<{ tree: { sha: string } }>(
    'GET',
    `${base}/git/commits/${parentSha}`,
  )
  if (parent.status !== 200 || !parent.data) fail(parent.status, parent.message, false)

  const tree = await client.rest<{ sha: string }>('POST', `${base}/git/trees`, {
    base_tree: parent.data?.tree.sha,
    tree: changed.map((file) => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.content,
    })),
  })
  if (tree.status !== 201 || !tree.data) fail(tree.status, tree.message, true)

  const commit = await client.rest<{ sha: string }>('POST', `${base}/git/commits`, {
    message: options.message,
    tree: tree.data?.sha,
    parents: [parentSha],
    author: BOT_AUTHOR,
  })
  if (commit.status !== 201 || !commit.data) fail(commit.status, commit.message, true)
  const sha = commit.data?.sha ?? ''

  const update = await client.rest('PATCH', `${base}/git/refs/heads/${encodePath(branch)}`, {
    sha,
    force: false,
  })
  if (update.status === 200) return { committed: true, sha }
  // Alguém comitou no meio do caminho: refaz uma vez em cima do commit novo.
  if (update.status === 422 && /fast.?forward/i.test(update.message) && attempt < 2) {
    return commitFiles(options, attempt + 1)
  }
  return fail(update.status, update.message, true)
}
