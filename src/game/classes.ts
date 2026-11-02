import type { AnonymousRepo } from './types'

/** Classes, uma por família de linguagens (`adventurer` quando não há linguagem conhecida). */
export type ClassId =
  | 'blacksmith'
  | 'illusionist'
  | 'alchemist'
  | 'arcanist'
  | 'guardian'
  | 'tinkerer'
  | 'druid'
  | 'ranger'
  | 'merchant'
  | 'bard'
  | 'seer'
  | 'adventurer'

/** Uma classe: cor de destaque e as linguagens que votam nela. */
export interface ClassDef {
  id: ClassId
  /** Cor de destaque da classe (emblema, roupa do avatar e barra de XP). */
  color: string
  /** Nomes das linguagens como o GitHub (Linguist) informa. */
  languages: readonly string[]
}

/**
 * Classes e as famílias de linguagens de cada uma. A ordem também serve de desempate.
 * Nomes exibidos ficam em `src/i18n.ts`.
 */
export const CLASSES: readonly ClassDef[] = [
  {
    id: 'blacksmith',
    color: '#e8743b',
    languages: [
      'C',
      'C++',
      'Rust',
      'Zig',
      'Assembly',
      'Nim',
      'D',
      'Ada',
      'Odin',
      'C3',
      'Hare',
      'Carbon',
      'LLVM',
      'WebAssembly',
      'Cuda',
      'VHDL',
      'Verilog',
      'SystemVerilog',
      'Modula-2',
    ],
  },
  {
    id: 'illusionist',
    color: '#c45fd9',
    languages: [
      'JavaScript',
      'TypeScript',
      'HTML',
      'CSS',
      'SCSS',
      'Sass',
      'Less',
      'Stylus',
      'PostCSS',
      'Vue',
      'Svelte',
      'Astro',
      'CoffeeScript',
      'LiveScript',
      'Handlebars',
      'Pug',
      'EJS',
      'Nunjucks',
      'Mustache',
      'Marko',
      'Imba',
      'Processing',
      'GLSL',
      'HLSL',
      'ShaderLab',
      'Metal',
      'WGSL',
    ],
  },
  {
    id: 'alchemist',
    color: '#2fb5a5',
    languages: [
      'Python',
      'Jupyter Notebook',
      'R',
      'Julia',
      'MATLAB',
      'Mathematica',
      'Wolfram Language',
      'SAS',
      'Stata',
      'Cython',
      'Mojo',
      'Fortran',
      'Fortran Free Form',
      'Nextflow',
      'Scilab',
    ],
  },
  {
    id: 'arcanist',
    color: '#7b6cf0',
    languages: [
      'Haskell',
      'Elixir',
      'Erlang',
      'Clojure',
      'OCaml',
      'F#',
      'Scheme',
      'Racket',
      'Common Lisp',
      'Emacs Lisp',
      'Fennel',
      'Hy',
      'Janet',
      'Elm',
      'PureScript',
      'ReScript',
      'Reason',
      'Gleam',
      'Idris',
      'Agda',
      'Coq',
      'Rocq Prover',
      'Lean',
      'Lean 4',
      'Isabelle',
      'Standard ML',
      'Prolog',
      'Mercury',
      'Unison',
      'Koka',
      'Roc',
      'APL',
      'J',
      'BQN',
      'Uiua',
      'Futhark',
      'Dhall',
      'TLA',
      'Alloy',
    ],
  },
  {
    id: 'guardian',
    color: '#4f7fe8',
    languages: [
      'Java',
      'C#',
      'Scala',
      'Groovy',
      'Visual Basic .NET',
      'Visual Basic 6.0',
      'VBA',
      'COBOL',
      'Pascal',
      'Eiffel',
      'Ceylon',
      'Xtend',
      'PowerBuilder',
      'RPGLE',
    ],
  },
  {
    id: 'tinkerer',
    color: '#e8b53b',
    languages: [
      'Swift',
      'Objective-C',
      'Objective-C++',
      'Kotlin',
      'Dart',
      'QML',
      'OpenSCAD',
      'G-code',
      'KiCad Layout',
      'KiCad Schematic',
      'Eagle',
    ],
  },
  {
    id: 'druid',
    color: '#74b33f',
    languages: [
      'Shell',
      'PowerShell',
      'Batchfile',
      'Nushell',
      'fish',
      'Dockerfile',
      'HCL',
      'Bicep',
      'Nix',
      'Makefile',
      'CMake',
      'Meson',
      'Just',
      'Starlark',
      'Jsonnet',
      'Puppet',
      'SaltStack',
      'Jinja',
      'Nginx',
      'ApacheConf',
      'Earthly',
      'Tcl',
      'Awk',
      'Vim Script',
    ],
  },
  {
    id: 'ranger',
    color: '#3fa7c9',
    languages: ['Go', 'Templ', 'Crystal', 'V', 'Vala', 'Pony'],
  },
  {
    id: 'merchant',
    color: '#d9534f',
    languages: [
      'PHP',
      'Hack',
      'Blade',
      'Twig',
      'Latte',
      'Smarty',
      'Ruby',
      'HTML+ERB',
      'Haml',
      'Slim',
      'Liquid',
      'Perl',
      'Raku',
      'ColdFusion',
      'ABAP',
      'Apex',
      'Solidity',
      'Vyper',
      'Move',
      'Cairo',
      'Clarity',
    ],
  },
  {
    id: 'bard',
    color: '#ec6f8f',
    languages: [
      'TeX',
      'Markdown',
      'MDX',
      'reStructuredText',
      'AsciiDoc',
      'Org',
      'Roff',
      'BibTeX',
      'Typst',
      'Gettext Catalog',
      'LilyPond',
      'SuperCollider',
      'ChucK',
      'Csound',
      'Csound Document',
      'Csound Score',
      'Lua',
      'Luau',
      'MoonScript',
      'GDScript',
      'GameMaker Language',
      'Haxe',
      'Squirrel',
      'AngelScript',
      'UnrealScript',
      'Pawn',
      'SourcePawn',
      'Papyrus',
      'Ink',
      "Ren'Py",
      'mcfunction',
      'ZenScript',
    ],
  },
  {
    id: 'seer',
    color: '#a3a8c3',
    languages: [
      'SQL',
      'PLpgSQL',
      'PLSQL',
      'TSQL',
      'SQLPL',
      'Cypher',
      'SPARQL',
      'GraphQL',
      'Kusto',
      'CodeQL',
      'XQuery',
      'jq',
      'Rego',
      'LookML',
      'PowerQuery',
      'Datalog',
    ],
  },
  { id: 'adventurer', color: '#b39260', languages: [] },
]

