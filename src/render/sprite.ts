import type { ClassId } from '../game/classes'
import { classDef } from '../game/classes'
import { seededRandom } from '../hash'
import { contrast, darken, lighten, mix, parseHex } from './color'

/**
 * Avatar 16×16 em pixel art, 100% gerado por código.
 * O hash do username escolhe a pessoa (pele, cabelo, olhos, detalhes);
 * a classe escolhe o equipamento (chapéu ou elmo, roupa e cor).
 *
 * Papéis de cor nos desenhos:
 *   K pele · H cabelo · E olho · W brilho · R bochecha · F óculos escuros
 *   C roupa · T acabamento · A couro · M metal · G chapéu · L folha · B bota · P calça · S gema/lente
 *   _ apaga o pixel
 */

export const SPRITE_SIZE = 16

type Layer = readonly string[]

const BODY: Record<'tunic' | 'robe' | 'armor', Layer> = {
  tunic: [
    '................',
    '................',
    '................',
    '....KKKKKKKK....',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '....KKKKKKKK....',
    '.....CCCCCC.....',
    '....CCCCCCCC....',
    '...KCCTTTTCCK...',
    '....CCCCCCCC....',
    '.....BB..BB.....',
  ],
  robe: [
    '................',
    '................',
    '................',
    '....KKKKKKKK....',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '....KKKKKKKK....',
    '.....CCTTCC.....',
    '....CCCTTCCC....',
    '...KCCCTTCCCK...',
    '....CCCTTCCC....',
    '....CCCTTCCC....',
  ],
  armor: [
    '................',
    '................',
    '................',
    '....KKKKKKKK....',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '...KKKKKKKKKK...',
    '....KKKKKKKK....',
    '.....MMMMMM.....',
    '...MMMMSSMMMM...',
    '...KMMMMMMMMK...',
    '....CCTTTTCC....',
    '.....BB..BB.....',
  ],
}

const HAIR: readonly Layer[] = [
  // curto
  [
    '................',
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HH......HH...',
    '...H........H...',
  ],
  // longo
  [
    '................',
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '..HHH......HHH..',
    '..HH........HH..',
    '..HH........HH..',
    '..HH........HH..',
    '..HHH......HHH..',
    '..HHH......HHH..',
    '...H........H...',
  ],
  // espetado
  [
    '................',
    '....H.H..H.H....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HHHHHHHHHH...',
    '...HH......HH...',
  ],
  // chanel com franja
  [
    '................',
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '..HHHHH..HHHHH..',
    '..HH........HH..',
    '..HH........HH..',
    '..HHH......HHH..',
  ],
  // coque
  [
    '......HHHH......',
    '......HHHH......',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HH......HH...',
    '...H........H...',
  ],
  // cacheado
  [
    '................',
    '.....H.HH.H.....',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHH......HHH..',
    '..HH........HH..',
    '..H..........H..',
  ],
]

const EYES: readonly Layer[] = [
  // olhos altos com brilho
  ['', '', '', '', '', '', '.....W....W.....', '.....E....E.....'],
  // olhos grandes com brilho
  ['', '', '', '', '', '', '.....EW..WE.....', '.....EE..EE.....'],
  // olhos felizes (^ ^)
  ['', '', '', '', '', '', '.....E....E.....', '....E.E..E.E....'],
  // olhos fechados e sobrancelha
  ['', '', '', '', '', '', '....EE....EE....', ''],
  // óculos escuros
  ['', '', '', '', '', '', '....FWFFFFWF....', '....FFF..FFF....'],
]

/** Estilos de olho que continuam legíveis em qualquer tom de pele. */
export const HIGH_CONTRAST_EYES = [1, 4]

const EXTRAS: readonly Layer[] = [
  // sorriso
  ['', '', '', '', '', '', '', '', '.......KK.......'],
  // bochechas
  ['', '', '', '', '', '', '', '', '....R......R....'],
  // bigode e cavanhaque
  ['', '', '', '', '', '', '', '', '......HHHH......', '......HHHH......'],
  // nada
  [],
]

type Headgear =
  | 'headband'
  | 'tophat'
  | 'goggles'
  | 'wizard'
  | 'helmet'
  | 'hardhat'
  | 'leaves'
  | 'hood'
  | 'widehat'
  | 'beret'
  | 'circlet'
  | 'scarf'

