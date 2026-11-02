import { guildNumber, loginHash } from '../hash'
import type { PlayerData } from '../types'
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

/** Ficha completa do personagem, pronta para desenhar. */
export interface Character {
  login: string
  /** Ano de criação da conta. */
  memberSince: number
  /** Número da carteirinha (derivado do hash do username). */
  guildNumber: string
  hash: Uint8Array
  activity: CountedActivity
  xp: XpBreakdown
  level: LevelProgress
  rank: RankId
  classId: ClassId
  /** Linguagem mais votada da classe (null para Aventureiro). */
  classLanguage: string | null
  languages: LanguageShare[]
  attributes: Attributes
}

export function buildCharacter(data: PlayerData): Character {
  const activity = countActivity(data)
  const xp = computeXp(activity)
  const level = levelProgress(xp.total)
  const languages = languageShares(data.repositories)
  const dominant = dominantClass(languages)
  const hash = loginHash(data.login)
  const created = new Date(data.createdAt)
  return {
    login: data.login,
    memberSince: Number.isNaN(created.getTime())
      ? new Date().getUTCFullYear()
      : created.getUTCFullYear(),
    guildNumber: guildNumber(hash),
    hash,
    activity,
    xp,
    level,
    rank: rankForLevel(level.level),
    classId: dominant.classId,
    classLanguage: dominant.language,
    languages,
    attributes: computeAttributes(activity, data.repositories),
  }
}
