/**
 * Gera os cards de exemplo em `examples/` a partir das fixtures (sem chamar a API).
 * Uso: npm run demo
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCharacter } from '../src/game/character'
import { formatNumber, strings } from '../src/i18n'
import { renderCard } from '../src/render/card'
import type { Lang, PlayerData, ThemeName } from '../src/types'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const examples = join(root, 'examples')
mkdirSync(examples, { recursive: true })

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
      const file = `${name}-${theme}-${lang}.svg`
      const svg = renderCard(character, { theme, lang })
      writeFileSync(join(examples, file), svg)
      console.log(`  examples/${file} (${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB)`)
    }
  }
}
