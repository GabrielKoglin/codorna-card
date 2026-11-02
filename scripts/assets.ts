/**
 * Gera a arte do projeto em `assets/` a partir do próprio renderizador (sem chamar a API):
 * logo para fundo escuro e claro (SVG e PNG), a codorna sozinha, as prévias sociais 1280×640
 * e o GIF do card subindo de nível. Arquivo que não mudou não é regravado.
 * Uso: npm run assets
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCharacter } from '../src/character'
import { renderLogo, renderMascot, renderSocialPreview } from '../src/render/brand'
import { renderCard } from '../src/render/card'
import type { Lang, PlayerData, ThemeName } from '../src/types'
import { size, writeIfChanged, writePngIfChanged } from './lib/files'
import { encodeGif } from './lib/gif'
import { levelUpFrames } from './lib/level-up'
import { rasterizeSvg, type Raster } from './lib/raster'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assets = join(root, 'assets')

const fixture = (name: string): PlayerData =>
  JSON.parse(readFileSync(join(root, 'fixtures', `${name}.json`), 'utf8')) as PlayerData

function report(path: string, changed: boolean, extra = ''): void {
  const note = changed ? '' : ' (sem mudança)'
  console.log(`  ${relative(root, path)} · ${size(statSync(path).size)}${extra}${note}`)
}

/** Acende a moldura (tudo fora da área interna do card), misturando com branco. */
function flash(raster: Raster, scale: number): void {
  const inner = 12 * scale
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      const inside =
        x >= inner && x < raster.width - inner && y >= inner && y < raster.height - inner
      const o = (y * raster.width + x) * 4
      if (inside || raster.data[o + 3] === 0) continue
      for (let c = 0; c < 3; c++) {
        const value = raster.data[o + c] ?? 0
        raster.data[o + c] = Math.round(value + (255 - value) * 0.6)
      }
    }
  }
}

console.log('Logo:')
for (const theme of ['dark', 'light'] as ThemeName[]) {
  const svg = renderLogo(theme)
  const svgPath = join(assets, `logo-${theme}.svg`)
  report(svgPath, writeIfChanged(svgPath, svg))
  const pngPath = join(assets, `logo-${theme}.png`)
  report(pngPath, writePngIfChanged(pngPath, rasterizeSvg(svg, { scale: 2 })), ' (2×)')
}

console.log('Codorna:')
const mascot = renderMascot(8)
const mascotSvg = join(assets, 'mascot.svg')
report(mascotSvg, writeIfChanged(mascotSvg, mascot))
const mascotPng = join(assets, 'mascot.png')
report(mascotPng, writePngIfChanged(mascotPng, rasterizeSvg(mascot)))

const veterano = buildCharacter(fixture('veterano'))
console.log('Prévia social (1280×640):')
for (const [lang, file] of [
  ['pt-BR', 'social-preview.png'],
  ['en', 'social-preview-en.png'],
] as [Lang, string][]) {
  const path = join(assets, file)
  report(path, writePngIfChanged(path, rasterizeSvg(renderSocialPreview(veterano, lang))))
}

console.log('GIF do card subindo de nível:')
const GIF_SCALE = 2
const frames = levelUpFrames(buildCharacter(fixture('iniciante')), veterano).map((frame) => {
  const raster = rasterizeSvg(renderCard(frame.character, { theme: 'dark', lang: 'pt-BR' }), {
    scale: GIF_SCALE,
  })
  if (frame.flash) flash(raster, GIF_SCALE)
  return { raster, delay: frame.delay }
})
const gifPath = join(assets, 'level-up.gif')
const seconds = frames.reduce((sum, frame) => sum + frame.delay, 0) / 100
report(
  gifPath,
  writeIfChanged(gifPath, encodeGif(frames)),
  ` · ${frames.length} quadros · ${seconds.toFixed(1)} s`,
)
