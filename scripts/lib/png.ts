/**
 * PNG sem dependências (só o zlib do Node). Grava com paleta quando a imagem tem até 256
 * cores (o normal em pixel art) e lê PNGs de 8 bits sem entrelaçamento, o bastante para
 * comparar uma imagem nova com a que já está no repositório.
 */
import { deflateSync, inflateSync } from 'node:zlib'
import type { Raster } from './raster'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array, start = 0xffffffff): number {
  let crc = start
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

/** Paleta das cores usadas, na ordem em que aparecem (null se passar de 256). */
export function palette(raster: Raster): { colors: number[]; index: Uint8Array } | null {
  const seen = new Map<number, number>()
  const colors: number[] = []
  const index = new Uint8Array(raster.width * raster.height)
  const data = raster.data
  for (let i = 0; i < index.length; i++) {
    const o = i * 4
    const key =
      ((data[o] ?? 0) << 24) |
      ((data[o + 1] ?? 0) << 16) |
      ((data[o + 2] ?? 0) << 8) |
      (data[o + 3] ?? 0)
    let slot = seen.get(key)
    if (slot === undefined) {
      if (colors.length === 256) return null
      slot = colors.length
      seen.set(key, slot)
      colors.push(key >>> 0)
    }
    index[i] = slot
  }
  return { colors, index }
}

/** Codifica em PNG: com paleta quando dá, senão RGBA com filtro adaptativo. */
export function encodePng(raster: Raster): Buffer {
  const { width, height } = raster
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[10] = 0
  header[11] = 0
  header[12] = 0
  const chunks: Buffer[] = []
  const indexed = palette(raster)
  let raw: Buffer
  if (indexed) {
    header[9] = 3
    const plte = Buffer.alloc(indexed.colors.length * 3)
    const alpha = Buffer.alloc(indexed.colors.length)
    indexed.colors.forEach((color, i) => {
      plte[i * 3] = (color >>> 24) & 0xff
      plte[i * 3 + 1] = (color >>> 16) & 0xff
      plte[i * 3 + 2] = (color >>> 8) & 0xff
      alpha[i] = color & 0xff
    })
    chunks.push(chunk('PLTE', plte))
    let lastTransparent = -1
    alpha.forEach((value, i) => {
      if (value !== 255) lastTransparent = i
    })
    if (lastTransparent >= 0) chunks.push(chunk('tRNS', alpha.subarray(0, lastTransparent + 1)))
    raw = Buffer.alloc((width + 1) * height)
    for (let y = 0; y < height; y++) {
      raw[y * (width + 1)] = 0
      raw.set(indexed.index.subarray(y * width, (y + 1) * width), y * (width + 1) + 1)
    }
  } else {
    header[9] = 6
    raw = filterRows(raster.data, width * 4, height, 4)
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    ...chunks,
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Escolhe, linha a linha, o filtro com a menor soma de diferenças (heurística clássica). */
function filterRows(data: Uint8Array, stride: number, height: number, bpp: number): Buffer {
  const out = Buffer.alloc((stride + 1) * height)
  const candidate = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const row = data.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? data.subarray((y - 1) * stride, y * stride) : null
    let best = -1
    let bestScore = Infinity
    let bestRow = Buffer.alloc(stride)
    for (let type = 0; type <= 4; type++) {
      let score = 0
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? (row[x - bpp] ?? 0) : 0
        const b = prev ? (prev[x] ?? 0) : 0
        const c = prev && x >= bpp ? (prev[x - bpp] ?? 0) : 0
        const value = row[x] ?? 0
        const predicted =
          type === 0
            ? 0
            : type === 1
              ? a
              : type === 2
                ? b
                : type === 3
                  ? (a + b) >> 1
                  : paeth(a, b, c)
        const filtered = (value - predicted) & 0xff
        candidate[x] = filtered
        score += filtered < 128 ? filtered : 256 - filtered
      }
      if (score < bestScore) {
        bestScore = score
        best = type
        bestRow = Buffer.from(candidate)
      }
    }
    out[y * (stride + 1)] = best
    bestRow.copy(out, y * (stride + 1) + 1)
  }
  return out
}

/** Lê um PNG de 8 bits sem entrelaçamento. Devolve null para o que não sabe ler. */
export function decodePng(file: Uint8Array): Raster | null {
  const buffer = Buffer.from(file.buffer, file.byteOffset, file.byteLength)
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) return null
  let offset = 8
  let width = 0
  let height = 0
  let depth = 0
  let colorType = 0
  let interlace = 0
  let plte: Buffer | null = null
  let trns: Buffer | null = null
  const idat: Buffer[] = []
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('latin1', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      depth = data[8] ?? 0
      colorType = data[9] ?? 0
      interlace = data[12] ?? 0
    } else if (type === 'PLTE') plte = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType]
  if (!channels || depth !== 8 || interlace !== 0 || width === 0 || height === 0) return null
  if (colorType === 3 && !plte) return null
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  if (raw.length < (stride + 1) * height) return null
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)] ?? 0
    const source = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? (pixels[y * stride + x - channels] ?? 0) : 0
      const b = y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0
      const c = y > 0 && x >= channels ? (pixels[(y - 1) * stride + x - channels] ?? 0) : 0
      const predicted =
        type === 0
          ? 0
          : type === 1
            ? a
            : type === 2
              ? b
              : type === 3
                ? (a + b) >> 1
                : paeth(a, b, c)
      pixels[y * stride + x] = ((source[x] ?? 0) + predicted) & 0xff
    }
  }
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const p = i * channels
    const o = i * 4
    if (colorType === 3) {
      const slot = pixels[p] ?? 0
      data[o] = plte?.[slot * 3] ?? 0
      data[o + 1] = plte?.[slot * 3 + 1] ?? 0
      data[o + 2] = plte?.[slot * 3 + 2] ?? 0
      data[o + 3] = trns && slot < trns.length ? (trns[slot] ?? 255) : 255
    } else if (colorType === 0 || colorType === 4) {
      const gray = pixels[p] ?? 0
      data[o] = gray
      data[o + 1] = gray
      data[o + 2] = gray
      data[o + 3] = colorType === 4 ? (pixels[p + 1] ?? 255) : 255
    } else {
      data[o] = pixels[p] ?? 0
      data[o + 1] = pixels[p + 1] ?? 0
      data[o + 2] = pixels[p + 2] ?? 0
      data[o + 3] = colorType === 6 ? (pixels[p + 3] ?? 255) : 255
    }
  }
  return { width, height, data }
}

/** Mesmos pixels? Pixels totalmente transparentes contam como iguais, seja qual for a cor. */
export function samePixels(a: Raster, b: Raster): boolean {
  if (a.width !== b.width || a.height !== b.height) return false
  for (let i = 0; i < a.data.length; i += 4) {
    const alphaA = a.data[i + 3] ?? 0
    const alphaB = b.data[i + 3] ?? 0
    if (alphaA !== alphaB) return false
    if (alphaA === 0) continue
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2]
    )
      return false
  }
  return true
}
