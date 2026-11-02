import { createHash } from 'node:crypto'

/** SHA-256 do username em minúsculas: a semente fixa de tudo que é "aleatório" no card. */
export function loginHash(login: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(login.trim().toLowerCase()).digest())
}

/** Gerador pseudoaleatório determinístico (mulberry32) a partir do hash. */
export function seededRandom(seed: Uint8Array, salt = 0): () => number {
  let state =
    (((seed[0] ?? 0) << 24) | ((seed[1] ?? 0) << 16) | ((seed[2] ?? 0) << 8) | (seed[3] ?? 0)) ^
    Math.imul(salt + 1, 0x9e3779b9)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Número da carteirinha da guilda, ex.: "4F2A-91C3". */
export function guildNumber(hash: Uint8Array): string {
  const hex = [...hash.slice(-4)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 4)}-${hex.slice(4)}`.toUpperCase()
}
