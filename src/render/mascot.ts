/**
 * A codorna, mascote do Codorna Card: pixel art original, desenhada à mão para este projeto.
 * É uma codorna de perfil, olhando para a direita, com o topete que curva para a frente,
 * pintas creme nas costas e papo creme. A versão grande usa um headset (fone com microfone),
 * o detalhe de dev (e de quem joga).
 *
 * Papéis de cor nos desenhos:
 *   # contorno · b pena · B pena escura (asa e sombra) · l luz · c papo · C sombra do papo
 *   s pinta · e olho · w brilho do olho · k bico · p topete · P brilho do topete · f pé
 *   r bochecha · x sobrancelha · h arco e haste do headset · H concha · j brilho da concha
 */

/** Ícone 16×15 para o cabeçalho do card (desenhado em escala 2). */
export const MASCOT_ICON: readonly string[] = [
  '...........##...',
  '..........#pp#..',
  '.........#p#p#..',
  '........##p##...',
  '.......#bbbbb#..',
  '......#bbbbbbb#.',
  '......#bbbbbwb#.',
  '.##.###bbbbbeb#.',
  '#bb#bbbbbbbccck#',
  '.#bbbbbbbcccc##.',
  '#bbbBBBBBcccc#..',
  '#bbBBsBBBcccc#..',
  '.#bBBBBsBcccc#..',
  '..#bbbbbbbcc#...',
  '...#########....',
]

/** Mascote completo, 30×31, com o headset. Para o logo, a prévia social e o README. */
export const MASCOT: readonly string[] = [
  '......................##......',
  '.....................#Pp#.....',
  '.....................#ppp#....',
  '....................#p#pp#....',
  '.................####p###.....',
  '................#llhhbll#.....',
  '...............#lbhbbbbbl#....',
  '..............#lbhbbbbbbbl#...',
  '.............#lbbhbxxxbbbbl#..',
  '.............#lbHjHbbbbwebb#..',
  '.............#lbHHHbbbbeebb##.',
  '.#..........##lbHHHbbbbeebbkk#',
  '#l#........#llbbbHhbbbbcbbbk#.',
  '#Bl#...####lbbbbbbbhbccccrr#..',
  '.#BB#.#llllbbbbbbbbbhhjccC#...',
  '..#bB#lbbbbbsbbbbbbbccccC#....',
  '..#BblbBsBBBBBbbbbbbcccC#.....',
  '...#bbBBBBBBBBBbbbccccC#......',
  '..#lbBBBBBsBBBsBcccccccC#.....',
  '..#bBBsBBBBBBBBccccccccC#.....',
  '.#BbBBBBBBBBBBccccCcccCcC#....',
  '..#bbBBBsBBBsBcccccccccC#.....',
  '..#BbbBBBBBBBccccccccccC#.....',
  '...#bbbBBBBBBBccccccCcC#......',
  '...#BBbbbbbbbbcccccccCC#......',
  '....##BbbbbbbbbcccccC##.......',
  '......#BBBBbbbbbCCCC#.........',
  '.......####bBBBB####..........',
  '..........#f####f#............',
  '.........#fff##fff#...........',
  '..........###..###............',
]

/** Cores fixas da codorna (o contorno vem do tema). */
export const MASCOT_COLORS: Readonly<Record<string, string>> = {
  b: '#a8693a',
  B: '#7d4a26',
  l: '#c98c56',
  c: '#f2dfb4',
  C: '#d9bd88',
  s: '#ead2a0',
  e: '#1b1420',
  w: '#ffffff',
  k: '#f0a830',
  p: '#6b3f1f',
  P: '#9a6034',
  f: '#e8905a',
  r: '#f29a9a',
  x: '#f6e7c4',
  h: '#3b3f4c',
  H: '#8e6ae6',
  j: '#c7b5ff',
}

/** Paleta completa para desenhar a codorna com o contorno escolhido. */
export function mascotPalette(outline: string): Record<string, string> {
  return { '#': outline, ...MASCOT_COLORS }
}

/** Largura e altura de um desenho em papéis. */
export function bitmapSize(rows: readonly string[]): { width: number; height: number } {
  return { width: Math.max(0, ...rows.map((row) => row.length)), height: rows.length }
}
