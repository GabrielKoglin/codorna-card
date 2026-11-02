import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parsePreviewArgs,
  preview,
  resolvePrivateToken,
  resolveToken,
  UsageError,
} from '../scripts/lib/preview'
import { fakeGitHub, privateSample, sampleUser, SECRET_NAMES } from './helpers/fake-github'

const NOW = new Date('2026-11-02T12:00:00Z')

describe('argumentos da prévia', () => {
  it('aceita --user x, --user=x ou só o login', () => {
    expect(parsePreviewArgs(['--user', 'octocat'], {}).user).toBe('octocat')
    expect(parsePreviewArgs(['--user=octocat'], {}).user).toBe('octocat')
    expect(parsePreviewArgs(['octocat'], {}).user).toBe('octocat')
    expect(parsePreviewArgs([], {}).user).toBeNull()
  })

  it('lê npm_config_* quando o PowerShell engole o --', () => {
    const args = parsePreviewArgs([], {
      npm_config_user: 'octocat',
      npm_config_lang: 'en',
      npm_config_private: 'true',
    })
    expect(args).toMatchObject({ user: 'octocat', lang: 'en', privateContributions: true })
  })

  it('idioma, privadas, pasta de saída e ajuda', () => {
    expect(parsePreviewArgs(['--user', 'a', '--lang', 'en-US'], {}).lang).toBe('en')
    expect(parsePreviewArgs(['--user', 'a'], {})).toMatchObject({
      lang: 'pt-BR',
      privateContributions: false,
      out: 'preview',
      help: false,
    })
    expect(parsePreviewArgs(['a', '--private', '--out', 'tmp/x'], {})).toMatchObject({
      privateContributions: true,
      out: 'tmp/x',
    })
    expect(parsePreviewArgs(['--help'], {}).help).toBe(true)
  })

  it('recusa login e idioma inválidos', () => {
    expect(() => parsePreviewArgs(['--user', 'nome com espaço'], {})).toThrow(UsageError)
    expect(() => parsePreviewArgs(['--user', 'a', '--lang', 'fr'], {})).toThrow('Idioma inválido')
  })

  it('--private-token liga o modo completo (também por npm_config_private_token)', () => {
    expect(parsePreviewArgs(['--user', 'a', '--private-token'], {}).privateToken).toBe(true)
    expect(parsePreviewArgs(['a', '--private-token=true'], {}).privateToken).toBe(true)
    expect(parsePreviewArgs(['a'], {}).privateToken).toBe(false)
    expect(
      parsePreviewArgs([], { npm_config_user: 'a', npm_config_private_token: 'true' }),
    ).toMatchObject({ user: 'a', privateToken: true })
  })

  it('nunca aceita token na linha de comando e não repete o valor', () => {
    for (const argv of [
      ['--user', 'a', '--private-token=ghp_abc123'],
      ['ghp_abc123', '--private-token'],
      ['--user', 'github_pat_11ABCdef'],
      ['--user', 'a', '--private-token', 'gho_xyz'],
    ]) {
      let message = ''
      try {
        parsePreviewArgs(argv, {})
      } catch (error) {
        message = (error as Error).message
      }
      expect(message, argv.join(' ')).toContain('Não passe tokens na linha de comando')
      expect(message).not.toMatch(/gh[po]_|github_pat_/)
    }
  })
})

describe('token da prévia', () => {
  it('GITHUB_TOKEN primeiro; vazio, usa o gh; sem nada, null', () => {
    const gh = () => 'do-gh\n'
    expect(resolveToken({ GITHUB_TOKEN: 'da-env' }, gh)).toEqual({
      token: 'da-env',
      source: 'GITHUB_TOKEN',
    })
    expect(resolveToken({ GITHUB_TOKEN: '  ' }, gh)).toEqual({
      token: 'do-gh',
      source: 'gh auth token',
    })
    expect(
      resolveToken({}, () => {
        throw new Error('gh não encontrado')
      }),
    ).toBeNull()
    expect(resolveToken({}, () => '')).toBeNull()
  })

  it('token privado: CODORNA_TOKEN primeiro; vazio, usa o gh; sem nada, null', () => {
    const gh = () => 'do-gh\n'
    expect(resolvePrivateToken({ CODORNA_TOKEN: 'fino', GITHUB_TOKEN: 'outro' }, gh)).toEqual({
      token: 'fino',
      source: 'CODORNA_TOKEN',
    })
    expect(resolvePrivateToken({ CODORNA_TOKEN: ' ', GITHUB_TOKEN: 'outro' }, gh)).toEqual({
      token: 'do-gh',
      source: 'gh auth token',
    })
    expect(
      resolvePrivateToken({ GITHUB_TOKEN: 'outro' }, () => {
        throw new Error('gh não encontrado')
      }),
    ).toBeNull()
  })
})

