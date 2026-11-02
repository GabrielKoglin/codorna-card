import { describe, expect, it } from 'vitest'
import { characters, glyph, measure, truncate } from '../src/render/font'

describe('fonte em pixel', () => {
  it('mede texto proporcional com 1 pixel entre letras', () => {
    expect(measure('')).toBe(0)
    expect(measure('A')).toBe(5)
    expect(measure('AB')).toBe(11)
    expect(measure('A B')).toBe(5 + 1 + 3 + 1 + 5)
    expect(measure('il')).toBe(3 + 1 + 3)
  })

  it('tem todas as letras, números e a pontuação usada no card', () => {
    const fallback = glyph('?')
    const text =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;-_+=#/%<>\'"!()[]|*&@·…'
    for (const char of characters(text)) {
      if (char === '?') continue
      expect(glyph(char).id, char).not.toBe(fallback.id)
    }
  })

  it('compõe acentos do português', () => {
    for (const char of characters('ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúçü')) {
      expect(glyph(char).id, char).not.toBe(glyph('?').id)
    }
    // Acento das maiúsculas fica acima da linha 0; o das minúsculas, acima da altura-x.
    expect(Math.min(...glyph('Í').pixels.map(([, y]) => y))).toBeLessThan(0)
    expect(Math.min(...glyph('ã').pixels.map(([, y]) => y))).toBeLessThan(2)
    // Cedilha fica embaixo.
    expect(Math.max(...glyph('Ç').pixels.map(([, y]) => y))).toBeGreaterThan(6)
    // "í" usa o i sem pingo.
    expect(glyph('í').width).toBe(glyph('i').width)
  })

  it('usa "?" para caracteres sem desenho', () => {
    expect(glyph('漢').id).toBe(glyph('?').id)
    expect(glyph('🙂').id).toBe(glyph('?').id)
  })

  it('corta com reticências quando não cabe', () => {
    const text = 'Jupyter Notebook'
    const cut = truncate(text, 40)
    expect(cut.endsWith('…')).toBe(true)
    expect(measure(cut)).toBeLessThanOrEqual(40)
    expect(truncate('Go', 40)).toBe('Go')
  })
})
