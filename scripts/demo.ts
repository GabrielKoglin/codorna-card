/**
 * Gera os cards de exemplo em `examples/` (SVG e PNG) a partir das fixtures, sem chamar a API.
 * O PNG sai do rasterizador do projeto, pixel a pixel igual ao SVG; arquivo que não mudou não
 * é regravado.
 * Uso: npm run demo
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCharacter } from '../src/character'
import { formatNumber, strings } from '../src/i18n'
import { renderCard } from '../src/render/card'
import type { Lang, PlayerData, ThemeName } from '../src/types'
import { size, writeIfChanged, writePngIfChanged } from './lib/files'
import { rasterizeSvg } from './lib/raster'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const examples = join(root, 'examples')

const fixtures = ['iniciante', 'veterano'] as const
const themes: ThemeName[] = ['dark', 'light']
const langs: Lang[] = ['pt-BR', 'en']

for (const name of fixtures) {
  const data = JSON.parse(
    readFileSync(join(root, 'fixtures', `${name}.json`), 'utf8'),
  ) as PlayerData
  const character = buildCharacter(data)
  const t = strings('pt-BR')
  console.log(
    `${name}: nível ${character.level.level}, ${t.classes[character.classId]}, ` +
      `${t.ranks[character.rank]}, ${formatNumber(character.xp.total, 'pt-BR')} XP`,
  )
  for (const theme of themes) {
    for (const lang of langs) {
      const base = join(examples, `${name}-${theme}-${lang}`)
      const svg = renderCard(character, { theme, lang })
      const changed = [
        writeIfChanged(`${base}.svg`, svg),
        writePngIfChanged(`${base}.png`, rasterizeSvg(svg)),
      ]
      console.log(
        `  examples/${name}-${theme}-${lang}.svg (${size(Buffer.byteLength(svg))}) + .png ` +
          `(${size(statSync(`${base}.png`).size)})${changed.some(Boolean) ? '' : ' sem mudança'}`,
      )
    }
  }
}
