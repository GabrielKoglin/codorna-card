export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Cobre um conjunto de pixels com poucos retângulos (guloso: estende para a direita
 * e depois para baixo). Deixa o SVG bem menor do que um retângulo por pixel.
 */
export function coverPixels(pixels: Iterable<readonly [number, number]>): Rect[] {
  const filled = new Set<string>()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pixels) {
    filled.add(`${x},${y}`)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const used = new Set<string>()
  const free = (x: number, y: number): boolean => filled.has(`${x},${y}`) && !used.has(`${x},${y}`)
  const rects: Rect[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!free(x, y)) continue
      let w = 1
      while (free(x + w, y)) w++
      let h = 1
      grow: while (y + h <= maxY) {
        for (let dx = 0; dx < w; dx++) if (!free(x + dx, y + h)) break grow
        h++
      }
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) used.add(`${x + dx},${y + dy}`)
      rects.push({ x, y, w, h })
    }
  }
  return rects
}

/** Converte retângulos em um atributo `d` de path, com escala e deslocamento inteiros. */
export function rectsToPath(rects: readonly Rect[], scale = 1, offsetX = 0, offsetY = 0): string {
  return rects
    .map((r) => {
      const x = offsetX + r.x * scale
      const y = offsetY + r.y * scale
      const w = r.w * scale
      return `M${x} ${y}h${w}v${r.h * scale}h-${w}z`
    })
    .join('')
}

export function pixelPath(
  pixels: Iterable<readonly [number, number]>,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
): string {
  return rectsToPath(coverPixels(pixels), scale, offsetX, offsetY)
}

/** Lê um desenho em texto ('#' = pixel aceso) e devolve as coordenadas acesas. */
export function parseBitmap(rows: readonly string[], on = '#'): [number, number][] {
  const pixels: [number, number][] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === on) pixels.push([x, y])
  })
  return pixels
}
