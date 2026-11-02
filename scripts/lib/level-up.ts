/**
 * Quadros da animação do README: o mesmo personagem subindo de nível, do começo de um card
 * iniciante até o card veterano. Só os números mudam (XP, nível, patente, atributos e
 * contagens); classe, avatar e linguagens são os do card final.
 */
import { ATTRIBUTES, type Attributes } from '../../src/game/attributes'
import type { Character } from '../../src/character'
import { levelProgress, RANKS, rankForLevel, xpForLevel } from '../../src/game/rules'

export interface LevelUpFrame {
  character: Character
  /** Duração em centésimos de segundo. */
  delay: number
  /** Quadro em que a moldura acende, logo depois de trocar de patente. */
  flash: boolean
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOut = (t: number) => 1 - (1 - t) ** 3

/** Nível com a fração já andada dentro dele (ex.: 3,7). */
function fractionalLevel(xp: number): number {
  const progress = levelProgress(xp)
  return progress.level + progress.progress
}

function xpAtLevel(level: number): number {
  const whole = Math.floor(level)
  const start = xpForLevel(whole)
  return Math.round(start + (level - whole) * (xpForLevel(whole + 1) - start))
}

/** Personagem num ponto do caminho entre `from` e `to`. */
function characterAt(from: Character, to: Character, xp: number): Character {
  const levelT =
    (fractionalLevel(xp) - fractionalLevel(from.xp.total)) /
    (fractionalLevel(to.xp.total) - fractionalLevel(from.xp.total))
  const xpT = (xp - from.xp.total) / (to.xp.total - from.xp.total)
  const count = (a: number, b: number) => Math.round(lerp(a, b, xpT))
  const attributes = {} as Attributes
  for (const def of ATTRIBUTES) {
    attributes[def.id] = Math.round(lerp(from.attributes[def.id], to.attributes[def.id], levelT))
  }
  const level = levelProgress(xp)
  const a = from.activity
  const b = to.activity
  return {
    ...to,
    xp: { ...to.xp, total: xp },
    level,
    rank: rankForLevel(level.level),
    attributes,
    activity: {
      ...b,
      commits: { ...b.commits, raw: count(a.commits.raw, b.commits.raw) },
      merged: { ...b.merged, raw: count(a.merged.raw, b.merged.raw) },
      reviews: { ...b.reviews, raw: count(a.reviews.raw, b.reviews.raw) },
      issues: { ...b.issues, raw: count(a.issues.raw, b.issues.raw) },
      privateContributions: { raw: 0, counted: 0 },
    },
  }
}

export interface LevelUpTiming {
  /** Pausa no começo e no fim (cs). */
  start: number
  end: number
  /** Duração de cada quadro de subida e da pausa em cada patente nova (cs). */
  step: number
  rankHold: number
  flash: number
}

const DEFAULT_TIMING: LevelUpTiming = { start: 90, end: 260, step: 6, rankHold: 60, flash: 10 }

/**
 * Sobe de `from` até `to`, desacelerando antes de cada patente nova, acendendo a moldura
 * quando ela muda e parando um pouco em cada uma.
 */
export function levelUpFrames(
  from: Character,
  to: Character,
  timing: LevelUpTiming = DEFAULT_TIMING,
): LevelUpFrame[] {
  const startLevel = fractionalLevel(from.xp.total)
  const endLevel = fractionalLevel(to.xp.total)
  const stops = RANKS.map((rank) => rank.minLevel).filter(
    (level) => level > startLevel && level < endLevel,
  )
  const frames: LevelUpFrame[] = [
    { character: characterAt(from, to, from.xp.total), delay: timing.start, flash: false },
  ]
  let level = startLevel
  for (const stop of [...stops, endLevel]) {
    const last = stop === endLevel
    // Mais quadros para trechos mais longos, entre 5 e 12.
    const steps = Math.min(12, Math.max(5, Math.round((stop - level) * 1.2)))
    for (let i = 1; i <= steps; i++) {
      const target = lerp(level, stop, easeOut(i / steps))
      const xp = i === steps && last ? to.xp.total : xpAtLevel(target)
      const character = characterAt(from, to, xp)
      if (i === steps && !last) {
        frames.push({ character, delay: timing.flash, flash: true })
        frames.push({ character, delay: timing.rankHold, flash: false })
      } else {
        frames.push({ character, delay: i === steps ? timing.end : timing.step, flash: false })
      }
    }
    level = stop
  }
  return frames
}
