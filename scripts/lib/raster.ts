/**
 * Rasterizador do SVG que o próprio Codorna Card gera: retângulos, caminhos só com segmentos
 * retos na horizontal e na vertical, grupos com translate/scale e `<use>` dos glifos da fonte.
 * Tudo cai na grade de pixels, então não há anti-aliasing e o resultado é o mesmo que o
 * navegador desenha com shape-rendering="crispEdges".
 *
 * Não é um leitor de SVG genérico: qualquer coisa fora desse subconjunto vira erro, para nunca
 * gerar uma imagem diferente do SVG sem avisar.
 */

export interface Raster {
  width: number
  height: number
  /** RGBA, linha a linha, 4 bytes por pixel. */
  data: Uint8Array
}

type Rgba = readonly [number, number, number, number]

export function parseColor(value: string): Rgba {
  const hex = value.trim().replace('#', '')
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`cor não suportada: ${value}`)
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
    255,
  ]
}

export function createRaster(width: number, height: number, background?: string): Raster {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`tamanho inválido: ${width}×${height}`)
  }
  const raster = { width, height, data: new Uint8Array(width * height * 4) }
  if (background) fillRect(raster, 0, 0, width, height, parseColor(background))
  return raster
}

/** Pinta o retângulo [x0, x1) × [y0, y1), cortado nas bordas da imagem. */
export function fillRect(
  raster: Raster,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Rgba,
): void {
  const left = Math.max(0, x0)
  const right = Math.min(raster.width, x1)
  const top = Math.max(0, y0)
  const bottom = Math.min(raster.height, y1)
  if (left >= right || top >= bottom) return
  // Uma palavra de 32 bits por pixel, na ordem de bytes da máquina: pinta a linha de uma vez.
  const word = new Uint32Array(Uint8Array.from(color).buffer)[0] ?? 0
  const pixels = new Uint32Array(
    raster.data.buffer,
    raster.data.byteOffset,
    raster.width * raster.height,
  )
  for (let y = top; y < bottom; y++) {
    pixels.fill(word, y * raster.width + left, y * raster.width + right)
  }
}

/** Copia os pixels visíveis (alfa > 0) de `source` para `target` na posição (x, y). */
export function blit(target: Raster, source: Raster, x: number, y: number): void {
  for (let sy = 0; sy < source.height; sy++) {
    const ty = y + sy
    if (ty < 0 || ty >= target.height) continue
    for (let sx = 0; sx < source.width; sx++) {
      const tx = x + sx
      if (tx < 0 || tx >= target.width) continue
      const from = (sy * source.width + sx) * 4
      if (source.data[from + 3] === 0) continue
      target.data.set(source.data.subarray(from, from + 4), (ty * target.width + tx) * 4)
    }
  }
}

/** Amplia por um fator inteiro, pixel a pixel (sem suavizar). */
export function scaleRaster(source: Raster, factor: number): Raster {
  if (factor === 1) return source
  const target = createRaster(source.width * factor, source.height * factor)
  for (let y = 0; y < target.height; y++) {
    for (let x = 0; x < target.width; x++) {
      const from = (Math.floor(y / factor) * source.width + Math.floor(x / factor)) * 4
      target.data.set(source.data.subarray(from, from + 4), (y * target.width + x) * 4)
    }
  }
  return target
}

/** Transformação só com escala uniforme e deslocamento: p → s·p + t. */
interface Transform {
  s: number
  tx: number
  ty: number
}

interface State extends Transform {
  fill: string | null
}

interface Tag {
  closing: boolean
  name: string
  attrs: Record<string, string>
  selfClosing: boolean
}

const IGNORED_ATTRS = new Set(['xmlns', 'role', 'aria-labelledby', 'aria-label', 'id'])
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  svg: new Set(['width', 'height', 'viewBox', 'shape-rendering']),
  title: new Set(),
  desc: new Set(),
  defs: new Set(),
  g: new Set(['fill', 'transform']),
  rect: new Set(['x', 'y', 'width', 'height', 'fill', 'transform']),
  path: new Set(['d', 'fill', 'transform']),
  use: new Set(['href', 'x', 'y', 'fill', 'transform']),
}

function* tags(svg: string): Generator<Tag> {
  const pattern = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g
  let last = 0
  for (const match of svg.matchAll(pattern)) {
    const between = svg.slice(last, match.index)
    if (between.includes('<')) throw new Error(`trecho não suportado no SVG: ${between.trim()}`)
    last = (match.index ?? 0) + match[0].length
    const attrs: Record<string, string> = {}
    for (const [, key, value] of (match[3] ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)) {
      if (key) attrs[key] = value ?? ''
    }
    yield {
      closing: match[1] === '/',
      name: match[2] ?? '',
      attrs,
      selfClosing: match[4] === '/',
    }
  }
  if (svg.slice(last).includes('<')) throw new Error('fim do SVG com trecho não suportado')
}

