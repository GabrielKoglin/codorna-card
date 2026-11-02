import type { AttributeId } from './game/attributes'
import type { ClassId } from './game/classes'
import type { RankId } from './game/rules'
import type { Lang } from './types'

/** Separa milhares do jeito de cada idioma (12.345 / 12,345), sem depender do ICU. */
export function formatNumber(value: number, lang: Lang): string {
  const separator = lang === 'pt-BR' ? '.' : ','
  const digits = String(Math.max(0, Math.round(value)))
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}

function formatPercent(share: number): string {
  const percent = share * 100
  if (percent > 0 && percent < 1) return '<1%'
  return `${Math.round(percent)}%`
}

function utcTime(date: Date): string {
  return date.toISOString().slice(11, 16)
}

export interface Strings {
  card: {
    header: string
    level: string
    xp: string
    since: (year: number) => string
    noLanguages: string
    percent: (share: number) => string
    toNext: (xp: string) => string
    maxLevel: string
    stats: Record<
      'commits' | 'merged' | 'mergedShort' | 'reviews' | 'issues',
      (count: number) => string
    >
  }
  attributes: Record<AttributeId, { short: string; name: string }>
  classes: Record<ClassId, string>
  ranks: Record<RankId, string>
  a11y: {
    title: (login: string) => string
    desc: (info: {
      level: number
      rank: string
      className: string
      xp: string
      attributes: string
      languages: string
      stats: string
    }) => string
  }
  commitMessage: string
  log: {
    fetching: (login: string) => string
    years: (count: number, from: number, to: number) => string
    quarters: (year: number) => string
    repositories: (count: number) => string
    repositoriesTruncated: (limit: number) => string
    tooManyRepositories: (period: string) => string
    rateLimitLow: (remaining: number, resetAt: Date) => string
    retrying: (attempt: number, seconds: number) => string
    result: (level: number, className: string, xp: string) => string
    wrote: (path: string) => string
    committed: (sha: string, branch: string) => string
    unchanged: string
    commitDisabled: string
    notOnBranch: (ref: string) => string
    noRepository: string
  }
  errors: {
    missingToken: string
    invalidUsername: (value: string) => string
    invalidTheme: (value: string) => string
    invalidLang: (value: string) => string
    invalidOutput: (value: string) => string
    invalidBoolean: (name: string, value: string) => string
    userNotFound: (login: string) => string
    isOrganization: (login: string) => string
    badCredentials: string
    forbidden: (detail: string) => string
    rateLimited: (resetAt: Date | null) => string
    secondaryRateLimit: string
    timeout: string
    network: (detail: string) => string
    api: (status: number, detail: string) => string
    graphql: (detail: string) => string
    noWritePermission: string
    emptyRepository: string
    branchNotFound: (branch: string) => string
    protectedBranch: (branch: string) => string
    unexpected: (detail: string) => string
  }
  summary: {
    title: (login: string) => string
    level: string
    className: string
    rank: string
    xp: string
    source: string
    counted: string
    rawLabel: string
    rows: {
      commits: string
      issues: string
      pullRequests: string
      reviews: string
      merged: string
      mergedElsewhere: string
    }
    files: string
    rules: string
  }
}

