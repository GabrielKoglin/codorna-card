import { describe, expect, it } from 'vitest'
import { parseHex } from '../src/render/color'
import { bitmapSize, MASCOT, MASCOT_COLORS, MASCOT_ICON, mascotPalette } from '../src/render/mascot'

const DRAWINGS = { MASCOT_ICON, MASCOT }

describe('mascote', () => {
  for (const [name, rows] of Object.entries(DRAWINGS)) {
    it(`${name}: linhas do mesmo tamanho e só papéis conhecidos`, () => {
      const { width } = bitmapSize(rows)
      const palette = mascotPalette('#000000')
      for (const row of rows) {
        expect(row).toHaveLength(width)
        for (const role of row)
          if (role !== '.') expect(palette, `${name}: ${role}`).toHaveProperty(role)
      }
    })

    it(`${name}: contorno fechado (nenhuma cor encosta no fundo)`, () => {
      const at = (x: number, y: number) => rows[y]?.[x] ?? '.'
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const role = at(x, y)
          if (role === '.' || role === '#') continue
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            expect(at(x + dx, y + dy), `${name} (${x}, ${y})`).not.toBe('.')
          }
        }
      })
    })
  }

  it('o ícone cabe no cabeçalho do card em escala 2', () => {
    const { width, height } = bitmapSize(MASCOT_ICON)
    // Cabeçalho: 34 px de altura; o ícone fica com 2 px de folga em cima e embaixo.
    expect(height * 2).toBeLessThanOrEqual(30)
    expect(width * 2).toBeLessThanOrEqual(32)
  })

  it('cores válidas e contorno vindo do tema', () => {
    for (const color of Object.values(MASCOT_COLORS)) expect(() => parseHex(color)).not.toThrow()
    expect(mascotPalette('#123456')['#']).toBe('#123456')
  })
})