describe('prévia de ponta a ponta (API falsa)', () => {
  const run = async (argv: string[], env: Record<string, string> = { GITHUB_TOKEN: 'x' }) => {
    const cwd = mkdtempSync(join(tmpdir(), 'codorna-preview-'))
    const fake = fakeGitHub({ user: sampleUser({ restricted: [{ year: 2026, count: 42 }] }) })
    const lines: string[] = []
    const outcome = await preview({
      argv,
      env,
      cwd,
      fetch: fake.fetch,
      gh: () => '',
      print: (line) => lines.push(line),
      now: NOW,
    })
    return { ...outcome, cwd, lines, calls: fake.calls }
  }

  it('gera os dois temas em SVG e PNG, mais os dados, sem comitar', async () => {
    const { code, cwd, lines, calls, result } = await run(['--user', 'pixel-dev'])
    expect(code).toBe(0)
    for (const file of ['Pixel-Dev-dark.svg', 'Pixel-Dev-light.svg', 'Pixel-Dev-dark.png']) {
      expect(existsSync(join(cwd, 'preview', file)), file).toBe(true)
    }
    const data = JSON.parse(readFileSync(join(cwd, 'preview', 'Pixel-Dev.json'), 'utf8'))
    expect(data.login).toBe('Pixel-Dev')
    expect(readFileSync(join(cwd, 'preview', 'Pixel-Dev-dark.svg'), 'utf8')).toContain(
      'Codorna Card de @Pixel-Dev',
    )
    expect(result?.character.xp.privateContributions).toBe(0)
    expect(calls.every((c) => c.url.endsWith('/graphql'))).toBe(true) // nada de REST: sem commit
    expect(lines).toContain('Token: GITHUB_TOKEN.')
  })

  it('--private soma as privadas; --lang en muda o card', async () => {
    const { code, cwd, result } = await run(['pixel-dev', '--private', '--lang', 'en'])
    expect(code).toBe(0)
    expect(result?.character.activity.privateContributions.raw).toBe(42)
    expect(readFileSync(join(cwd, 'preview', 'Pixel-Dev-light.svg'), 'utf8')).toContain(
      '42 private contributions',
    )
  })

  it('--private-token: modo completo sem nenhum nome privado nos arquivos nem na tela', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'codorna-preview-'))
    const privateToken = 'github_pat_11PREVIEWsecreto_zzz'
    const fake = fakeGitHub({ user: sampleUser(privateSample()), privateToken })
    const lines: string[] = []
    const { code, result } = await preview({
      argv: ['--user', 'pixel-dev', '--private-token', '--private'],
      env: { GITHUB_TOKEN: 'publico', CODORNA_TOKEN: privateToken },
      cwd,
      fetch: fake.fetch,
      gh: () => '',
      print: (line) => lines.push(line),
      now: NOW,
    })
    expect(code).toBe(0)
    expect(result?.character.activity.commits.privateRaw).toBe(34)
    expect(lines).toContain(
      'Token privado (modo completo, só leitura): CODORNA_TOKEN. Só totais aparecem: nenhum nome privado.',
    )
    const outputs = [
      ...['Pixel-Dev-dark.svg', 'Pixel-Dev-light.svg', 'Pixel-Dev.json'].map((file) =>
        readFileSync(join(cwd, 'preview', file), 'utf8'),
      ),
      ...lines,
    ].join('\n')
    for (const secret of SECRET_NAMES) expect(outputs, secret).not.toContain(secret)
    expect(outputs).not.toContain(privateToken)
    expect(readFileSync(join(cwd, 'preview', 'Pixel-Dev-dark.svg'), 'utf8')).toContain(
      '45 contribuições privadas',
    )
    // O token privado só fez consultas privadas.
    for (const call of fake.calls.filter((c) => c.token === privateToken)) {
      expect(call.operation).toMatch(/^CodornaPrivate/)
    }
  })

  it('--private-token sem CODORNA_TOKEN nem gh explica como configurar', async () => {
    const { code, lines } = await run(['pixel-dev', '--private-token'], { GITHUB_TOKEN: 'x' })
    expect(code).toBe(1)
    expect(lines.join('\n')).toContain('$env:CODORNA_TOKEN')
  })

  it('sem login mostra o uso; sem token explica como configurar', async () => {
    const noUser = await run([])
    expect(noUser.code).toBe(2)
    expect(noUser.lines[0]).toContain('npm run preview -- --user <login>')
    const noToken = await run(['pixel-dev'], {})
    expect(noToken.code).toBe(1)
    expect(noToken.lines.join('\n')).toContain('$env:GITHUB_TOKEN')
  })
})
