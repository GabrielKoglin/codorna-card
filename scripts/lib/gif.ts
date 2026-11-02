/**
 * GIF animado sem dependências. Usa uma paleta global com as cores exatas (pixel art tem
 * poucas cores, então não há quantização) e, a partir do segundo quadro, grava só o retângulo
 * que mudou, com os pixels iguais ao quadro anterior como transparentes. Pixels com alfa 0 no
 * primeiro quadro (os cantos em degrau do card) ficam transparentes no GIF todo. A compressão
 * LZW segue o formato GIF89a (códigos de 3 a 12 bits, com CLEAR quando a tabela enche).
 */
import type { Raster } from './raster'

export interface Frame {
  raster: Raster
  /** Duração em centésimos de segundo (os navegadores tratam menos de 2 como 10). */
  delay: number
}

function lzw(indices: Uint8Array, minCodeSize: number): Buffer {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  const bytes: number[] = []
  let bitBuffer = 0
  let bitCount = 0
  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  let table = new Map<number, number>()
  const emit = (code: number) => {
    bitBuffer |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xff)
      bitBuffer >>>= 8
      bitCount -= 8
    }
  }
  emit(clearCode)
  let prefix = indices[0] ?? 0
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i] ?? 0
    const key = (prefix << 8) | k
    const code = table.get(key)
    if (code !== undefined) {
      prefix = code
      continue
    }
    emit(prefix)
    if (nextCode === 4096) {
      emit(clearCode)
      nextCode = endCode + 1
      codeSize = minCodeSize + 1
      table = new Map()
    } else {
      if (nextCode >= 1 << codeSize) codeSize++
      table.set(key, nextCode++)
    }
    prefix = k
  }
  emit(prefix)
  emit(endCode)
  if (bitCount > 0) bytes.push(bitBuffer & 0xff)
  return Buffer.from(bytes)
}

/** Divide os dados em sub-blocos de até 255 bytes, terminando com um bloco vazio. */
function subBlocks(data: Buffer): Buffer {
  const parts: Buffer[] = []
  for (let i = 0; i < data.length; i += 255) {
    const piece = data.subarray(i, i + 255)
    parts.push(Buffer.from([piece.length]), piece)
  }
  parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}

function u16(value: number): Buffer {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(value, 0)
  return b
}

const rgbKey = (data: Uint8Array, o: number) =>
  ((data[o] ?? 0) << 16) | ((data[o + 1] ?? 0) << 8) | (data[o + 2] ?? 0)

/** Cor do pixel, ou -1 quando ele é transparente. */
const pixelKey = (data: Uint8Array, o: number) => (data[o + 3] === 0 ? -1 : rgbKey(data, o))

/**
 * Codifica os quadros (todos do mesmo tamanho) num GIF que repete para sempre. Cada pixel
 * precisa ser opaco ou totalmente transparente, e um pixel não pode sumir depois de aparecer.
 */
export function encodeGif(frames: readonly Frame[]): Buffer {
  const first = frames[0]
  if (!first) throw new Error('GIF sem quadros')
  const { width, height } = first.raster
  const colors = new Map<number, number>()
  for (const { raster } of frames) {
    if (raster.width !== width || raster.height !== height)
      throw new Error('quadros de tamanhos diferentes')
    for (let o = 0; o < raster.data.length; o += 4) {
      const alpha = raster.data[o + 3]
      if (alpha === 0) continue
      if (alpha !== 255) throw new Error('o GIF só aceita pixels opacos ou transparentes')
      const key = rgbKey(raster.data, o)
      if (!colors.has(key)) colors.set(key, colors.size)
    }
  }
  // Uma posição a mais para o índice transparente.
  if (colors.size + 1 > 256) throw new Error(`cores demais para um GIF: ${colors.size}`)
  const transparent = colors.size
  let bits = 1
  while (1 << bits < colors.size + 1) bits++
  const tableSize = 1 << bits
  const table = Buffer.alloc(tableSize * 3)
  for (const [key, slot] of colors) {
    table[slot * 3] = (key >> 16) & 0xff
    table[slot * 3 + 1] = (key >> 8) & 0xff
    table[slot * 3 + 2] = key & 0xff
  }
  const minCodeSize = Math.max(2, bits)

  // Junta quadros idênticos (soma as durações).
  const merged: Frame[] = []
  for (const frame of frames) {
    const last = merged[merged.length - 1]
    if (last && Buffer.from(last.raster.data).equals(Buffer.from(frame.raster.data))) {
      merged[merged.length - 1] = { raster: last.raster, delay: last.delay + frame.delay }
    } else merged.push(frame)
  }

  const parts: Buffer[] = [
    Buffer.from('GIF89a', 'latin1'),
    u16(width),
    u16(height),
    Buffer.from([0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0]),
    table,
    // Repetir para sempre (extensão NETSCAPE2.0).
    Buffer.from([0x21, 0xff, 0x0b]),
    Buffer.from('NETSCAPE2.0', 'latin1'),
    Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]),
  ]

  let previous: Raster | null = null
  for (const { raster, delay } of merged) {
    let left = 0
    let top = 0
    let right = width - 1
    let bottom = height - 1
    if (previous) {
      left = width
      top = height
      right = -1
      bottom = -1
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const o = (y * width + x) * 4
          const now = pixelKey(raster.data, o)
          if (now !== pixelKey(previous.data, o)) {
            if (now === -1) throw new Error('um pixel não pode voltar a ficar transparente')
            left = Math.min(left, x)
            right = Math.max(right, x)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
          }
        }
      }
    }
    const w = right - left + 1
    const h = bottom - top + 1
    const indices = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = ((top + y) * width + left + x) * 4
        const key = pixelKey(raster.data, o)
        const same = previous !== null && key === pixelKey(previous.data, o)
        indices[y * w + x] = key === -1 || same ? transparent : (colors.get(key) ?? 0)
      }
    }
    const flags = (1 << 2) | 1 // descarte 1 (mantém o quadro) + índice transparente
    parts.push(
      Buffer.from([0x21, 0xf9, 0x04, flags]),
      u16(Math.max(2, Math.round(delay))),
      Buffer.from([transparent, 0]),
      Buffer.from([0x2c]),
      u16(left),
      u16(top),
      u16(w),
      u16(h),
      Buffer.from([0, minCodeSize]),
      subBlocks(lzw(indices, minCodeSize)),
    )
    previous = raster
  }
  parts.push(Buffer.from([0x3b]))
  return Buffer.concat(parts)
}