function number(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`número inválido: ${value}`)
  return parsed
}

function parseTransform(value: string | undefined): Transform {
  const result: Transform = { s: 1, tx: 0, ty: 0 }
  if (!value) return result
  const pattern = /(translate|scale)\(([^)]*)\)/g
  let consumed = ''
  for (const [whole, kind, args] of value.matchAll(pattern)) {
    consumed += whole ?? ''
    const numbers = (args ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((n) => number(n))
    if (kind === 'translate') {
      const [dx = 0, dy = 0] = numbers
      result.tx += result.s * dx
      result.ty += result.s * dy
    } else {
      const [sx = 1, sy = sx] = numbers
      if (sx !== sy || sx <= 0) throw new Error(`escala não suportada: ${value}`)
      result.s *= sx
    }
  }
  if (consumed.replace(/\s/g, '') !== value.replace(/\s/g, '')) {
    throw new Error(`transformação não suportada: ${value}`)
  }
  return result
}

function compose(parent: Transform, local: Transform): Transform {
  return {
    s: parent.s * local.s,
    tx: parent.s * local.tx + parent.tx,
    ty: parent.s * local.ty + parent.ty,
  }
}

/** Coordenada de tela: precisa cair exatamente na grade de pixels. */
function onGrid(value: number): number {
  const rounded = Math.round(value)
  if (Math.abs(rounded - value) > 1e-9) throw new Error(`coordenada fora da grade: ${value}`)
  return rounded
}

interface Edge {
  x: number
  top: number
  bottom: number
  dir: 1 | -1
}