const PT_BR: Strings = {
  card: {
    header: 'CODORNA CARD',
    level: 'NÍVEL',
    xp: 'XP',
    since: (year) => `desde ${year}`,
    noLanguages: 'nenhuma linguagem pública ainda',
    percent: formatPercent,
    toNext: (xp) => `faltam ${xp} XP`,
    maxLevel: 'nível máximo!',
    stats: {
      commits: (n) => (n === 1 ? 'commit' : 'commits'),
      merged: (n) => (n === 1 ? 'PR mesclado' : 'PRs mesclados'),
      mergedShort: (n) => (n === 1 ? 'PR' : 'PRs'),
      reviews: (n) => (n === 1 ? 'review' : 'reviews'),
      issues: (n) => (n === 1 ? 'issue' : 'issues'),
    },
  },
  attributes: {
    str: { short: 'FOR', name: 'Força' },
    dex: { short: 'DES', name: 'Destreza' },
    con: { short: 'CON', name: 'Constituição' },
    int: { short: 'INT', name: 'Inteligência' },
    wis: { short: 'SAB', name: 'Sabedoria' },
    cha: { short: 'CAR', name: 'Carisma' },
  },
  classes: {
    blacksmith: 'Ferreiro',
    illusionist: 'Ilusionista',
    alchemist: 'Alquimista',
    arcanist: 'Arcanista',
    guardian: 'Guardião',
    tinkerer: 'Inventor',
    druid: 'Druida',
    ranger: 'Patrulheiro',
    merchant: 'Mercador',
    bard: 'Bardo',
    seer: 'Vidente',
    adventurer: 'Aventureiro',
  },
  ranks: {
    recruit: 'Recruta',
    apprentice: 'Aprendiz',
    veteran: 'Veterano',
    master: 'Mestre',
    legend: 'Lenda',
    mythic: 'Mítico',
  },
  a11y: {
    title: (login) => `Codorna Card de @${login}`,
    desc: (info) =>
      `Nível ${info.level} (${info.rank}), classe ${info.className}, ${info.xp} XP. ` +
      `Atributos: ${info.attributes}. Linguagens: ${info.languages}. ${info.stats}.`,
  },
  commitMessage: 'Atualiza o Codorna Card',
  log: {
    fetching: (login) => `Buscando a atividade pública de @${login}…`,
    years: (count, from, to) =>
      `Lendo ${count} ${count === 1 ? 'ano' : 'anos'} de contribuições (${from}–${to})…`,
    quarters: (year) =>
      `${year}: muitos dias de commit num mesmo repositório, lendo por trimestre.`,
    repositories: (count) => `${count} repositório(s) próprio(s) e público(s) analisado(s).`,
    repositoriesTruncated: (limit) =>
      `Mais de ${limit} repositórios: só os ${limit} com push mais recente entram na classe.`,
    tooManyRepositories: (period) =>
      `${period}: mais de 100 repositórios com atividade; os menos ativos ficaram de fora.`,
    rateLimitLow: (remaining, resetAt) =>
      `Atenção: restam ${remaining} pontos de API até ${utcTime(resetAt)} UTC.`,
    retrying: (attempt, seconds) => `Tentando de novo (tentativa ${attempt}) em ${seconds}s…`,
    result: (level, className, xp) => `Nível ${level} · ${className} · ${xp} XP`,
    wrote: (path) => `Card salvo em ${path}`,
    committed: (sha, branch) => `Commit ${sha.slice(0, 7)} enviado para ${branch}.`,
    unchanged: 'O card não mudou; nada para comitar.',
    commitDisabled: 'commit: false, então o card não foi comitado.',
    notOnBranch: (ref) =>
      `O workflow não está rodando numa branch (${ref || 'ref vazia'}); o card foi gerado mas não foi comitado.`,
    noRepository: 'GITHUB_REPOSITORY está vazio; o card foi gerado mas não foi comitado.',
  },
  errors: {
    missingToken:
      'Nenhum token foi informado. Use a entrada `token` (o padrão é o GITHUB_TOKEN do workflow).',
    invalidUsername: (value) =>
      `Username inválido: "${value}". Use o login do GitHub (letras, números e hífens).`,
    invalidTheme: (value) => `Tema inválido: "${value}". Use dark, light ou both.`,
    invalidLang: (value) => `Idioma inválido: "${value}". Use pt-BR ou en.`,
    invalidOutput: (value) =>
      `Saída inválida: "${value}". Use um caminho relativo dentro do repositório, terminado em .svg.`,
    invalidBoolean: (name, value) => `Valor inválido em ${name}: "${value}". Use true ou false.`,
    userNotFound: (login) => `Usuário "${login}" não encontrado no GitHub.`,
    isOrganization: (login) =>
      `"${login}" é uma organização. O Codorna Card é de pessoas: informe o seu login em \`username\`.`,
    badCredentials: 'O GitHub recusou o token (401). Confira se ele existe e se não expirou.',
    forbidden: (detail) => `O GitHub negou o acesso (403): ${detail}`,
    rateLimited: (resetAt) =>
      resetAt
        ? `Limite de requisições da API do GitHub esgotado. Ele renova às ${utcTime(resetAt)} UTC; rode de novo depois disso.`
        : 'Limite de requisições da API do GitHub esgotado. Rode de novo daqui a uma hora.',
    secondaryRateLimit:
      'O GitHub pediu para diminuir o ritmo (limite secundário). Rode de novo em alguns minutos.',
    timeout: 'A API do GitHub demorou demais para responder, mesmo depois de novas tentativas.',
    network: (detail) => `Falha de rede ao falar com a API do GitHub: ${detail}`,
    api: (status, detail) => `A API do GitHub respondeu com erro ${status}: ${detail}`,
    graphql: (detail) => `A API GraphQL do GitHub respondeu com erro: ${detail}`,
    noWritePermission:
      'Sem permissão para comitar. Adicione `permissions: contents: write` ao workflow (ou use `commit: false`).',
    emptyRepository:
      'O repositório está vazio. Faça um primeiro commit (um README já serve) e rode de novo.',
    branchNotFound: (branch) => `Branch "${branch}" não encontrada no repositório.`,
    protectedBranch: (branch) =>
      `A branch "${branch}" está protegida e recusou o commit. Libere o github-actions[bot] nas regras da branch ou use \`commit: false\`.`,
    unexpected: (detail) => `Erro inesperado: ${detail}`,
  },
  summary: {
    title: (login) => `Codorna Card de @${login}`,
    level: 'Nível',
    className: 'Classe',
    rank: 'Patente',
    xp: 'XP',
    source: 'Fonte',
    counted: 'Conta para XP',
    rawLabel: 'Total público',
    rows: {
      commits: 'Commits (até 10 por dia)',
      issues: 'Issues (até 150 por ano)',
      pullRequests: 'PRs abertos (até 250 por ano)',
      reviews: 'Reviews de PR (até 250 por ano)',
      merged: 'PRs mesclados',
      mergedElsewhere: 'Bônus: mesclados em repositórios de outras pessoas',
    },
    files: 'Arquivos',
    rules: 'Regras completas',
  },
}

