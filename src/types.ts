/** Idiomas suportados no card, nos logs e na mensagem de commit. */
export type Lang = 'pt-BR' | 'en'

/** Temas de cor do card. */
export type ThemeName = 'dark' | 'light'

// Os dados de entrada das regras moram em `src/game/types.ts` (o módulo do jogo não importa
// nada de fora da própria pasta). Ficam reexportados aqui para o resto do projeto.
export type {
  AnonymousRepo,
  PlayerData,
  PrivateActivity,
  PrivateYearActivity,
  RepoLanguage,
  RepoLanguages,
  YearActivity,
} from './game/types'