/** Lê um caminho só com segmentos retos e devolve as arestas verticais já transformadas. */
function pathEdges(d: string, transform: Transform): Edge[] {
  const tokens = d.match(/[MmLlHhVvZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const edges: Edge[] = []
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let command = ''
  let i = 0
  const next = () => {
    const token = tokens[i++]
    if (token === undefined || /[a-zA-Z]/.test(token)) throw new Error(`caminho incompleto: ${d}`)
    return Number(token)
  }
  const lineTo = (nx: number, ny: number) => {
    if (nx !== x && ny !== y) throw new Error(`segmento diagonal não suportado: ${d}`)
    if (nx === x && ny !== y) {
      const X = onGrid(transform.s * x + transform.tx)
      const Y0 = onGrid(transform.s * y + transform.ty)
      const Y1 = onGrid(transform.s * ny + transform.ty)
      edges.push({ x: X, top: Math.min(Y0, Y1), bottom: Math.max(Y0, Y1), dir: Y1 > Y0 ? 1 : -1 })
    }
    x = nx
    y = ny
  }
  while (i < tokens.length) {
    const token = tokens[i] ?? ''
    if (/[a-zA-Z]/.test(token)) {
      command = token
      i++
    } else if (!command || command === 'Z' || command === 'z') {
      throw new Error(`caminho inválido: ${d}`)
    }
    switch (command) {
      case 'M':
      case 'm': {
        const nx = next()
        const ny = next()
        x = command === 'm' ? x + nx : nx
        y = command === 'm' ? y + ny : ny
        startX = x
        startY = y
        command = command === 'm' ? 'l' : 'L'
        break
      }
      case 'L':
        lineTo(next(), next())
        break
      case 'l': {
        const dx = next()
        lineTo(x + dx, y + next())
        break
      }
      case 'H':
        lineTo(next(), y)
        break
      case 'h':
        lineTo(x + next(), y)
        break
      case 'V':
        lineTo(x, next())
        break
      case 'v':
        lineTo(x, y + next())
        break
      case 'Z':
      case 'z':
        lineTo(startX, startY)
        break
      default:
        throw new Error(`comando de caminho não suportado: ${command}`)
    }
  }
  return edges
}

/** Preenche pela regra nonzero (a padrão do SVG), linha a linha no centro dos pixels. */
function fillEdges(raster: Raster, edges: Edge[], color: Rgba): void {
  if (edges.length === 0) return
  const top = Math.max(0, Math.min(...edges.map((e) => e.top)))
  const bottom = Math.min(raster.height, Math.max(...edges.map((e) => e.bottom)))
  for (let row = top; row < bottom; row++) {
    const active = edges.filter((e) => e.top <= row && e.bottom > row).sort((a, b) => a.x - b.x)
    let winding = 0
    for (let k = 0; k < active.length - 1; k++) {
      const edge = active[k]
      const following = active[k + 1]
      if (!edge || !following) continue
      winding += edge.dir
      if (winding !== 0 && following.x > edge.x)
        fillRect(raster, edge.x, row, following.x, row + 1, color)
    }
  }
}

/**
 * Converte um SVG do projeto em pixels. `scale` amplia por um fator inteiro; sem `background`,
 * o que não é desenhado fica transparente.
 */
export function rasterizeSvg(
  svg: string,
  options: { scale?: number; background?: string } = {},
): Raster {
  const scale = options.scale ?? 1
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`escala inválida: ${scale}`)
  const all = [...tags(svg)]

  const defs = new Map<string, string>()
  let depth = 0
  for (const tag of all) {
    if (tag.name === 'defs' && !tag.selfClosing) depth += tag.closing ? -1 : 1
    else if (depth > 0 && tag.name === 'path' && !tag.closing) {
      const id = tag.attrs.id
      if (!id || tag.attrs.d === undefined) throw new Error('<path> em <defs> sem id ou d')
      defs.set(id, tag.attrs.d)
    }
  }

  let raster: Raster | null = null
  const stack: State[] = []
  let inDefs = 0
  let inText = 0
  for (const tag of all) {
    const allowed = ALLOWED_ATTRS[tag.name]
    if (!allowed) throw new Error(`elemento não suportado: <${tag.name}>`)
    if (!tag.closing) {
      for (const key of Object.keys(tag.attrs)) {
        if (!allowed.has(key) && !IGNORED_ATTRS.has(key) && !(tag.name === 'path' && inDefs > 0)) {
          throw new Error(`atributo não suportado em <${tag.name}>: ${key}`)
        }
      }
    }
    if (tag.name === 'svg') {
      if (tag.closing) continue
      if (raster) throw new Error('<svg> dentro de <svg> não é suportado')
      const width = number(tag.attrs.width)
      const height = number(tag.attrs.height)
      const viewBox = tag.attrs.viewBox
      if (
        viewBox !== undefined &&
        viewBox
          .trim()
          .split(/[\s,]+/)
          .map(Number)
          .join(' ') !== `0 0 ${width} ${height}`
      ) {
        throw new Error(`viewBox precisa ser "0 0 ${width} ${height}"`)
      }
      raster = createRaster(width * scale, height * scale, options.background)
      stack.push({ s: scale, tx: 0, ty: 0, fill: null })
      continue
    }
    if (!raster) throw new Error('SVG sem a tag <svg>')
    const state = stack[stack.length - 1] ?? { s: scale, tx: 0, ty: 0, fill: null }
    if (tag.name === 'title' || tag.name === 'desc') {
      if (!tag.selfClosing) inText += tag.closing ? -1 : 1
      continue
    }
    if (tag.name === 'defs') {
      if (!tag.selfClosing) inDefs += tag.closing ? -1 : 1
      continue
    }
    if (inDefs > 0 || inText > 0) continue
    if (tag.name === 'g') {
      if (tag.closing) {
        stack.pop()
      } else if (!tag.selfClosing) {
        stack.push({
          ...compose(state, parseTransform(tag.attrs.transform)),
          fill: tag.attrs.fill ?? state.fill,
        })
      }
      continue
    }
    if (tag.closing) continue
    const fill = tag.attrs.fill ?? state.fill ?? '#000000'
    if (fill === 'none') continue
    const color = parseColor(fill)
    const transform = compose(state, parseTransform(tag.attrs.transform))
    if (tag.name === 'rect') {
      const x = number(tag.attrs.x)
      const y = number(tag.attrs.y)
      const w = number(tag.attrs.width)
      const h = number(tag.attrs.height)
      if (w <= 0 || h <= 0) continue
      fillRect(
        raster,
        onGrid(transform.s * x + transform.tx),
        onGrid(transform.s * y + transform.ty),
        onGrid(transform.s * (x + w) + transform.tx),
        onGrid(transform.s * (y + h) + transform.ty),
        color,
      )
    } else if (tag.name === 'path') {
      fillEdges(raster, pathEdges(tag.attrs.d ?? '', transform), color)
    } else if (tag.name === 'use') {
      const href = tag.attrs.href ?? ''
      const d = defs.get(href.replace(/^#/, ''))
      if (!href.startsWith('#') || d === undefined)
        throw new Error(`<use> aponta para nada: ${href}`)
      const placed = compose(transform, { s: 1, tx: number(tag.attrs.x), ty: number(tag.attrs.y) })
      fillEdges(raster, pathEdges(d, placed), color)
    }
  }
  if (!raster) throw new Error('SVG sem a tag <svg>')
  return raster
}