const HEADGEAR: Record<Headgear, Layer> = {
  headband: ['', '', '', '', '...TTTTTTTTTT...', '............T...', '............TT..'],
  tophat: [
    '.....GGGGGG.....',
    '.....GGGGGG.....',
    '.....GGGGGG.....',
    '.....TTTTTT.....',
    '...GGGGGGGGGG...',
  ],
  goggles: ['', '', '', '', '...MSSMMMMSSM...'],
  wizard: [
    '.......GG.......',
    '......GGGG......',
    '.....GGSGGG.....',
    '....GGTTTTGG....',
    '..GGGGGGGGGGGG..',
  ],
  helmet: [
    '.......TT.......',
    '.....MMMMMM.....',
    '....MMMMMMMM....',
    '...MMMMMMMMMM...',
    '...MMMMMMMMMM...',
    '...MM..MM..MM...',
    '...M........M...',
    '...M........M...',
  ],
  hardhat: [
    '................',
    '......GGGG......',
    '.....GGTTGG.....',
    '....GGGTTGGG....',
    '..GGGGGGGGGGGG..',
  ],
  leaves: ['', '', '', '....L.L..L.L....', '...LLLLLLLLLL...'],
  hood: [
    '................',
    '.....CCCCCC.....',
    '....CCCCCCCC....',
    '...CCCCCCCCCC...',
    '..CCC......CCC..',
    '..CC........CC..',
    '..CC........CC..',
    '..CC........CC..',
    '..CC........CC..',
    '..CCC......CCC..',
    '...CCC....CCC...',
  ],
  widehat: [
    '................',
    '................',
    '.....GGGGGG.....',
    '.....GTTTTG.....',
    '.GGGGGGGGGGGGGG.',
  ],
  beret: [
    '............T...',
    '...........TT...',
    '....GGGGGGGG....',
    '...GGGGGGGGGG...',
    '...TTTTTTTTTT...',
  ],
  circlet: ['', '', '', '.......SS.......', '...MMMMSSMMMM...'],
  scarf: ['', '', '', '', '', '', '', '', '', '', '....TTTTTTTT....', '.........TT.....'],
}

/** Peças extras de roupa por cima do corpo. */
const OUTFIT: Record<'apron' | 'overalls' | 'vest' | 'collar', Layer> = {
  apron: [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '......A..A......',
    '.....AAAAAA.....',
    '.....AAAAAA.....',
    '.....AAAAAA.....',
  ],
  overalls: [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '......T..T......',
    '......T..T......',
    '.....PPPPPP.....',
    '....PPPPPPPP....',
  ],
  vest: [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '....AA....AA....',
    '....AA....AA....',
    '....AA....AA....',
  ],
  collar: ['', '', '', '', '', '', '', '', '', '', '.....TTTTTT.....'],
}

interface ClassLook {
  body: keyof typeof BODY
  headgear: Headgear
  outfit?: keyof typeof OUTFIT
  /** Cor do chapéu; o padrão é a cor da classe escurecida. */
  gear?: string
}

const LOOKS: Record<ClassId, ClassLook> = {
  blacksmith: { body: 'tunic', headgear: 'headband', outfit: 'apron' },
  illusionist: { body: 'tunic', headgear: 'tophat', outfit: 'collar', gear: '#2b2533' },
  alchemist: { body: 'robe', headgear: 'goggles' },
  arcanist: { body: 'robe', headgear: 'wizard' },
  guardian: { body: 'armor', headgear: 'helmet' },
  tinkerer: { body: 'tunic', headgear: 'hardhat', outfit: 'overalls', gear: '#f2c230' },
  druid: { body: 'robe', headgear: 'leaves' },
  ranger: { body: 'tunic', headgear: 'hood' },
  merchant: { body: 'tunic', headgear: 'widehat', outfit: 'vest', gear: '#7a4f2e' },
  bard: { body: 'tunic', headgear: 'beret', outfit: 'collar' },
  seer: { body: 'robe', headgear: 'circlet' },
  adventurer: { body: 'tunic', headgear: 'scarf' },
}

export const SKIN = ['#ffe0c7', '#f2c294', '#dca36b', '#b97b4b', '#8d5634', '#603b23'] as const
export const HAIR_COLORS = [
  '#2a1d15',
  '#5b3a1e',
  '#8e5a2b',
  '#d8a941',
  '#c2452d',
  '#e6e0d4',
  '#3a5fb0',
  '#7a3fa0',
  '#2f8f5b',
  '#e07aa0',
] as const
const TRIM_COLORS = [
  '#f2d16b',
  '#efe8d6',
  '#d94f4f',
  '#4f7fe8',
  '#74b33f',
  '#f08a3c',
  '#2b2533',
  '#3fbfb0',
] as const
export const EYE_COLOR = '#1b1420'

export interface SpriteColors {
  outline: string
}

export interface Sprite {
  size: number
  /** Cor de cada pixel (null = transparente), linha a linha. */
  pixels: (string | null)[][]
}

/** Traços sorteados a partir do hash. Ficam expostos para os testes e para revisão visual. */
export interface SpriteTraits {
  skin: number
  hair: number
  hairStyle: number
  eyes: number
  extra: number
  trim: number
}

function paint(grid: (string | null)[][], layer: Layer): void {
  layer.forEach((row, y) => {
    for (let x = 0; x < row.length && x < SPRITE_SIZE; x++) {
      const role = row[x]
      if (!role || role === '.') continue
      const line = grid[y]
      if (!line) continue
      line[x] = role === '_' ? null : role
    }
  })
}

function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = parseHex(a)
  const [r2, g2, b2] = parseHex(b)
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
}

