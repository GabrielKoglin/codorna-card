// A parte pura da página "Instalar o Codorna Card" (site/): monta o workflow e os links do
// GitHub já preenchidos. Sem DOM e sem rede, para ser testada no Node.

import type { Lang, ThemeName } from '../types'

/** O tema da entrada `theme` da Action: um dos dois, ou os dois arquivos. */
export type InstallTheme = ThemeName | 'both'

/** O que a pessoa escolhe na página. */
export interface InstallOptions {
  theme: InstallTheme
  lang: Lang
  /** Soma ao XP o total de contribuições privadas que o GitHub mostra no perfil. */
  privateContributions: boolean
}

export const DEFAULT_OPTIONS: InstallOptions = {
  theme: 'dark',
  lang: 'pt-BR',
  privateContributions: false,
}

/** Onde o workflow mora no repositório do perfil. */
export const WORKFLOW_PATH = '.github/workflows/codorna-card.yml'

/**
 * Login do GitHub: letras, números e hífens, sem começar nem terminar com hífen e sem dois
 * hífens seguidos, até 39 caracteres. Devolve o login limpo (sem espaços e sem "@" na frente)
 * ou null se não vale.
 */
export function cleanLogin(raw: string): string | null {
  const login = raw.trim().replace(/^@/, '')
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(login) ? login : null
}

/**
 * O workflow do Codorna Card. Além do agendamento diário e do botão "Run workflow", ele roda
 * sozinho quando o próprio arquivo é comitado (o primeiro commit já gera o card). O commit do
 * SVG, feito pelo GITHUB_TOKEN, não dispara workflows, então isso não vira um laço.
 */
export function workflowYaml(options: InstallOptions = DEFAULT_OPTIONS): string {
  const inputs: string[] = []
  if (options.theme !== DEFAULT_OPTIONS.theme) inputs.push(`theme: ${options.theme}`)
  if (options.lang !== DEFAULT_OPTIONS.lang) inputs.push(`lang: ${options.lang}`)
  if (options.privateContributions) inputs.push('private-contributions: true')
  const lines = [
    'name: Codorna Card',
    'on:',
    '  schedule:',
    "    - cron: '23 4 * * *'",
    '  workflow_dispatch:',
    '  push:',
    '    paths:',
    `      - ${WORKFLOW_PATH}`,
    'permissions:',
    '  contents: write',
    'jobs:',
    '  codorna-card:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: GabrielKoglin/codorna-card@v1',
  ]
  if (inputs.length > 0) {
    lines.push('        with:')
    for (const input of inputs) lines.push(`          ${input}`)
  }
  return lines.join('\n') + '\n'
}

/** O que vai no README do perfil: a imagem, ou o <picture> com os dois temas. */
export function readmeSnippet(theme: InstallTheme): string {
  if (theme !== 'both') return '![Codorna Card](codorna-card.svg)'
  return [
    '<picture>',
    '  <source media="(prefers-color-scheme: dark)" srcset="codorna-card-dark.svg" />',
    '  <img alt="Codorna Card" src="codorna-card-light.svg" />',
    '</picture>',
  ].join('\n')
}

/** Os três links da página, cada um abrindo o GitHub já preenchido. */
export interface InstallLinks {
  /** Cria o repositório do perfil (login/login), público. */
  createRepo: string
  /** Abre o arquivo do workflow já escrito: é só clicar em Commit. */
  installWorkflow: string
  /** Edita o README existente, ou cria um já com a linha do card. */
  readme: string
}

/** Quanto a página sabe do repositório do perfil (pela API pública; null se não sabe). */
export interface RepoInfo {
  exists: boolean | null
  defaultBranch: string | null
  hasReadme: boolean | null
}

export const UNKNOWN_REPO: RepoInfo = { exists: null, defaultBranch: null, hasReadme: null }

const query = (params: Record<string, string>) =>
  Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

export function installLinks(
  login: string,
  options: InstallOptions = DEFAULT_OPTIONS,
  repo: RepoInfo = UNKNOWN_REPO,
): InstallLinks {
  const name = encodeURIComponent(login)
  const base = `https://github.com/${name}/${name}`
  // Sem saber a branch padrão, "main" é o padrão de repositório novo no GitHub.
  const branch = encodeURIComponent(repo.defaultBranch ?? 'main')
  const description = options.lang === 'en' ? 'My GitHub profile' : 'Meu perfil no GitHub'
  const snippet = readmeSnippet(options.theme)
  return {
    createRepo: `https://github.com/new?${query({ name: login, visibility: 'public', description })}`,
    installWorkflow: `${base}/new/${branch}?${query({ filename: WORKFLOW_PATH, value: workflowYaml(options) })}`,
    readme:
      repo.hasReadme === false
        ? `${base}/new/${branch}?${query({ filename: 'README.md', value: snippet + '\n' })}`
        : `${base}/edit/${branch}/README.md`,
  }
}

/** O SVG do card já publicado no perfil, se existir (para a prévia). */
export function publishedCardUrl(login: string, theme: InstallTheme): string {
  const name = encodeURIComponent(login)
  const file = theme === 'both' ? 'codorna-card-dark.svg' : 'codorna-card.svg'
  return `https://raw.githubusercontent.com/${name}/${name}/HEAD/${file}`
}
