import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPTIONS,
  WORKFLOW_PATH,
  cleanLogin,
  installLinks,
  publishedCardUrl,
  readmeSnippet,
  runWorkflowLink,
  templateRepoLink,
  TEMPLATE_NAME,
  TEMPLATE_OWNER,
  workflowYaml,
} from '../src/install/links'

const params = (url: string) => new URL(url).searchParams

describe('página de instalação', () => {
  it('limpa o login e recusa o que o GitHub não aceita', () => {
    expect(cleanLogin('  @GabrielKoglin ')).toBe('GabrielKoglin')
    expect(cleanLogin('a')).toBe('a')
    expect(cleanLogin('x-1')).toBe('x-1')
    expect(cleanLogin('a' + '-b'.repeat(19))).toBe('a' + '-b'.repeat(19))
    for (const ruim of ['', '-a', 'a-', 'a--b', 'a b', 'a/b', 'a'.repeat(40), 'ção']) {
      expect(cleanLogin(ruim), ruim).toBeNull()
    }
  })

  it('o workflow padrão roda todo dia, no botão e no primeiro commit do próprio arquivo', () => {
    const yaml = workflowYaml()
    expect(yaml).toContain("- cron: '23 4 * * *'")
    expect(yaml).toContain('  workflow_dispatch:')
    expect(yaml).toContain(`  push:\n    paths:\n      - ${WORKFLOW_PATH}\n`)
    expect(yaml).toContain('permissions:\n  contents: write')
    expect(yaml.trimEnd().endsWith('- uses: GabrielKoglin/codorna-card@v1')).toBe(true)
    expect(yaml).not.toContain('with:')
  })

  it('as opções viram entradas da Action, só quando mudam o padrão', () => {
    const yaml = workflowYaml({ theme: 'both', lang: 'en', privateContributions: true })
    expect(yaml).toContain(
      '      - uses: GabrielKoglin/codorna-card@v1\n' +
        '        with:\n' +
        '          theme: both\n' +
        '          lang: en\n' +
        '          private-contributions: true\n',
    )
    expect(workflowYaml({ ...DEFAULT_OPTIONS, theme: 'light' })).toContain('theme: light')
    expect(workflowYaml({ ...DEFAULT_OPTIONS, theme: 'light' })).not.toContain('lang:')
  })

  it('o README ganha a imagem, ou o <picture> com os dois temas', () => {
    expect(readmeSnippet('dark')).toBe('![Codorna Card](codorna-card.svg)')
    expect(readmeSnippet('light')).toBe('![Codorna Card](codorna-card.svg)')
    const both = readmeSnippet('both')
    expect(both).toContain('srcset="codorna-card-dark.svg"')
    expect(both).toContain('src="codorna-card-light.svg"')
  })

  it('os links abrem o GitHub já preenchido, com tudo codificado', () => {
    const options = { theme: 'both' as const, lang: 'pt-BR' as const, privateContributions: true }
    const links = installLinks('maria-dev', options)
    const novo = params(links.createRepo)
    expect(links.createRepo.startsWith('https://github.com/new?')).toBe(true)
    expect(novo.get('name')).toBe('maria-dev')
    expect(novo.get('visibility')).toBe('public')

    expect(
      links.installWorkflow.startsWith('https://github.com/maria-dev/maria-dev/new/main?'),
    ).toBe(true)
    const arquivo = params(links.installWorkflow)
    expect(arquivo.get('filename')).toBe(WORKFLOW_PATH)
    // O valor volta igual depois de decodificado: aspas, dois-pontos e quebras de linha.
    expect(arquivo.get('value')).toBe(workflowYaml(options))
    expect(links.installWorkflow).not.toContain('\n')
    expect(links.installWorkflow).not.toContain(' ')

    expect(links.readme).toBe('https://github.com/maria-dev/maria-dev/edit/main/README.md')
  })

  it('usa a branch padrão do repositório e cria o README quando ele não existe', () => {
    const links = installLinks('maria-dev', DEFAULT_OPTIONS, {
      exists: true,
      defaultBranch: 'master',
      hasReadme: false,
    })
    expect(links.installWorkflow).toContain('/maria-dev/maria-dev/new/master?')
    expect(links.readme.startsWith('https://github.com/maria-dev/maria-dev/new/master?')).toBe(true)
    expect(params(links.readme).get('filename')).toBe('README.md')
    expect(params(links.readme).get('value')).toBe('![Codorna Card](codorna-card.svg)\n')
  })

  it('a prévia usa o card já publicado no perfil', () => {
    expect(publishedCardUrl('maria-dev', 'dark')).toBe(
      'https://raw.githubusercontent.com/maria-dev/maria-dev/HEAD/codorna-card.svg',
    )
    expect(publishedCardUrl('maria-dev', 'both')).toContain('/HEAD/codorna-card-dark.svg')
  })
})

describe('caminho do modelo', () => {
  it('cria o perfil a partir do modelo, com o nome do usuário e público', () => {
    const p = params(templateRepoLink('mano-dev'))
    expect(p.get('template_owner')).toBe(TEMPLATE_OWNER)
    expect(p.get('template_name')).toBe(TEMPLATE_NAME)
    expect(p.get('owner')).toBe('mano-dev')
    expect(p.get('name')).toBe('mano-dev')
    expect(p.get('visibility')).toBe('public')
  })

  it('a descrição segue o idioma', () => {
    expect(params(templateRepoLink('a', 'en')).get('description')).toBe('My GitHub profile')
    expect(params(templateRepoLink('a')).get('description')).toBe('Meu perfil no GitHub')
  })

  it('o botão de gerar agora abre o workflow no perfil da pessoa', () => {
    expect(runWorkflowLink('mano-dev')).toBe(
      'https://github.com/mano-dev/mano-dev/actions/workflows/codorna-card.yml',
    )
    expect(runWorkflowLink('mano-dev')).toContain(WORKFLOW_PATH.split('/').pop()!)
  })
})