/** Sorteia os traços de forma determinística, evitando combinações ilegíveis. */
export function spriteTraits(hash: Uint8Array, classId: ClassId): SpriteTraits {
  const random = seededRandom(hash, 7)
  const index = (length: number) => Math.floor(random() * length)
  const skin = index(SKIN.length)
  let hair = index(HAIR_COLORS.length)
  const hairStyle = index(HAIR.length)
  let eyes = index(EYES.length)
  const extra = index(EXTRAS.length)
  let trim = index(TRIM_COLORS.length)
  const skinColor = SKIN[skin] ?? SKIN[0]
  // Cabelo precisa se destacar da pele.
  for (let tries = 0; tries < HAIR_COLORS.length; tries++) {
    if (contrast(HAIR_COLORS[hair] ?? '#000000', skinColor) >= 1.7) break
    hair = (hair + 1) % HAIR_COLORS.length
  }
  // Olhos sem brilho somem em pele escura.
  if (contrast(EYE_COLOR, skinColor) < 3 && !HIGH_CONTRAST_EYES.includes(eyes)) {
    eyes = HIGH_CONTRAST_EYES[eyes % HIGH_CONTRAST_EYES.length] ?? 1
  }
  // Acabamento diferente da cor da classe.
  const classColor = classDef(classId).color
  for (let tries = 0; tries < TRIM_COLORS.length; tries++) {
    if (colorDistance(TRIM_COLORS[trim] ?? '#000000', classColor) >= 150) break
    trim = (trim + 1) % TRIM_COLORS.length
  }
  return { skin, hair, hairStyle, eyes, extra, trim }
}

/** Monta o avatar a partir de traços explícitos e da classe. */
export function composeSprite(
  traits: SpriteTraits,
  classId: ClassId,
  colors: SpriteColors,
): Sprite {
  const look = LOOKS[classId]
  const classColor = classDef(classId).color
  const skin = SKIN[traits.skin % SKIN.length] ?? SKIN[0]
  const hair = HAIR_COLORS[traits.hair % HAIR_COLORS.length] ?? HAIR_COLORS[0]
  const trim = TRIM_COLORS[traits.trim % TRIM_COLORS.length] ?? TRIM_COLORS[0]

  const roles: (string | null)[][] = Array.from({ length: SPRITE_SIZE }, () =>
    Array.from({ length: SPRITE_SIZE }, () => null as string | null),
  )
  paint(roles, BODY[look.body])
  if (look.outfit) paint(roles, OUTFIT[look.outfit])
  paint(roles, HAIR[traits.hairStyle % HAIR.length] ?? [])
  paint(roles, EYES[traits.eyes % EYES.length] ?? [])
  paint(roles, EXTRAS[traits.extra % EXTRAS.length] ?? [])
  paint(roles, HEADGEAR[look.headgear])

  const gear = look.gear ?? darken(classColor, 0.3)
  const palette: Record<string, string> = {
    K: skin,
    H: hair,
    E: EYE_COLOR,
    W: '#ffffff',
    R: mix(skin, '#ff6f8a', 0.45),
    F: '#1f1d2b',
    C: classColor,
    T: trim,
    A: '#7a4a2a',
    M: '#cdd4de',
    G: gear,
    L: '#5fae3f',
    B: '#4a3426',
    P: '#3d4a63',
    S: lighten(classColor, 0.45),
  }
  const shade: Record<string, string> = {
    K: darken(skin, 0.14),
    H: darken(hair, 0.28),
    C: darken(classColor, 0.22),
    T: darken(trim, 0.2),
    A: darken('#7a4a2a', 0.25),
    M: '#8f9aab',
    G: darken(gear, 0.28),
    L: darken('#5fae3f', 0.25),
    P: darken('#3d4a63', 0.25),
  }

  const pixels: (string | null)[][] = roles.map((row, y) =>
    row.map((role, x) => {
      if (!role) return null
      const base = palette[role] ?? '#ff00ff'
      const shadow = shade[role]
      if (!shadow) return base
      // Luz vinda de cima e da esquerda: borda direita e borda de baixo de cada região na sombra.
      const right = roles[y]?.[x + 1]
      const below = roles[y + 1]?.[x]
      if (x >= SPRITE_SIZE / 2 && right !== role) return shadow
      if (role !== 'K' && below !== role) return shadow
      return base
    }),
  )

  // Contorno automático: pixel vazio encostado (4 vizinhos) em pixel cheio.
  const outlined = pixels.map((row, y) =>
    row.map((color, x) => {
      if (color) return color
      const neighbors = [pixels[y - 1]?.[x], pixels[y + 1]?.[x], row[x - 1], row[x + 1]]
      return neighbors.some(Boolean) ? colors.outline : null
    }),
  )

  return { size: SPRITE_SIZE, pixels: outlined }
}

/** Avatar de uma pessoa: o hash escolhe os traços e a classe escolhe o equipamento. */
export function buildSprite(hash: Uint8Array, classId: ClassId, colors: SpriteColors): Sprite {
  return composeSprite(spriteTraits(hash, classId), classId, colors)
}
