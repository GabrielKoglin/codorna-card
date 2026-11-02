/**
 * Dados de entrada das regras do jogo. É o que a coleta pela API produz, o formato dos arquivos
 * em `fixtures/` e o que um jogo precisa montar para calcular uma ficha com `buildSheet`.
 *
 * Só números e nomes de linguagem. Os únicos nomes de repositório são os dos repositórios
 * públicos (`PlayerData.repositories`); nada que vem de repositório privado tem nome.
 */

/** Linguagem de um repositório, com o tamanho em bytes informado pelo GitHub. */
export interface RepoLanguage {
  name: string
  /** Cor da linguagem informada pela API do GitHub (pode faltar). */
  color: string | null
  size: number
}

/** As linguagens de um repositório, sem o nome. É tudo o que as regras usam de um repositório. */
export interface AnonymousRepo {
  languages: RepoLanguage[]
}

/** Repositório próprio, público e que não é fork. */
export interface RepoLanguages extends AnonymousRepo {
  name: string
}

/**
 * Atividade de um ano em repositórios privados, contada direto nos repositórios que o
 * `private-token` enxerga (modo completo). Só números, nenhum nome.
 */
export interface PrivateYearActivity {
  /**
   * Commits por dia (AAAA-MM-DD, UTC, pela data de autoria) na branch padrão de repositórios
   * privados que não são fork, de autoria da pessoa.
   */
  commitsByDay: Record<string, number>
  /** Issues abertas em repositórios privados. */
  issues: number
  /** Pull requests abertos em repositórios privados. */
  pullRequests: number
  /** PRs de outras pessoas em repositórios privados que a pessoa revisou (um por PR). */
  reviews: number
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
   * Contribuições privadas anônimas do ano (`restrictedContributionsCount`): o total que o GitHub
   * mostra no perfil para quem não enxerga os repositórios. Só existe com
   * `private-contributions: true`; no modo completo, é só o que nem o `private-token` enxerga.
   * É só um número: nada de repositório privado.
   */
  privateContributions?: number
  /** Modo completo (`private-token`): a atividade do ano em repositórios privados. */
  private?: PrivateYearActivity
}

/** Totais do modo completo que não são por ano. Só números e nomes de linguagem. */
export interface PrivateActivity {
  /** PRs mesclados em repositórios privados (a vida toda). */
  mergedPullRequests: number
  /** Desses, os mesclados em repositórios que não são da pessoa (de outra pessoa ou organização). */
  mergedPullRequestsElsewhere: number
  /** Linguagens de cada repositório privado próprio que não é fork, sem o nome. */
  repositories: AnonymousRepo[]
  /** Repositórios privados lidos (sem forks). Só a quantidade. */
  scannedRepositories: number
  /** Repositórios privados pulados por SSO ou falta de acesso. Só a quantidade. */
  skippedRepositories: number
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
  /** Modo completo (`private-token`): totais dos repositórios privados. Ausente sem ele. */
  private?: PrivateActivity
}
