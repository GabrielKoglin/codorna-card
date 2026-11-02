/**
 * Regras do Codorna Card: XP, nível, patente, classe e atributos.
 *
 * Este é o ponto de entrada das regras. O módulo é puro: não faz I/O, não lê relógio, ambiente
 * nem rede, não conhece a API do GitHub e só importa arquivos da própria pasta (um teste em
 * `tests/game-api.test.ts` confere isso). Foi pensado para virar, sem mudança, um pacote
 * compartilhado com o jogo Codorna.
 *
 * Como usar:
 *
 * ```ts
 * import { buildSheet, type PlayerData } from './game'
 *
 * const sheet = buildSheet(data) // data: PlayerData (da coleta, de uma fixture ou do jogo)
 * sheet.level.level // 1 a 99
 * sheet.rank // 'recruit' … 'mythic'
 * sheet.classId // 'blacksmith', 'illusionist', …
 * sheet.attributes.str // 1 a 99
 * sheet.xp.total
 * ```
 *
 * Para mostrar só uma parte (por exemplo, o XP de uma atividade nova no jogo), as peças estão
 * exportadas uma a uma: `countActivity` aplica os tetos, `computeXp` soma o XP, `levelProgress`
 * dá o nível, `rankForLevel` a patente, `languageShares` + `dominantClass` a classe,
 * `computeAttributes` os atributos e `privateTotal` o total de contribuições privadas.
 *
 * Atividade privada (modo completo do card) entra em `YearActivity.private` e
 * `PlayerData.private`, com as mesmas regras do público; os tetos valem para a soma dos dois.
 *
 * As regras estão descritas em `docs/regras.md` (pt-BR) e `docs/rules.md` (en). Mudança de regra
 * precisa atualizar os dois documentos e os testes.
 */

export type {
  AnonymousRepo,
  PlayerData,
  PrivateActivity,
  PrivateYearActivity,
  RepoLanguage,
  RepoLanguages,
  YearActivity,
} from './types'

export {
  computeXp,
  countActivity,
  LEVEL_FACTOR,
  levelForXp,
  levelProgress,
  MAX_LEVEL,
  privateTotal,
  RANKS,
  rankForLevel,
  summarizeCommits,
  XP_RULES,
  xpForLevel,
} from './rules'
export type {
  CappedCount,
  CommitSummary,
  Counted,
  CountedActivity,
  LevelProgress,
  RankId,
  XpBreakdown,
} from './rules'

export { classDef, classForLanguage, CLASSES, dominantClass, languageShares } from './classes'
export type { ClassDef, ClassId, ClassResult, LanguageShare } from './classes'

export {
  ATTRIBUTES,
  attributeSources,
  attributeValue,
  computeAttributes,
  mainLanguages,
  MIN_REPO_BYTES,
} from './attributes'
export type { AttributeDef, AttributeId, Attributes } from './attributes'

export { buildSheet, languageRepositories } from './sheet'
export type { CharacterSheet } from './sheet'