const CLASS_BY_LANGUAGE = new Map<string, ClassId>()
for (const def of CLASSES) {
  for (const language of def.languages) CLASS_BY_LANGUAGE.set(language.toLowerCase(), def.id)
}

/** Definição de uma classe pelo id. */
export function classDef(id: ClassId): ClassDef {
  const def = CLASSES.find((entry) => entry.id === id)
  if (!def) throw new Error(`Classe desconhecida: ${id}`)
  return def
}

/** Classe de uma linguagem, ou null quando a linguagem não está mapeada. */
export function classForLanguage(language: string): ClassId | null {
  return CLASS_BY_LANGUAGE.get(language.trim().toLowerCase()) ?? null
}

/** Uma linguagem com a fatia de votos que recebeu e a classe dela. */
export interface LanguageShare {
  name: string
  color: string | null
  /** Fatia dos votos, de 0 a 1. */
  share: number
  classId: ClassId | null
}

/**
 * Cada repositório com código vale um voto, dividido entre as linguagens dele
 * na proporção do tamanho em bytes. Assim um repositório gigante não engole os outros.
 */
export function languageShares(repositories: readonly AnonymousRepo[]): LanguageShare[] {
  const votes = new Map<string, { name: string; color: string | null; votes: number }>()
  let voters = 0
  for (const repo of repositories) {
    const languages = repo.languages.filter((lang) => Number.isFinite(lang.size) && lang.size > 0)
    const total = languages.reduce((sum, lang) => sum + lang.size, 0)
    if (total <= 0) continue
    voters += 1
    for (const lang of languages) {
      const key = lang.name.toLowerCase()
      const entry = votes.get(key) ?? { name: lang.name, color: lang.color, votes: 0 }
      entry.votes += lang.size / total
      if (!entry.color && lang.color) entry.color = lang.color
      votes.set(key, entry)
    }
  }
  if (voters === 0) return []
  return [...votes.values()]
    .map((entry) => ({
      name: entry.name,
      color: entry.color,
      share: entry.votes / voters,
      classId: classForLanguage(entry.name),
    }))
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, 'en'))
}

/** A classe vencedora, com a fatia de votos e a linguagem mais votada dela. */
export interface ClassResult {
  classId: ClassId
  /** Fatia dos votos que a classe vencedora somou (0 quando não há linguagens). */
  share: number
  /** Linguagem mais votada dentro da classe vencedora. */
  language: string | null
}

/**
 * A classe vem da linguagem dominante. Linguagens da mesma família (ex.: JavaScript e
 * TypeScript) somam votos para a mesma classe; linguagens não mapeadas não votam.
 */
export function dominantClass(shares: readonly LanguageShare[]): ClassResult {
  const scores = new Map<ClassId, number>()
  for (const entry of shares) {
    if (!entry.classId) continue
    scores.set(entry.classId, (scores.get(entry.classId) ?? 0) + entry.share)
  }
  let best: ClassResult = { classId: 'adventurer', share: 0, language: null }
  for (const def of CLASSES) {
    const score = scores.get(def.id) ?? 0
    if (score > best.share + 1e-9) best = { classId: def.id, share: score, language: null }
  }
  if (best.classId !== 'adventurer') {
    best.language = shares.find((entry) => entry.classId === best.classId)?.name ?? null
  }
  return best
}