const EN: Strings = {
  card: {
    header: 'CODORNA CARD',
    level: 'LEVEL',
    xp: 'XP',
    since: (year) => `since ${year}`,
    noLanguages: 'no public languages yet',
    percent: formatPercent,
    toNext: (xp) => `${xp} XP to go`,
    maxLevel: 'max level!',
    stats: {
      commits: (n) => (n === 1 ? 'commit' : 'commits'),
      merged: (n) => (n === 1 ? 'merged PR' : 'merged PRs'),
      mergedShort: (n) => (n === 1 ? 'PR' : 'PRs'),
      reviews: (n) => (n === 1 ? 'review' : 'reviews'),
      issues: (n) => (n === 1 ? 'issue' : 'issues'),
    },
  },
  attributes: {
    str: { short: 'STR', name: 'Strength' },
    dex: { short: 'DEX', name: 'Dexterity' },
    con: { short: 'CON', name: 'Constitution' },
    int: { short: 'INT', name: 'Intelligence' },
    wis: { short: 'WIS', name: 'Wisdom' },
    cha: { short: 'CHA', name: 'Charisma' },
  },
  classes: {
    blacksmith: 'Blacksmith',
    illusionist: 'Illusionist',
    alchemist: 'Alchemist',
    arcanist: 'Arcanist',
    guardian: 'Guardian',
    tinkerer: 'Tinkerer',
    druid: 'Druid',
    ranger: 'Ranger',
    merchant: 'Merchant',
    bard: 'Bard',
    seer: 'Seer',
    adventurer: 'Adventurer',
  },
  ranks: {
    recruit: 'Recruit',
    apprentice: 'Apprentice',
    veteran: 'Veteran',
    master: 'Master',
    legend: 'Legend',
    mythic: 'Mythic',
  },
  a11y: {
    title: (login) => `Codorna Card of @${login}`,
    desc: (info) =>
      `Level ${info.level} (${info.rank}), ${info.className} class, ${info.xp} XP. ` +
      `Attributes: ${info.attributes}. Languages: ${info.languages}. ${info.stats}.`,
  },
  commitMessage: 'Update Codorna Card',
  log: {
    fetching: (login) => `Fetching public activity for @${login}…`,
    years: (count, from, to) =>
      `Reading ${count} ${count === 1 ? 'year' : 'years'} of contributions (${from}–${to})…`,
    quarters: (year) => `${year}: many commit days in a single repository, reading by quarter.`,
    repositories: (count) => `${count} owned public repositories analyzed.`,
    repositoriesTruncated: (limit) =>
      `More than ${limit} repositories: only the ${limit} most recently pushed count for the class.`,
    tooManyRepositories: (period) =>
      `${period}: more than 100 repositories with activity; the least active were left out.`,
    rateLimitLow: (remaining, resetAt) =>
      `Heads up: ${remaining} API points left until ${utcTime(resetAt)} UTC.`,
    retrying: (attempt, seconds) => `Retrying (attempt ${attempt}) in ${seconds}s…`,
    result: (level, className, xp) => `Level ${level} · ${className} · ${xp} XP`,
    wrote: (path) => `Card saved to ${path}`,
    committed: (sha, branch) => `Commit ${sha.slice(0, 7)} pushed to ${branch}.`,
    unchanged: 'The card did not change; nothing to commit.',
    commitDisabled: 'commit: false, so the card was not committed.',
    notOnBranch: (ref) =>
      `The workflow is not running on a branch (${ref || 'empty ref'}); the card was generated but not committed.`,
    noRepository: 'GITHUB_REPOSITORY is empty; the card was generated but not committed.',
  },
  errors: {
    missingToken:
      'No token provided. Set the `token` input (it defaults to the workflow GITHUB_TOKEN).',
    invalidUsername: (value) =>
      `Invalid username: "${value}". Use a GitHub login (letters, numbers and hyphens).`,
    invalidTheme: (value) => `Invalid theme: "${value}". Use dark, light or both.`,
    invalidLang: (value) => `Invalid language: "${value}". Use pt-BR or en.`,
    invalidOutput: (value) =>
      `Invalid output: "${value}". Use a relative path inside the repository ending in .svg.`,
    invalidBoolean: (name, value) => `Invalid value for ${name}: "${value}". Use true or false.`,
    userNotFound: (login) => `User "${login}" was not found on GitHub.`,
    isOrganization: (login) =>
      `"${login}" is an organization. Codorna Cards are for people: set your login in \`username\`.`,
    badCredentials: 'GitHub rejected the token (401). Check that it exists and has not expired.',
    forbidden: (detail) => `GitHub denied access (403): ${detail}`,
    rateLimited: (resetAt) =>
      resetAt
        ? `GitHub API rate limit exhausted. It resets at ${utcTime(resetAt)} UTC; run again after that.`
        : 'GitHub API rate limit exhausted. Run again in an hour.',
    secondaryRateLimit:
      'GitHub asked us to slow down (secondary rate limit). Run again in a few minutes.',
    timeout: 'The GitHub API took too long to answer, even after retrying.',
    network: (detail) => `Network error while talking to the GitHub API: ${detail}`,
    api: (status, detail) => `The GitHub API answered with error ${status}: ${detail}`,
    graphql: (detail) => `The GitHub GraphQL API answered with an error: ${detail}`,
    noWritePermission:
      'No permission to commit. Add `permissions: contents: write` to the workflow (or use `commit: false`).',
    emptyRepository:
      'The repository is empty. Make a first commit (a README is enough) and run again.',
    branchNotFound: (branch) => `Branch "${branch}" was not found in the repository.`,
    protectedBranch: (branch) =>
      `Branch "${branch}" is protected and rejected the commit. Allow github-actions[bot] in the branch rules or use \`commit: false\`.`,
    unexpected: (detail) => `Unexpected error: ${detail}`,
  },
  summary: {
    title: (login) => `Codorna Card of @${login}`,
    level: 'Level',
    className: 'Class',
    rank: 'Rank',
    xp: 'XP',
    source: 'Source',
    counted: 'Counts for XP',
    rawLabel: 'Public total',
    rows: {
      commits: 'Commits (up to 10 per day)',
      issues: 'Issues (up to 150 per year)',
      pullRequests: 'Opened PRs (up to 250 per year)',
      reviews: 'PR reviews (up to 250 per year)',
      merged: 'Merged PRs',
      mergedElsewhere: "Bonus: merged in other people's repositories",
    },
    files: 'Files',
    rules: 'Full rules',
  },
}

export function strings(lang: Lang): Strings {
  return lang === 'pt-BR' ? PT_BR : EN
}
