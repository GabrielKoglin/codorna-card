import { buildSheet, type CharacterSheet } from './game'
import { cardNumber, loginHash } from './hash'
import type { PlayerData } from './types'

/**
 * Ficha completa do personagem, pronta para desenhar: a ficha das regras (`src/game`) mais o que
 * é só do card (login, ano de criação da conta, hash do username e número da carteirinha).
 */
export interface Character extends CharacterSheet {
  login: string
  /** Ano de criação da conta. */
  memberSince: number
  /** Número da carteirinha (derivado do hash do username). */
  cardNumber: string
  /** SHA-256 do username em minúsculas: a semente do avatar e dos enfeites. */
  hash: Uint8Array
}

export function buildCharacter(data: PlayerData): Character {
  const hash = loginHash(data.login)
  const created = new Date(data.createdAt)
  return {
    ...buildSheet(data),
    login: data.login,
    memberSince: Number.isNaN(created.getTime())
      ? new Date().getUTCFullYear()
      : created.getUTCFullYear(),
    cardNumber: cardNumber(hash),
    hash,
  }
}
