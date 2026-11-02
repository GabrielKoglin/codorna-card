import { describe, expect, it } from 'vitest'
import { GitHubClient } from '../src/github/client'
import { BOT_AUTHOR, commitFiles, gitBlobSha, type CommitFile } from '../src/github/commit'
import type { CodornaCardError } from '../src/github/errors'
import { fakeGitHub, type FakeOptions } from './helpers/fake-github'

const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status })

function setup(options: FakeOptions, files: CommitFile[]) {
  const fake = fakeGitHub(options)
  const client = new GitHubClient({
    token: 'x',
    lang: 'pt-BR',
    fetch: fake.fetch,
    sleep: async () => {},
  })
  const run = () =>
    commitFiles({
      client,
      owner: 'pixel-dev',
      repo: 'pixel-dev',
      branch: 'main',
      files,
      message: 'Atualiza o Codorna Card',
      lang: 'pt-BR',
    })
  return { run, calls: fake.calls }
}

const DARK = { path: 'codorna-card-dark.svg', content: '<svg>dark</svg>\n' }
const LIGHT = { path: 'codorna-card-light.svg', content: '<svg>light</svg>\n' }

describe('commit pela API', () => {
  it('calcula o SHA de blob igual ao git', () => {
    // echo hello | git hash-object --stdin
    expect(gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
  })

  it('cria um commit só com os dois temas, assinado pelo bot', async () => {
    const repo = { branch: 'main', headSha: 'abc123', files: [] }
    const { run, calls } = setup({ repo }, [DARK, LIGHT])
    await expect(run()).resolves.toEqual({ committed: true, sha: 'c0ffee1234567890' })
    const tree = calls.find((c) => c.method === 'POST' && c.url.endsWith('/git/trees'))?.body as {
      base_tree: string
      tree: { path: string; content: string; mode: string }[]
    }
    expect(tree.base_tree).toBe('tree-base')
    expect(tree.tree.map((t) => [t.path, t.mode])).toEqual([
      ['codorna-card-dark.svg', '100644'],
      ['codorna-card-light.svg', '100644'],
    ])
    const commit = calls.find((c) => c.method === 'POST' && c.url.endsWith('/git/commits'))
      ?.body as {
      parents: string[]
      author: typeof BOT_AUTHOR
      message: string
    }
    expect(commit.parents).toEqual(['abc123'])
    expect(commit.author).toEqual(BOT_AUTHOR)
    expect(commit.message).toBe('Atualiza o Codorna Card')
    expect(repo.headSha).toBe('c0ffee1234567890')
  })

  it('não comita quando nada mudou', async () => {
    const repo = {
      branch: 'main',
      headSha: 'abc123',
      files: [
        { path: DARK.path, sha: gitBlobSha(DARK.content) },
        { path: LIGHT.path, sha: gitBlobSha(LIGHT.content) },
      ],
    }
    const { run, calls } = setup({ repo }, [DARK, LIGHT])
    await expect(run()).resolves.toEqual({ committed: false, sha: null })
    expect(calls.some((c) => c.method !== 'GET')).toBe(false)
  })

  it('manda só o arquivo que mudou', async () => {
    const repo = {
      branch: 'main',
      headSha: 'abc123',
      files: [{ path: DARK.path, sha: gitBlobSha(DARK.content) }],
    }
    const { run, calls } = setup({ repo }, [DARK, LIGHT])
    await run()
    const tree = calls.find((c) => c.url.endsWith('/git/trees'))?.body as {
      tree: { path: string }[]
    }
    expect(tree.tree.map((t) => t.path)).toEqual([LIGHT.path])
  })

  it('branch inexistente', async () => {
    const { run } = setup({ repo: { branch: 'outra', headSha: 'x', files: [] } }, [DARK])
    const error = (await run().catch((e: unknown) => e)) as CodornaCardError
    expect(error.code).toBe('branch')
  })

  it('sem permissão de escrita explica o que pôr no workflow', async () => {
    const repo = { branch: 'main', headSha: 'abc123', files: [] }
    const { run } = setup(
      {
        repo,
        queue: [
          json(200, { object: { sha: 'abc123' } }),
          json(404, { message: 'Not Found' }),
          json(200, { tree: { sha: 'tree-base' } }),
          json(403, { message: 'Resource not accessible by integration' }),
        ],
      },
      [DARK],
    )
    const error = (await run().catch((e: unknown) => e)) as CodornaCardError
    expect(error.code).toBe('permission')
    expect(error.message).toContain('contents: write')
  })

  it('branch protegida', async () => {
    const repo = { branch: 'main', headSha: 'abc123', files: [] }
    const { run } = setup(
      {
        repo,
        queue: [
          json(200, { object: { sha: 'abc123' } }),
          json(404, { message: 'Not Found' }),
          json(200, { tree: { sha: 'tree-base' } }),
          json(201, { sha: 'tree-new' }),
          json(201, { sha: 'commit-new' }),
          json(422, { message: 'Protected branch update failed for refs/heads/main.' }),
        ],
      },
      [DARK],
    )
    expect(((await run().catch((e: unknown) => e)) as CodornaCardError).code).toBe(
      'protected-branch',
    )
  })

  it('repositório vazio', async () => {
    const { run } = setup(
      {
        repo: { branch: 'main', headSha: 'x', files: [] },
        queue: [json(409, { message: 'Git Repository is empty.' })],
      },
      [DARK],
    )
    expect(((await run().catch((e: unknown) => e)) as CodornaCardError).code).toBe(
      'empty-repository',
    )
  })
})
