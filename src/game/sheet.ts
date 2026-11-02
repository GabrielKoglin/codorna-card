import { computeAttributes, type Attributes } from './attributes'
import { dominantClass, languageShares, type ClassId, type LanguageShare } from './classes'
import {
  computeXp,
  countActivity,
  levelProgress,
  rankForLevel,
  type CountedActivity,
  type LevelProgress,
  type RankId,
  type XpBreakdown,
} from './rules'
import type { AnonymousRepo, PlayerData } from './types'

/**
 * Ficha do personagem: tudo o que as regras calculam a partir de um `PlayerData`. Não tem nada de
 * desenho (avatar, número da carteirinha), então serve igual para o card e para um jogo.
 */
export interface CharacterSheet {
  /** Atividade com os tetos contra farm já aplicados (total bruto e quanto conta para XP). */
  activity: CountedActivity
  /** XP de cada tipo de atividade e o total. */
  xp: XpBreakdown
  /** Nível, XP do nível atual e do próximo e o progresso entre eles. */
  level: LevelProgress
  /** Patente (muda a moldura do card). */
  rank: RankId
  /** Classe da linguagem dominante. */
  classId: ClassId
  /** Linguagem mais votada da classe (null para Aventureiro). */
  classLanguage: string | null
  /** Linguagens com a fatia de votos de cada uma, da maior para a menor. */
  languages: LanguageShare[]
  /** Os seis atributos, de 1 a 99. */
  attributes: Attributes
}

/** Repositórios que votam na classe e contam em INT. */
export function languageRepositories(data: PlayerData): AnonymousRepo[] {
  return [...data.repositories]
}

/** Calcula a ficha completa. Determinística: os mesmos dados sempre dão a mesma ficha. */
export function buildSheet(data: PlayerData): CharacterSheet {
  const activity = countActivity(data)
  const xp = computeXp(activity)
  const level = levelProgress(xp.total)
  const repositories = languageRepositories(data)
  const languages = languageShares(repositories)
  const dominant = dominantClass(languages)
  return {
    activity,
    xp,
    level,
    rank: rankForLevel(level.level),
    classId: dominant.classId,
    classLanguage: dominant.language,
    languages,
    attributes: computeAttributes(activity, repositories),
  }
}
