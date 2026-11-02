import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { encodeGif } from '../scripts/lib/gif'
import { decodePng, encodePng, samePixels } from '../scripts/lib/png'
import { blit, createRaster, rasterizeSvg, scaleRaster, type Raster } from '../scripts/lib/raster'
import { buildCharacter } from '../src/character'
import { renderCard } from '../src/render/card'
import { THEMES } from '../src/render/theme'
import type { PlayerData } from '../src/types'

const pixel = (raster: Raster, x: number, y: number) => [
  ...raster.data.subarray((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4),
]
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

const svg = (body: string, size = '8') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`

describe('rasterizador', () => {
  it('desenha retângulos, caminhos e glifos com transformações', () => {
    const raster = rasterizeSvg(
      svg(
        '<defs><path id="dot" d="M0 0h1v1h-1z"/></defs>' +
          '<rect x="0" y="0" width="2" height="1" fill="#ff0000"/>' +
          '<path fill="#00ff00" d="M4 4h2v2h-2z"/>' +
          '<g fill="#0000ff" transform="translate(1 6) scale(2)"><use href="#dot"/><use href="#dot" x="2"/></g>',
      ),
    )
    expect(pixel(raster, 0, 0)).toEqual([255, 0, 0, 255])
    expect(pixel(raster, 1, 0)).toEqual([255, 0, 0, 255])
    expect(pixel(raster, 2, 0)).toEqual([0, 0, 0, 0])
    expect(pixel(raster, 5, 5)).toEqual([0, 255, 0, 255])
    expect(pixel(raster, 6, 5)).toEqual([0, 0, 0, 0])
    // Glifo de 1×1 em escala 2 vira 2×2; o segundo começa em x = 1 + 2·2.
    expect(pixel(raster, 1, 6)).toEqual([0, 0, 255, 255])
    expect(pixel(raster, 2, 7)).toEqual([0, 0, 255, 255])
    expect(pixel(raster, 3, 7)).toEqual([0, 0, 0, 0])
    expect(pixel(raster, 5, 7)).toEqual([0, 0, 255, 255])
  })

  it('preenche pela regra nonzero e amplia sem suavizar', () => {
    // Cruz: dois retângulos que se sobrepõem no meio, que também fica pintado.
    const raster = rasterizeSvg(svg('<path fill="#123456" d="M3 0h2v8h-2zM0 3h8v2h-8z"/>'), {
      scale: 2,
      background: '#ffffff',
    })
    expect(raster.width).toBe(16)
    expect(pixel(raster, 8, 8)).toEqual([0x12, 0x34, 0x56, 255])
    expect(pixel(raster, 0, 0)).toEqual([255, 255, 255, 255])
    expect(pixel(raster, 0, 7)).toEqual([0x12, 0x34, 0x56, 255])
    const doubled = scaleRaster(rasterizeSvg(svg('<rect x="1" y="1" width="1" height="1"/>')), 3)
    expect(pixel(doubled, 3, 3)).toEqual([0, 0, 0, 255])
    expect(pixel(doubled, 5, 5)).toEqual([0, 0, 0, 255])
    expect(pixel(doubled, 6, 6)).toEqual([0, 0, 0, 0])
  })

  it('recusa o que não sabe desenhar em vez de errar calado', () => {
    expect(() => rasterizeSvg(svg('<circle cx="1" cy="1" r="1"/>'))).toThrow('não suportado')
    expect(() => rasterizeSvg(svg('<path d="M0 0L3 3h-3z"/>'))).toThrow('diagonal')
    expect(() => rasterizeSvg(svg('<rect width="1" height="1" opacity="0.5"/>'))).toThrow('opacity')
    expect(() => rasterizeSvg(svg('<g transform="rotate(45)"></g>'))).toThrow('transformação')
    expect(() => rasterizeSvg(svg('<rect x="0.5" width="1" height="1"/>'))).toThrow('grade')
    expect(() => rasterizeSvg(svg('<use href="#nada"/>'))).toThrow('aponta para nada')
  })

  it('copia uma imagem sobre a outra respeitando a transparência', () => {
    const base = createRaster(4, 4, '#ffffff')
    const top = rasterizeSvg(svg('<rect x="1" y="1" width="1" height="1" fill="#ff0000"/>', '2'))
    blit(base, top, 2, 2)
    expect(pixel(base, 3, 3)).toEqual([255, 0, 0, 255])
    expect(pixel(base, 2, 2)).toEqual([255, 255, 255, 255])
  })

  it('desenha o card do jeito que o tema manda', () => {
    const data = JSON.parse(
      readFileSync(new URL('../fixtures/veterano.json', import.meta.url), 'utf8'),
    ) as PlayerData
    const raster = rasterizeSvg(renderCard(buildCharacter(data), { theme: 'light', lang: 'en' }))
    expect([raster.width, raster.height]).toEqual([640, 360])
    expect(pixel(raster, 0, 0)).toEqual([0, 0, 0, 0]) // canto em degrau: transparente
    expect(pixel(raster, 320, 340).slice(0, 3)).toEqual(rgb(THEMES.light.background))
    expect(pixel(raster, 320, 20).slice(0, 3)).toEqual(rgb(THEMES.light.panel))
  })
})

describe('PNG', () => {
  it('ida e volta com paleta e com transparência', () => {
    const raster = rasterizeSvg(svg('<rect x="2" y="2" width="3" height="3" fill="#abcdef"/>'))
    const file = encodePng(raster)
    expect(file.subarray(1, 4).toString()).toBe('PNG')
    expect(file[25]).toBe(3) // tipo de cor: paleta
    const back = decodePng(file)
    expect(back && samePixels(back, raster)).toBe(true)
  })

  it('ida e volta em RGBA quando passa de 256 cores', () => {
    const raster = createRaster(32, 32)
    for (let i = 0; i < 32 * 32; i++) raster.data.set([i & 0xff, i >> 2, 200, 255], i * 4)
    const file = encodePng(raster)
    expect(file[25]).toBe(6) // RGBA
    const back = decodePng(file)
    expect(back && samePixels(back, raster)).toBe(true)
  })

  it('trata pixels transparentes como iguais, seja qual for a cor', () => {
    const a = createRaster(1, 1)
    const b = createRaster(1, 1)
    b.data.set([9, 9, 9, 0])
    expect(samePixels(a, b)).toBe(true)
  })
})

/** Decodificador GIF mínimo, só para o teste: devolve os quadros já compostos. */
function decodeGif(file: Buffer): { delays: number[]; frames: Uint8Array[] } {
  expect(file.subarray(0, 6).toString('latin1')).toBe('GIF89a')
  const width = file.readUInt16LE(6)
  const height = file.readUInt16LE(8)
  const packed = file[10] ?? 0
  const tableSize = 1 << ((packed & 7) + 1)
  const table = file.subarray(13, 13 + tableSize * 3)
  let p = 13 + tableSize * 3
  const canvas = new Uint8Array(width * height * 3)
  const frames: Uint8Array[] = []
  const delays: number[] = []
  let transparent: number | null = null
  for (;;) {
    const byte = file[p++]
    if (byte === 0x3b) break
    if (byte === 0x21) {
      const label = file[p++]
      if (label === 0xf9) {
        const flags = file[p + 1] ?? 0
        delays.push(file.readUInt16LE(p + 2))
        transparent = flags & 1 ? (file[p + 4] ?? 0) : null
      }
      while ((file[p] ?? 0) !== 0) p += (file[p] ?? 0) + 1
      p++
      continue
    }
    expect(byte).toBe(0x2c)
    const left = file.readUInt16LE(p)
    const top = file.readUInt16LE(p + 2)
    const w = file.readUInt16LE(p + 4)
    const h = file.readUInt16LE(p + 6)
    p += 9
    const minCode = file[p++] ?? 2
    const data: number[] = []
    while ((file[p] ?? 0) !== 0) {
      const n = file[p] ?? 0
      data.push(...file.subarray(p + 1, p + 1 + n))
      p += n + 1
    }
    p++
    // LZW
    const clear = 1 << minCode
    let size = minCode + 1
    let dict: number[][] = []
    const reset = () => {
      dict = Array.from({ length: clear + 2 }, (_, i) => [i])
      size = minCode + 1
    }
    reset()
    const out: number[] = []
    let bit = 0
    let prev: number[] | null = null
    for (;;) {
      let code = 0
      for (let i = 0; i < size; i++, bit++) code |= (((data[bit >> 3] ?? 0) >> (bit & 7)) & 1) << i
      if (code === clear) {
        reset()
        prev = null
        continue
      }
      if (code === clear + 1) break
      let entry = dict[code]
      if (!entry) entry = [...prev!, prev![0]!]
      out.push(...entry)
      if (prev) dict.push([...prev, entry[0]!])
      prev = entry
      if (dict.length === 1 << size && size < 12) size++
    }
    expect(out).toHaveLength(w * h)
    out.forEach((index, i) => {
      if (index === transparent) return
      const o = ((top + Math.floor(i / w)) * width + left + (i % w)) * 3
      canvas.set(table.subarray(index * 3, index * 3 + 3), o)
    })
    frames.push(canvas.slice())
  }
  return { delays, frames }
}

describe('GIF', () => {
  const frame = (fill: string, extra = '') =>
    rasterizeSvg(svg(`<rect width="8" height="8" fill="${fill}"/>${extra}`, '8'))

  it('ida e volta: quadros parciais, transparência e repetição', () => {
    const frames = [
      { raster: frame('#102030'), delay: 50 },
      {
        raster: frame('#102030', '<rect x="2" y="3" width="3" height="2" fill="#ffcc00"/>'),
        delay: 8,
      },
      {
        raster: frame('#102030', '<rect x="2" y="3" width="3" height="2" fill="#ffcc00"/>'),
        delay: 8,
      },
      { raster: frame('#ffffff'), delay: 100 },
    ]
    const gif = encodeGif(frames)
    expect(gif.includes(Buffer.from('NETSCAPE2.0'))).toBe(true)
    const decoded = decodeGif(gif)
    // O terceiro quadro é igual ao segundo: vira um só, com as durações somadas.
    expect(decoded.delays).toEqual([50, 16, 100])
    const expected = [frames[0]!, frames[1]!, frames[3]!].map((f) => {
      const rgbOnly = new Uint8Array(8 * 8 * 3)
      for (let i = 0; i < 64; i++) rgbOnly.set(f.raster.data.subarray(i * 4, i * 4 + 3), i * 3)
      return [...rgbOnly]
    })
    expect(decoded.frames.map((f) => [...f])).toEqual(expected)
  })

  it('mantém transparentes os pixels que começam transparentes', () => {
    const corner = (fill: string) =>
      rasterizeSvg(svg(`<path fill="${fill}" d="M1 0h7v8h-8v-7h1z"/>`, '8'))
    const decoded = decodeGif(
      encodeGif([
        { raster: corner('#336699'), delay: 10 },
        { raster: corner('#996633'), delay: 10 },
      ]),
    )
    expect(decoded.frames).toHaveLength(2)
    // (0, 0) nunca é pintado: fica com o fundo do decodificador (zero) nos dois quadros.
    expect([...decoded.frames[1]!.subarray(0, 3)]).toEqual([0, 0, 0])
    expect([...decoded.frames[1]!.subarray(3, 6)]).toEqual([0x99, 0x66, 0x33])
    expect(() =>
      encodeGif([
        { raster: corner('#336699'), delay: 10 },
        { raster: createRaster(8, 8), delay: 10 },
      ]),
    ).toThrow('transparente')
  })

  it('aguenta imagens grandes (tabela LZW cheia e reiniciada)', () => {
    const raster = createRaster(200, 200)
    for (let i = 0; i < 200 * 200; i++) {
      const v = (i * 7919) % 97
      raster.data.set([v * 2, 255 - v, (v * 5) & 0xff, 255], i * 4)
    }
    const decoded = decodeGif(encodeGif([{ raster, delay: 10 }]))
    const rgbOnly = new Uint8Array(200 * 200 * 3)
    for (let i = 0; i < 200 * 200; i++) rgbOnly.set(raster.data.subarray(i * 4, i * 4 + 3), i * 3)
    expect(Buffer.from(decoded.frames[0]!).equals(Buffer.from(rgbOnly))).toBe(true)
  })
})
