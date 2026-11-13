// A página "Instalar o Codorna Card": lê o usuário, consulta a API pública do GitHub (sem token)
// só para saber se o repositório do perfil existe e qual a branch, e monta os 3 links.
// As regras (o workflow e os links) estão em src/install/links.ts, testadas no Node.

import exemploEscuro from '../examples/iniciante-dark-pt-BR.svg?url'
import exemploClaro from '../examples/iniciante-light-pt-BR.svg?url'
import {
  UNKNOWN_REPO,
  cleanLogin,
  installLinks,
  publishedCardUrl,
  readmeSnippet,
  runWorkflowLink,
  templateRepoLink,
  workflowYaml,
  type InstallOptions,
  type InstallTheme,
  type RepoInfo,
} from '../src/install/links'

type PageLang = 'pt-BR' | 'en'

const TEXTOS: Record<PageLang, Record<string, string>> = {
  'pt-BR': {
    title: 'Instalar o Codorna Card',
    subtitle: 'Seu GitHub vira um card de RPG em pixel art, em 3 cliques.',
    step1: '1. Quem é você no GitHub?',
    loginLabel: 'Seu usuário do GitHub',
    go: 'Continuar',
    options: 'Opções do card',
    theme: 'Tema',
    themeDark: 'Escuro',
    themeLight: 'Claro',
    themeBoth: 'Os dois (segue o tema de quem visita)',
    cardLang: 'Idioma do card',
    private: 'Contar as minhas contribuições privadas',
    privateHelp:
      'Só o total entra, sem nenhum nome de repositório. Ligue também no seu perfil: acima do gráfico de contribuições, Contribution settings → Private contributions.',
    step2: '2. Instale em 3 cliques',
    step2Template: '2. Instale em 2 cliques',
    modeloTitle: 'Criar o perfil com o card',
    modeloHelp:
      'Cria o repositório do seu perfil já com tudo pronto. Na tela do GitHub, confira se está Public e clique em Create repository.',
    modeloButton: 'Criar meu perfil com o card',
    gerarTitle: 'Gerar o card agora',
    gerarHelp:
      'Abre a automação no seu perfil. Clique em Run workflow e, de novo, no botão verde Run workflow. Em menos de um minuto o card aparece.',
    gerarManualHelp:
      'O card aparece sozinho depois do commit da automação. Se não aparecer em alguns minutos, gere na mão: Run workflow e, de novo, o botão verde Run workflow.',
    gerarButton: 'Gerar o card agora',
    repoTitle: 'Repositório do perfil',
    repoHelp:
      'O card mora no repositório com o mesmo nome do seu usuário. Só precisa criar se ainda não existir: deixe público e clique em Create repository.',
    repoButton: 'Criar meu repositório de perfil',
    repoDone: 'Você já tem o repositório do perfil. Pode pular este passo.',
    workflowTitle: 'A automação',
    workflowHelp:
      'Abre o arquivo já escrito. Clique em Commit changes: o card é gerado na hora e, depois, todo dia.',
    workflowButton: 'Instalar a automação',
    readmeTitle: 'Mostrar no perfil',
    readmeHelp:
      'Cole esta linha no seu README, onde quiser que o card apareça, e clique em Commit changes.',
    readmeNew:
      'Você ainda não tem README: o botão cria um já com o card. É só clicar em Commit changes.',
    readmeButton: 'Abrir o README',
    copy: 'Copiar',
    copied: 'Copiado!',
    copyFailed: 'Não deu pra copiar: selecione o texto e copie.',
    seeWorkflow: 'Ver o arquivo da automação',
    previewTitle: 'Prévia',
    previewYours: 'O seu card, como está agora no seu perfil.',
    previewExample:
      'Exemplo de card. O seu aparece no perfil uns segundos depois do commit da automação.',
    source: 'Código e regras do card',
    noServer: 'Sem servidor e sem cadastro: tudo roda no seu próprio GitHub.',
    invalid: 'Esse não parece um usuário do GitHub: só letras, números e hífens, até 39.',
    notFound: 'Não achei esse usuário no GitHub. Confira se está escrito certo.',
    rateLimited:
      'O GitHub limitou as consultas deste navegador por agora. Os botões funcionam do mesmo jeito.',
    offline: 'Não deu pra falar com o GitHub agora. Os botões funcionam do mesmo jeito.',
  },
  en: {
    title: 'Install Codorna Card',
    subtitle: 'Your GitHub becomes a pixel art RPG card, in 3 clicks.',
    step1: '1. Who are you on GitHub?',
    loginLabel: 'Your GitHub username',
    go: 'Continue',
    options: 'Card options',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeBoth: 'Both (follows the visitor’s theme)',
    cardLang: 'Card language',
    private: 'Count my private contributions',
    privateHelp:
      'Only the total counts, no repository names. Also turn it on in your profile: above the contribution graph, Contribution settings → Private contributions.',
    step2: '2. Install in 3 clicks',
    step2Template: '2. Install in 2 clicks',
    modeloTitle: 'Create your profile with the card',
    modeloHelp:
      'Creates your profile repository with everything ready. On GitHub, check it is Public and click Create repository.',
    modeloButton: 'Create my profile with the card',
    gerarTitle: 'Generate the card now',
    gerarHelp:
      'Opens the automation on your profile. Click Run workflow, then the green Run workflow button. The card shows up in under a minute.',
    gerarManualHelp:
      'The card shows up by itself after the automation commit. If it does not after a few minutes, run it by hand: Run workflow, then the green Run workflow button.',
    gerarButton: 'Generate the card now',
    repoTitle: 'Profile repository',
    repoHelp:
      'The card lives in the repository named after your username. Create it only if it does not exist yet: keep it public and click Create repository.',
    repoButton: 'Create my profile repository',
    repoDone: 'You already have the profile repository. You can skip this step.',
    workflowTitle: 'The automation',
    workflowHelp:
      'Opens the file already written. Click Commit changes: the card is generated right away and then every day.',
    workflowButton: 'Install the automation',
    readmeTitle: 'Show it on your profile',
    readmeHelp:
      'Paste this line in your README, wherever you want the card, and click Commit changes.',
    readmeNew:
      'You have no README yet: the button creates one with the card. Just click Commit changes.',
    readmeButton: 'Open the README',
    copy: 'Copy',
    copied: 'Copied!',
    copyFailed: 'Could not copy: select the text and copy it.',
    seeWorkflow: 'See the automation file',
    previewTitle: 'Preview',
    previewYours: 'Your card, as it is on your profile right now.',
    previewExample: 'Example card. Yours shows up on your profile a few seconds after the commit.',
    source: 'Card source and rules',
    noServer: 'No server and no sign-up: everything runs on your own GitHub.',
    invalid: 'That does not look like a GitHub username: letters, numbers and hyphens, up to 39.',
    notFound: 'GitHub has no such user. Check the spelling.',
    rateLimited: 'GitHub rate-limited this browser for now. The buttons still work.',
    offline: 'Could not reach GitHub right now. The buttons still work.',
  },
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

let pageLang: PageLang = navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
let login: string | null = null
let repo: RepoInfo = UNKNOWN_REPO
let avisoApi = ''
let previaPropria = false

const t = (key: string) => TEXTOS[pageLang][key] ?? key

function options(): InstallOptions {
  return {
    theme: $<HTMLSelectElement>('tema').value as InstallTheme,
    lang: $<HTMLSelectElement>('lingua').value === 'en' ? 'en' : 'pt-BR',
    privateContributions: $<HTMLInputElement>('privadas').checked,
  }
}

function aplicarIdioma(): void {
  document.documentElement.lang = pageLang
  document.title = t('title')
  for (const el of document.querySelectorAll<HTMLElement>('[data-t]')) {
    el.textContent = t(el.dataset.t ?? '')
  }
  for (const botao of document.querySelectorAll<HTMLButtonElement>('[data-page-lang]')) {
    botao.setAttribute('aria-pressed', String(botao.dataset.pageLang === pageLang))
  }
  atualizar()
}

/** Redesenha os links, o trecho do README e os textos que dependem do repositório. */
function atualizar(): void {
  if (!login) return
  const opcoes = options()
  const links = installLinks(login, opcoes, repo)
  $<HTMLAnchorElement>('link-repo').href = links.createRepo
  $<HTMLAnchorElement>('link-workflow').href = links.installWorkflow
  $<HTMLAnchorElement>('link-readme').href = links.readme
  // Sem o repositório do perfil, o caminho do modelo: 2 cliques e nada pra colar.
  const semRepo = repo.exists === false
  $('caminho-modelo').hidden = !semRepo
  $('caminho-manual').hidden = semRepo
  $<HTMLAnchorElement>('link-modelo').href = templateRepoLink(login, opcoes.lang)
  for (const id of ['link-gerar', 'link-gerar-modelo']) {
    $<HTMLAnchorElement>(id).href = runWorkflowLink(login)
  }
  $('passo-instalar').textContent = semRepo ? t('step2Template') : t('step2')
  $('trecho').textContent = readmeSnippet(opcoes.theme)
  $('workflow').textContent = workflowYaml(opcoes)
  $('aviso-api').textContent = avisoApi ? t(avisoApi) : ''
  $('aviso-api').hidden = !avisoApi

  const jaTemRepo = repo.exists === true
  $('passo-repo').classList.toggle('feito', jaTemRepo)
  $('repo-dica').textContent = jaTemRepo ? t('repoDone') : t('repoHelp')
  $('readme-dica').textContent = repo.hasReadme === false ? t('readmeNew') : t('readmeHelp')
  $('previa-legenda').textContent = previaPropria ? t('previewYours') : t('previewExample')
  const img = $<HTMLImageElement>('previa-img')
  img.alt = previaPropria ? `Codorna Card @${login}` : t('previewExample')
  if (!previaPropria) img.src = opcoes.theme === 'light' ? exemploClaro : exemploEscuro
}

/** Uma consulta à API pública, sem token. 404 vira false; limite ou rede viram um aviso. */
async function existe(caminho: string): Promise<{ ok: boolean; json?: unknown }> {
  const resposta = await fetch(`https://api.github.com/${caminho}`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (resposta.status === 404) return { ok: false }
  if (resposta.status === 403 || resposta.status === 429) throw new Error('rateLimited')
  if (!resposta.ok) throw new Error('offline')
  return { ok: true, json: await resposta.json() }
}

/** O card já publicado no perfil, lido como texto e mostrado como imagem. */
async function cardPublicado(nome: string, tema: InstallTheme): Promise<string | null> {
  try {
    const resposta = await fetch(publishedCardUrl(nome, tema))
    if (!resposta.ok) return null
    const svg = await resposta.text()
    if (!svg.includes('<svg')) return null
    // O raw do GitHub serve o SVG como texto; vira imagem pelo tipo certo, num Blob.
    return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  } catch {
    return null
  }
}

async function continuar(evento: Event): Promise<void> {
  evento.preventDefault()
  const erro = $('login-erro')
  const valor = cleanLogin($<HTMLInputElement>('login').value)
  if (!valor) {
    erro.textContent = t('invalid')
    erro.hidden = false
    $<HTMLInputElement>('login').setAttribute('aria-invalid', 'true')
    $<HTMLInputElement>('login').focus()
    return
  }
  erro.hidden = true
  $<HTMLInputElement>('login').removeAttribute('aria-invalid')
  login = valor
  repo = UNKNOWN_REPO
  avisoApi = ''
  previaPropria = false

  try {
    const usuario = await existe(`users/${encodeURIComponent(valor)}`)
    if (!usuario.ok) {
      erro.textContent = t('notFound')
      erro.hidden = false
      return
    }
    const perfil = await existe(`repos/${encodeURIComponent(valor)}/${encodeURIComponent(valor)}`)
    if (perfil.ok) {
      const dados = perfil.json as { default_branch?: string }
      const readme = await existe(
        `repos/${encodeURIComponent(valor)}/${encodeURIComponent(valor)}/readme`,
      )
      repo = { exists: true, defaultBranch: dados.default_branch ?? null, hasReadme: readme.ok }
    } else {
      repo = { exists: false, defaultBranch: null, hasReadme: false }
    }
  } catch (falha) {
    // Sem a API, os links funcionam igual: só não sabemos se o repositório já existe.
    avisoApi = falha instanceof Error && falha.message === 'rateLimited' ? 'rateLimited' : 'offline'
  }

  const tema = options().theme
  const proprio = repo.exists === false ? null : await cardPublicado(valor, tema)
  previaPropria = proprio !== null
  if (proprio) $<HTMLImageElement>('previa-img').src = proprio

  $('resultado').hidden = false
  $('previa').hidden = false
  atualizar()
  $('passo-instalar').focus()
}

async function copiar(): Promise<void> {
  const aviso = $('copiado')
  try {
    await navigator.clipboard.writeText($('trecho').textContent ?? '')
    aviso.textContent = t('copied')
  } catch {
    aviso.textContent = t('copyFailed')
  }
}

$('form').addEventListener('submit', (evento) => void continuar(evento))
for (const id of ['tema', 'lingua', 'privadas']) $(id).addEventListener('change', atualizar)
$('copiar').addEventListener('click', () => void copiar())
for (const botao of document.querySelectorAll<HTMLButtonElement>('[data-page-lang]')) {
  botao.addEventListener('click', () => {
    pageLang = botao.dataset.pageLang === 'en' ? 'en' : 'pt-BR'
    aplicarIdioma()
  })
}
$('passo-instalar').tabIndex = -1
aplicarIdioma()
