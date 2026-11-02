/** Idiomas suportados no card, nos logs e na mensagem de commit. */
export type Lang = 'pt-BR' | 'en'

/** Temas de cor do card. */
export type ThemeName = 'dark' | 'light'

/** Linguagem de um repositório, com o tamanho em bytes informado pelo GitHub. */
export interface RepoLanguage {
  name: string
  /** Cor da linguagem informada pela API do GitHub (pode faltar). */
  color: string | null
  size: number
}

/** Repositório próprio, público e que não é fork. */
export interface RepoLanguages {
  name: string
  languages: RepoLanguage[]
}

/** Atividade pública de um ano do calendário (UTC). */
export interface YearActivity {
  year: number
  /** Commits públicos por dia (AAAA-MM-DD → quantidade), somando todos os repositórios. */
  commitsByDay: Record<string, number>
  /** Issues abertas em repositórios públicos. */
  issues: number
  /** Pull requests abertos em repositórios públicos. */
  pullRequests: number
  /** Reviews de pull request em repositórios públicos (um por PR revisado). */
  reviews: number
  /**
   * Contribuições privadas do ano, como o GitHub mostra no perfil (`restrictedContributionsCount`).
   * Só existe com `private-contributions: true`. É só um número: nada de repositório privado.
   */
  privateContributions?: number
}

/**
 * Tudo o que o Codorna Card sabe sobre uma pessoa. É o que a coleta pela API produz
 * e é o formato dos arquivos em `fixtures/`.
 */
export interface PlayerData {
  login: string
  /** Data de criação da conta (ISO 8601). */
  createdAt: string
  years: YearActivity[]
  /** PRs públicos mesclados (a vida toda). */
  mergedPullRequests: number
  /** PRs públicos mesclados em repositórios que não são da pessoa. */
  mergedPullRequestsElsewhere: number
  repositories: RepoLanguages[]
}
