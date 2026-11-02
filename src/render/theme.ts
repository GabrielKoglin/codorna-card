import type { RankId } from '../game/rules'
import type { ThemeName } from '../types'

export interface Theme {
  name: ThemeName
  /** Contorno de tudo (moldura, barras, avatar). */
  outline: string
  background: string
  panel: string
  panelEdge: string
  text: string
  muted: string
  /** Trilho das barras vazias. */
  track: string
  /** Fundo do retrato (misturado com a cor da classe). */
  portrait: string
  /** Sombra no chão, embaixo do avatar. */
  floor: string
}

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    outline: '#07090d',
    background: '#151a24',
    panel: '#1d2431',
    panelEdge: '#2d3647',
    text: '#f3ecda',
    muted: '#a9b1c2',
    track: '#2a3242',
    portrait: '#202838',
    floor: '#0e1219',
  },
  light: {
    name: 'light',
    outline: '#3a2a1c',
    background: '#f7f0de',
    panel: '#eee3c6',
    panelEdge: '#d8c9a3',
    text: '#2a1f16',
    muted: '#65543e',
    track: '#e2d5b4',
    portrait: '#efe6cd',
    floor: '#d3c39b',
  },
}

/** Material da moldura em cada patente. */
export interface Metal {
  base: string
  light: string
  dark: string
  gem: string
}

export const RANK_METALS: Record<RankId, Metal> = {
  recruit: { base: '#8b5a3c', light: '#b47c55', dark: '#5c3923', gem: '#e0b98f' },
  apprentice: { base: '#b8733a', light: '#e29a5c', dark: '#7a4a22', gem: '#f6cb98' },
  veteran: { base: '#a9b3c2', light: '#e3e8ef', dark: '#6c7787', gem: '#f6f8fc' },
  master: { base: '#d9a521', light: '#f7d66b', dark: '#8e6a10', gem: '#fff1b8' },
  legend: { base: '#2fae86', light: '#83e3c1', dark: '#1a6c53', gem: '#d2fff1' },
  mythic: { base: '#9b6cf0', light: '#cdb0ff', dark: '#5d3fa6', gem: '#f1e8ff' },
}
