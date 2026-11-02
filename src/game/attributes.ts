import type { CountedActivity } from './rules'
import type { AnonymousRepo } from './types'

/** Os seis atributos: força, destreza, constituição, inteligência, sabedoria e carisma. */
export type AttributeId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

/** Como cada atributo é calculado e a cor da barra dele no card. */
export interface AttributeDef {
  id: AttributeId
  /** Quantidade que leva o atributo a 99. */
  reference: number
  /** Expoente da curva: 0,4 cresce rápido no começo e devagar no topo; 1 é linear. */
  curve: number
  /** Cor da barra no card. */
  color: string
}

/** Ordem de exibição no card (duas colunas, de cima para baixo). */
export const ATTRIBUTES: readonly AttributeDef[] = [
  { id: 'str', reference: 20_000, curve: 0.4, color: '#e4574c' },
  { id: 'int', reference: 12, curve: 1, color: '#4b8fe0' },
  { id: 'dex', reference: 2_000, curve: 0.4, color: '#4fb06a' },
  { id: 'wis', reference: 2_000, curve: 0.4, color: '#9d74e8' },
  { id: 'con', reference: 3_650, curve: 0.4, color: '#e98b2f' },
  { id: 'cha', reference: 2_000, curve: 0.4, color: '#e06a9f' },
]

/** Tamanho mínimo (bytes de código) para um repositório contar em INT. */
export const MIN_REPO_BYTES = 1024

/** Valor de cada atributo, de 1 a 99. */
export type Attributes = Record<AttributeId, number>

/** Converte uma quantidade em atributo de 1 a 99. */
export function attributeValue(amount: number, reference: number, curve = 0.4): number {
  if (!Number.isFinite(amount) || amount <= 0) return 1
  const value = Math.round(99 * Math.min(1, amount / reference) ** curve)
  return Math.min(99, Math.max(1, value))
}

/**
 * Linguagens principais diferentes: em cada repositório (com pelo menos 1 KB de código)
 * a linguagem com mais bytes é a principal, como o GitHub mostra na página do repositório.
 */
export function mainLanguages(repositories: readonly AnonymousRepo[]): string[] {
  const found = new Map<string, string>()
  for (const repo of repositories) {
    const languages = repo.languages.filter((lang) => Number.isFinite(lang.size) && lang.size > 0)
    const total = languages.reduce((sum, lang) => sum + lang.size, 0)
    if (total < MIN_REPO_BYTES) continue
    const main = languages.reduce((best, lang) => (lang.size > best.size ? lang : best))
    found.set(main.name.toLowerCase(), main.name)
  }
  return [...found.values()]
}

/** Quantidade bruta que alimenta cada atributo. */
export function attributeSources(
  activity: CountedActivity,
  repositories: readonly AnonymousRepo[],
): Record<AttributeId, number> {
  return {
    str: activity.commits.counted,
    dex: activity.merged.counted,
    con: activity.commits.activeDays,
    int: mainLanguages(repositories).length,
    wis: activity.reviews.counted,
    cha: activity.issues.counted + 2 * activity.mergedElsewhere.counted,
  }
}

/** Os seis atributos (1 a 99) a partir da atividade contada e das linguagens dos repositórios. */
export function computeAttributes(
  activity: CountedActivity,
  repositories: readonly AnonymousRepo[],
): Attributes {
  const sources = attributeSources(activity, repositories)
  const result = {} as Attributes
  for (const def of ATTRIBUTES) {
    result[def.id] = attributeValue(sources[def.id], def.reference, def.curve)
  }
  return result
}
