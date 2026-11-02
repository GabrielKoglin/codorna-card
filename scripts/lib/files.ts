/**
 * Gravação que só mexe no arquivo quando o conteúdo muda. Para PNG, compara os pixels:
 * o zlib pode comprimir um pouco diferente em cada máquina, e isso não pode virar diff.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { decodePng, encodePng, samePixels } from './png'
import type { Raster } from './raster'

/** Grava se o conteúdo mudou. Devolve true quando gravou. */
export function writeIfChanged(path: string, content: string | Uint8Array): boolean {
  const next = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content)
  if (existsSync(path) && readFileSync(path).equals(next)) return false
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, next)
  return true
}

/** Grava o PNG se os pixels mudaram. Devolve true quando gravou. */
export function writePngIfChanged(path: string, raster: Raster): boolean {
  if (existsSync(path)) {
    const current = decodePng(readFileSync(path))
    if (current && samePixels(current, raster)) return false
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encodePng(raster))
  return true
}

/** Tamanho legível para os logs, ex.: "18.4 KB". */
export function size(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`
}
