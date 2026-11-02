import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";
/******/ var __webpack_modules__ = ({

/***/ 730:
/***/ ((module, __unused_webpack___webpack_exports__, __nccwpck_require__) => {

__nccwpck_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony import */ var _run__WEBPACK_IMPORTED_MODULE_0__ = __nccwpck_require__(976);

process.exitCode = await (0,_run__WEBPACK_IMPORTED_MODULE_0__/* .main */ .iW)();

__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } }, 1);

/***/ }),

/***/ 976:
/***/ ((__unused_webpack_module, __webpack_exports__, __nccwpck_require__) => {


// EXPORTS
__nccwpck_require__.d(__webpack_exports__, {
  iW: () => (/* binding */ main)
});

// UNUSED EXPORTS: PROJECT_URL, run

;// CONCATENATED MODULE: external "node:fs/promises"
const promises_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:fs/promises");
;// CONCATENATED MODULE: external "node:path"
const external_node_path_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:path");
;// CONCATENATED MODULE: external "node:crypto"
const external_node_crypto_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:crypto");
;// CONCATENATED MODULE: external "node:fs"
const external_node_fs_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:fs");
;// CONCATENATED MODULE: external "node:os"
const external_node_os_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:os");
;// CONCATENATED MODULE: ./src/actions.ts



/** Escapa o texto de um comando de workflow (`::warning::` etc.). */
function escapeCommand(value) {
    return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
function consoleLogger(write = (line) => process.stdout.write(line + external_node_os_namespaceObject.EOL)) {
    return {
        info: (message) => write(message),
        warning: (message) => write(`::warning::${escapeCommand(message)}`),
        error: (message) => write(`::error::${escapeCommand(message)}`),
        async group(title, fn) {
            write(`::group::${escapeCommand(title)}`);
            try {
                return await fn();
            }
            finally {
                write('::endgroup::');
            }
        },
    };
}
/** Lê uma entrada da Action (variável `INPUT_<NOME>`). */
function getInput(env, name) {
    return (env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? '').trim();
}
/** Grava uma saída no arquivo `GITHUB_OUTPUT`. */
function setOutput(env, name, value) {
    const file = env.GITHUB_OUTPUT;
    if (!file)
        return;
    const delimiter = `ghadelimiter_${(0,external_node_crypto_namespaceObject.randomUUID)()}`;
    (0,external_node_fs_namespaceObject.appendFileSync)(file, `${name}<<${delimiter}${external_node_os_namespaceObject.EOL}${value}${external_node_os_namespaceObject.EOL}${delimiter}${external_node_os_namespaceObject.EOL}`, 'utf8');
}
/** Acrescenta markdown ao resumo do job (`GITHUB_STEP_SUMMARY`). */
function appendSummary(env, markdown) {
    const file = env.GITHUB_STEP_SUMMARY;
    if (!file)
        return;
    (0,external_node_fs_namespaceObject.appendFileSync)(file, markdown + external_node_os_namespaceObject.EOL, 'utf8');
}

;// CONCATENATED MODULE: ./src/hash.ts

/** SHA-256 do username em minúsculas: a semente fixa de tudo que é "aleatório" no card. */
function loginHash(login) {
    return new Uint8Array((0,external_node_crypto_namespaceObject.createHash)('sha256').update(login.trim().toLowerCase()).digest());
}
/** Gerador pseudoaleatório determinístico (mulberry32) a partir do hash. */
function seededRandom(seed, salt = 0) {
    let state = (((seed[0] ?? 0) << 24) | ((seed[1] ?? 0) << 16) | ((seed[2] ?? 0) << 8) | (seed[3] ?? 0)) ^
        Math.imul(salt + 1, 0x9e3779b9);
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Número da carteirinha da guilda, ex.: "4F2A-91C3". */
function guildNumber(hash) {
    const hex = [...hash.slice(-4)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 4)}-${hex.slice(4)}`.toUpperCase();
}

;// CONCATENATED MODULE: ./src/game/attributes.ts
/** Ordem de exibição no card (duas colunas, de cima para baixo). */
const ATTRIBUTES = [
    { id: 'str', reference: 20_000, curve: 0.4, color: '#e4574c' },
    { id: 'int', reference: 12, curve: 1, color: '#4b8fe0' },
    { id: 'dex', reference: 2_000, curve: 0.4, color: '#4fb06a' },
    { id: 'wis', reference: 2_000, curve: 0.4, color: '#9d74e8' },
    { id: 'con', reference: 3_650, curve: 0.4, color: '#e98b2f' },
    { id: 'cha', reference: 2_000, curve: 0.4, color: '#e06a9f' },
];
/** Tamanho mínimo (bytes de código) para um repositório contar em INT. */
const MIN_REPO_BYTES = 1024;
/** Converte uma quantidade em atributo de 1 a 99. */
function attributeValue(amount, reference, curve = 0.4) {
    if (!Number.isFinite(amount) || amount <= 0)
        return 1;
    const value = Math.round(99 * Math.min(1, amount / reference) ** curve);
    return Math.min(99, Math.max(1, value));
}
/**
 * Linguagens principais diferentes: em cada repositório (com pelo menos 1 KB de código)
 * a linguagem com mais bytes é a principal, como o GitHub mostra na página do repositório.
 */
function mainLanguages(repositories) {
    const found = new Map();
    for (const repo of repositories) {
        const languages = repo.languages.filter((lang) => Number.isFinite(lang.size) && lang.size > 0);
        const total = languages.reduce((sum, lang) => sum + lang.size, 0);
        if (total < MIN_REPO_BYTES)
            continue;
        const main = languages.reduce((best, lang) => (lang.size > best.size ? lang : best));
        found.set(main.name.toLowerCase(), main.name);
    }
    return [...found.values()];
}
/** Quantidade bruta que alimenta cada atributo. */
function attributeSources(activity, repositories) {
    return {
        str: activity.commits.counted,
        dex: activity.merged.counted,
        con: activity.commits.activeDays,
        int: mainLanguages(repositories).length,
        wis: activity.reviews.counted,
        cha: activity.issues.counted + 2 * activity.mergedElsewhere.counted,
    };
}
function computeAttributes(activity, repositories) {
    const sources = attributeSources(activity, repositories);
    const result = {};
    for (const def of ATTRIBUTES) {
        result[def.id] = attributeValue(sources[def.id], def.reference, def.curve);
    }
    return result;
}

;// CONCATENATED MODULE: ./src/game/classes.ts
/**
 * Classes e as famílias de linguagens de cada uma. A ordem também serve de desempate.
 * Nomes exibidos ficam em `src/i18n.ts`.
 */
const CLASSES = [
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
];
const CLASS_BY_LANGUAGE = new Map();
for (const def of CLASSES) {
    for (const language of def.languages)
        CLASS_BY_LANGUAGE.set(language.toLowerCase(), def.id);
}
function classDef(id) {
    const def = CLASSES.find((entry) => entry.id === id);
    if (!def)
        throw new Error(`Classe desconhecida: ${id}`);
    return def;
}
/** Classe de uma linguagem, ou null quando a linguagem não está mapeada. */
function classForLanguage(language) {
    return CLASS_BY_LANGUAGE.get(language.trim().toLowerCase()) ?? null;
}
/**
 * Cada repositório com código vale um voto, dividido entre as linguagens dele
 * na proporção do tamanho em bytes. Assim um repositório gigante não engole os outros.
 */
function languageShares(repositories) {
    const votes = new Map();
    let voters = 0;
    for (const repo of repositories) {
        const languages = repo.languages.filter((lang) => Number.isFinite(lang.size) && lang.size > 0);
        const total = languages.reduce((sum, lang) => sum + lang.size, 0);
        if (total <= 0)
            continue;
        voters += 1;
        for (const lang of languages) {
            const key = lang.name.toLowerCase();
            const entry = votes.get(key) ?? { name: lang.name, color: lang.color, votes: 0 };
            entry.votes += lang.size / total;
            if (!entry.color && lang.color)
                entry.color = lang.color;
            votes.set(key, entry);
        }
    }
    if (voters === 0)
        return [];
    return [...votes.values()]
        .map((entry) => ({
        name: entry.name,
        color: entry.color,
        share: entry.votes / voters,
        classId: classForLanguage(entry.name),
    }))
        .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, 'en'));
}
/**
 * A classe vem da linguagem dominante. Linguagens da mesma família (ex.: JavaScript e
 * TypeScript) somam votos para a mesma classe; linguagens não mapeadas não votam.
 */
function dominantClass(shares) {
    const scores = new Map();
    for (const entry of shares) {
        if (!entry.classId)
            continue;
        scores.set(entry.classId, (scores.get(entry.classId) ?? 0) + entry.share);
    }
    let best = { classId: 'adventurer', share: 0, language: null };
    for (const def of CLASSES) {
        const score = scores.get(def.id) ?? 0;
        if (score > best.share + 1e-9)
            best = { classId: def.id, share: score, language: null };
    }
    if (best.classId !== 'adventurer') {
        best.language = shares.find((entry) => entry.classId === best.classId)?.name ?? null;
    }
    return best;
}

;// CONCATENATED MODULE: ./src/game/rules.ts
/**
 * Tabela de XP. Toda mudança aqui precisa ser refletida em `docs/regras.md`.
 * Os tetos existem para que volume artificial (farm) não vire nível.
 */
const XP_RULES = {
    /** Cada commit vale 2 XP, mas só os 10 primeiros de cada dia contam. */
    commit: { xp: 2, dailyCap: 10 },
    /** Cada issue aberta vale 4 XP, até 150 por ano. */
    issue: { xp: 4, yearlyCap: 150 },
    /** Cada PR aberto vale 5 XP, até 250 por ano. */
    pullRequest: { xp: 5, yearlyCap: 250 },
    /** Cada PR revisado vale 8 XP, até 250 por ano. */
    review: { xp: 8, yearlyCap: 250 },
    /** Cada PR mesclado vale +10 XP (nunca mais PRs mesclados do que PRs abertos contados). */
    mergedPullRequest: { xp: 10 },
    /** Bônus de +10 XP quando o PR mesclado é no repositório de outra pessoa. */
    mergedElsewhereBonus: { xp: 10 },
};
/** Nível máximo. */
const MAX_LEVEL = 99;
/** XP total para chegar ao nível N = LEVEL_FACTOR × (N − 1)². */
const LEVEL_FACTOR = 50;
/** Patentes por faixa de nível (a moldura do card muda de material em cada uma). */
const RANKS = [
    { id: 'recruit', minLevel: 1 },
    { id: 'apprentice', minLevel: 5 },
    { id: 'veteran', minLevel: 15 },
    { id: 'master', minLevel: 30 },
    { id: 'legend', minLevel: 50 },
    { id: 'mythic', minLevel: 75 },
];
function whole(n) {
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
/** Aplica o teto diário de commits. */
function summarizeCommits(commitsByDay, dailyCap = XP_RULES.commit.dailyCap) {
    const summary = { raw: 0, counted: 0, activeDays: 0, cappedDays: 0 };
    for (const value of Object.values(commitsByDay)) {
        const commits = whole(value);
        if (commits === 0)
            continue;
        summary.raw += commits;
        summary.counted += Math.min(commits, dailyCap);
        summary.activeDays += 1;
        if (commits > dailyCap)
            summary.cappedDays += 1;
    }
    return summary;
}
/** Junta a atividade de todos os anos aplicando os tetos de cada tipo. */
function countActivity(data) {
    const commitsByDay = {};
    const issues = { raw: 0, counted: 0 };
    const pullRequests = { raw: 0, counted: 0 };
    const reviews = { raw: 0, counted: 0 };
    for (const year of data.years) {
        for (const [day, value] of Object.entries(year.commitsByDay)) {
            commitsByDay[day] = (commitsByDay[day] ?? 0) + whole(value);
        }
        const yearIssues = whole(year.issues);
        const yearPullRequests = whole(year.pullRequests);
        const yearReviews = whole(year.reviews);
        issues.raw += yearIssues;
        issues.counted += Math.min(yearIssues, XP_RULES.issue.yearlyCap);
        pullRequests.raw += yearPullRequests;
        pullRequests.counted += Math.min(yearPullRequests, XP_RULES.pullRequest.yearlyCap);
        reviews.raw += yearReviews;
        reviews.counted += Math.min(yearReviews, XP_RULES.review.yearlyCap);
    }
    const mergedRaw = whole(data.mergedPullRequests);
    const mergedCounted = Math.min(mergedRaw, pullRequests.counted);
    const elsewhereRaw = Math.min(whole(data.mergedPullRequestsElsewhere), mergedRaw);
    return {
        commits: summarizeCommits(commitsByDay),
        issues,
        pullRequests,
        reviews,
        merged: { raw: mergedRaw, counted: mergedCounted },
        mergedElsewhere: { raw: elsewhereRaw, counted: Math.min(elsewhereRaw, mergedCounted) },
    };
}
function computeXp(activity) {
    const commits = activity.commits.counted * XP_RULES.commit.xp;
    const issues = activity.issues.counted * XP_RULES.issue.xp;
    const pullRequests = activity.pullRequests.counted * XP_RULES.pullRequest.xp;
    const reviews = activity.reviews.counted * XP_RULES.review.xp;
    const merged = activity.merged.counted * XP_RULES.mergedPullRequest.xp;
    const mergedElsewhere = activity.mergedElsewhere.counted * XP_RULES.mergedElsewhereBonus.xp;
    return {
        commits,
        issues,
        pullRequests,
        reviews,
        merged,
        mergedElsewhere,
        total: commits + issues + pullRequests + reviews + merged + mergedElsewhere,
    };
}
/** XP total necessário para chegar a um nível. */
function xpForLevel(level) {
    const clamped = Math.min(Math.max(Math.floor(level), 1), MAX_LEVEL);
    return LEVEL_FACTOR * (clamped - 1) ** 2;
}
function levelForXp(xp) {
    const total = whole(xp);
    let level = Math.min(MAX_LEVEL, Math.floor(1 + Math.sqrt(total / LEVEL_FACTOR)));
    // Corrige possíveis erros de arredondamento da raiz quadrada.
    while (level < MAX_LEVEL && xpForLevel(level + 1) <= total)
        level += 1;
    while (level > 1 && xpForLevel(level) > total)
        level -= 1;
    return level;
}
function levelProgress(xp) {
    const total = whole(xp);
    const level = levelForXp(total);
    const levelStart = xpForLevel(level);
    if (level >= MAX_LEVEL) {
        return { level, xp: total, levelStart, nextLevel: null, progress: 1 };
    }
    const nextLevel = xpForLevel(level + 1);
    return {
        level,
        xp: total,
        levelStart,
        nextLevel,
        progress: (total - levelStart) / (nextLevel - levelStart),
    };
}
function rankForLevel(level) {
    let rank = 'recruit';
    for (const entry of RANKS) {
        if (level >= entry.minLevel)
            rank = entry.id;
    }
    return rank;
}

;// CONCATENATED MODULE: ./src/game/character.ts




function buildCharacter(data) {
    const activity = countActivity(data);
    const xp = computeXp(activity);
    const level = levelProgress(xp.total);
    const languages = languageShares(data.repositories);
    const dominant = dominantClass(languages);
    const hash = loginHash(data.login);
    const created = new Date(data.createdAt);
    return {
        login: data.login,
        memberSince: Number.isNaN(created.getTime())
            ? new Date().getUTCFullYear()
            : created.getUTCFullYear(),
        guildNumber: guildNumber(hash),
        hash,
        activity,
        xp,
        level,
        rank: rankForLevel(level.level),
        classId: dominant.classId,
        classLanguage: dominant.language,
        languages,
        attributes: computeAttributes(activity, data.repositories),
    };
}

;// CONCATENATED MODULE: ./src/i18n.ts
/** Separa milhares do jeito de cada idioma (12.345 / 12,345), sem depender do ICU. */
function formatNumber(value, lang) {
    const separator = lang === 'pt-BR' ? '.' : ',';
    const digits = String(Math.max(0, Math.round(value)));
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
function formatPercent(share) {
    const percent = share * 100;
    if (percent > 0 && percent < 1)
        return '<1%';
    return `${Math.round(percent)}%`;
}
function utcTime(date) {
    return date.toISOString().slice(11, 16);
}
const PT_BR = {
    card: {
        header: 'GUILD CARD',
        level: 'NÍVEL',
        xp: 'XP',
        since: (year) => `desde ${year}`,
        noLanguages: 'nenhuma linguagem pública ainda',
        percent: formatPercent,
        toNext: (xp) => `faltam ${xp}`,
        maxLevel: 'nível máximo!',
        stats: {
            commits: (n) => (n === 1 ? 'commit' : 'commits'),
            merged: (n) => (n === 1 ? 'PR mesclado' : 'PRs mesclados'),
            mergedShort: (n) => (n === 1 ? 'PR' : 'PRs'),
            reviews: (n) => (n === 1 ? 'review' : 'reviews'),
            issues: (n) => (n === 1 ? 'issue' : 'issues'),
        },
    },
    attributes: {
        str: { short: 'FOR', name: 'Força' },
        dex: { short: 'DES', name: 'Destreza' },
        con: { short: 'CON', name: 'Constituição' },
        int: { short: 'INT', name: 'Inteligência' },
        wis: { short: 'SAB', name: 'Sabedoria' },
        cha: { short: 'CAR', name: 'Carisma' },
    },
    classes: {
        blacksmith: 'Ferreiro',
        illusionist: 'Ilusionista',
        alchemist: 'Alquimista',
        arcanist: 'Arcanista',
        guardian: 'Guardião',
        tinkerer: 'Inventor',
        druid: 'Druida',
        ranger: 'Patrulheiro',
        merchant: 'Mercador',
        bard: 'Bardo',
        seer: 'Vidente',
        adventurer: 'Aventureiro',
    },
    ranks: {
        recruit: 'Recruta',
        apprentice: 'Aprendiz',
        veteran: 'Veterano',
        master: 'Mestre',
        legend: 'Lenda',
        mythic: 'Mítico',
    },
    a11y: {
        title: (login) => `Guild Card de @${login}`,
        desc: (info) => `Nível ${info.level} (${info.rank}), classe ${info.className}, ${info.xp} XP. ` +
            `Atributos: ${info.attributes}. Linguagens: ${info.languages}. ${info.stats}.`,
    },
    commitMessage: 'Atualiza o Guild Card',
    log: {
        fetching: (login) => `Buscando a atividade pública de @${login}…`,
        years: (count, from, to) => `Lendo ${count} ${count === 1 ? 'ano' : 'anos'} de contribuições (${from}–${to})…`,
        quarters: (year) => `${year}: muitos dias de commit num mesmo repositório, lendo por trimestre.`,
        repositories: (count) => `${count} repositório(s) próprio(s) e público(s) analisado(s).`,
        repositoriesTruncated: (limit) => `Mais de ${limit} repositórios: só os ${limit} com push mais recente entram na classe.`,
        tooManyRepositories: (period) => `${period}: mais de 100 repositórios com atividade; os menos ativos ficaram de fora.`,
        rateLimitLow: (remaining, resetAt) => `Atenção: restam ${remaining} pontos de API até ${utcTime(resetAt)} UTC.`,
        retrying: (attempt, seconds) => `Tentando de novo (tentativa ${attempt}) em ${seconds}s…`,
        result: (level, className, xp) => `Nível ${level} · ${className} · ${xp} XP`,
        wrote: (path) => `Card salvo em ${path}`,
        committed: (sha, branch) => `Commit ${sha.slice(0, 7)} enviado para ${branch}.`,
        unchanged: 'O card não mudou; nada para comitar.',
        commitDisabled: 'commit: false, então o card não foi comitado.',
        notOnBranch: (ref) => `O workflow não está rodando numa branch (${ref || 'ref vazia'}); o card foi gerado mas não foi comitado.`,
        noRepository: 'GITHUB_REPOSITORY está vazio; o card foi gerado mas não foi comitado.',
    },
    errors: {
        missingToken: 'Nenhum token foi informado. Use a entrada `token` (o padrão é o GITHUB_TOKEN do workflow).',
        invalidUsername: (value) => `Username inválido: "${value}". Use o login do GitHub (letras, números e hífens).`,
        invalidTheme: (value) => `Tema inválido: "${value}". Use dark, light ou both.`,
        invalidLang: (value) => `Idioma inválido: "${value}". Use pt-BR ou en.`,
        invalidOutput: (value) => `Saída inválida: "${value}". Use um caminho relativo dentro do repositório, terminado em .svg.`,
        invalidBoolean: (name, value) => `Valor inválido em ${name}: "${value}". Use true ou false.`,
        userNotFound: (login) => `Usuário "${login}" não encontrado no GitHub.`,
        isOrganization: (login) => `"${login}" é uma organização. O Guild Card é de pessoas: informe o seu login em \`username\`.`,
        badCredentials: 'O GitHub recusou o token (401). Confira se ele existe e se não expirou.',
        forbidden: (detail) => `O GitHub negou o acesso (403): ${detail}`,
        rateLimited: (resetAt) => resetAt
            ? `Limite de requisições da API do GitHub esgotado. Ele renova às ${utcTime(resetAt)} UTC; rode de novo depois disso.`
            : 'Limite de requisições da API do GitHub esgotado. Rode de novo daqui a uma hora.',
        secondaryRateLimit: 'O GitHub pediu para diminuir o ritmo (limite secundário). Rode de novo em alguns minutos.',
        timeout: 'A API do GitHub demorou demais para responder, mesmo depois de novas tentativas.',
        network: (detail) => `Falha de rede ao falar com a API do GitHub: ${detail}`,
        api: (status, detail) => `A API do GitHub respondeu com erro ${status}: ${detail}`,
        graphql: (detail) => `A API GraphQL do GitHub respondeu com erro: ${detail}`,
        noWritePermission: 'Sem permissão para comitar. Adicione `permissions: contents: write` ao workflow (ou use `commit: false`).',
        emptyRepository: 'O repositório está vazio. Faça um primeiro commit (um README já serve) e rode de novo.',
        branchNotFound: (branch) => `Branch "${branch}" não encontrada no repositório.`,
        protectedBranch: (branch) => `A branch "${branch}" está protegida e recusou o commit. Libere o github-actions[bot] nas regras da branch ou use \`commit: false\`.`,
        unexpected: (detail) => `Erro inesperado: ${detail}`,
    },
    summary: {
        title: (login) => `Guild Card de @${login}`,
        level: 'Nível',
        className: 'Classe',
        rank: 'Patente',
        xp: 'XP',
        source: 'Fonte',
        counted: 'Conta para XP',
        rawLabel: 'Total público',
        rows: {
            commits: 'Commits (até 10 por dia)',
            issues: 'Issues (até 150 por ano)',
            pullRequests: 'PRs abertos (até 250 por ano)',
            reviews: 'Reviews de PR (até 250 por ano)',
            merged: 'PRs mesclados',
            mergedElsewhere: 'Bônus: mesclados em repositórios de outras pessoas',
        },
        files: 'Arquivos',
        rules: 'Regras completas',
    },
};
const EN = {
    card: {
        header: 'GUILD CARD',
        level: 'LEVEL',
        xp: 'XP',
        since: (year) => `since ${year}`,
        noLanguages: 'no public languages yet',
        percent: formatPercent,
        toNext: (xp) => `${xp} to go`,
        maxLevel: 'max level!',
        stats: {
            commits: (n) => (n === 1 ? 'commit' : 'commits'),
            merged: (n) => (n === 1 ? 'merged PR' : 'merged PRs'),
            mergedShort: (n) => (n === 1 ? 'PR' : 'PRs'),
            reviews: (n) => (n === 1 ? 'review' : 'reviews'),
            issues: (n) => (n === 1 ? 'issue' : 'issues'),
        },
    },
    attributes: {
        str: { short: 'STR', name: 'Strength' },
        dex: { short: 'DEX', name: 'Dexterity' },
        con: { short: 'CON', name: 'Constitution' },
        int: { short: 'INT', name: 'Intelligence' },
        wis: { short: 'WIS', name: 'Wisdom' },
        cha: { short: 'CHA', name: 'Charisma' },
    },
    classes: {
        blacksmith: 'Blacksmith',
        illusionist: 'Illusionist',
        alchemist: 'Alchemist',
        arcanist: 'Arcanist',
        guardian: 'Guardian',
        tinkerer: 'Tinkerer',
        druid: 'Druid',
        ranger: 'Ranger',
        merchant: 'Merchant',
        bard: 'Bard',
        seer: 'Seer',
        adventurer: 'Adventurer',
    },
    ranks: {
        recruit: 'Recruit',
        apprentice: 'Apprentice',
        veteran: 'Veteran',
        master: 'Master',
        legend: 'Legend',
        mythic: 'Mythic',
    },
    a11y: {
        title: (login) => `Guild Card of @${login}`,
        desc: (info) => `Level ${info.level} (${info.rank}), ${info.className} class, ${info.xp} XP. ` +
            `Attributes: ${info.attributes}. Languages: ${info.languages}. ${info.stats}.`,
    },
    commitMessage: 'Update Guild Card',
    log: {
        fetching: (login) => `Fetching public activity for @${login}…`,
        years: (count, from, to) => `Reading ${count} ${count === 1 ? 'year' : 'years'} of contributions (${from}–${to})…`,
        quarters: (year) => `${year}: many commit days in a single repository, reading by quarter.`,
        repositories: (count) => `${count} owned public repositories analyzed.`,
        repositoriesTruncated: (limit) => `More than ${limit} repositories: only the ${limit} most recently pushed count for the class.`,
        tooManyRepositories: (period) => `${period}: more than 100 repositories with activity; the least active were left out.`,
        rateLimitLow: (remaining, resetAt) => `Heads up: ${remaining} API points left until ${utcTime(resetAt)} UTC.`,
        retrying: (attempt, seconds) => `Retrying (attempt ${attempt}) in ${seconds}s…`,
        result: (level, className, xp) => `Level ${level} · ${className} · ${xp} XP`,
        wrote: (path) => `Card saved to ${path}`,
        committed: (sha, branch) => `Commit ${sha.slice(0, 7)} pushed to ${branch}.`,
        unchanged: 'The card did not change; nothing to commit.',
        commitDisabled: 'commit: false, so the card was not committed.',
        notOnBranch: (ref) => `The workflow is not running on a branch (${ref || 'empty ref'}); the card was generated but not committed.`,
        noRepository: 'GITHUB_REPOSITORY is empty; the card was generated but not committed.',
    },
    errors: {
        missingToken: 'No token provided. Set the `token` input (it defaults to the workflow GITHUB_TOKEN).',
        invalidUsername: (value) => `Invalid username: "${value}". Use a GitHub login (letters, numbers and hyphens).`,
        invalidTheme: (value) => `Invalid theme: "${value}". Use dark, light or both.`,
        invalidLang: (value) => `Invalid language: "${value}". Use pt-BR or en.`,
        invalidOutput: (value) => `Invalid output: "${value}". Use a relative path inside the repository ending in .svg.`,
        invalidBoolean: (name, value) => `Invalid value for ${name}: "${value}". Use true or false.`,
        userNotFound: (login) => `User "${login}" was not found on GitHub.`,
        isOrganization: (login) => `"${login}" is an organization. Guild Cards are for people: set your login in \`username\`.`,
        badCredentials: 'GitHub rejected the token (401). Check that it exists and has not expired.',
        forbidden: (detail) => `GitHub denied access (403): ${detail}`,
        rateLimited: (resetAt) => resetAt
            ? `GitHub API rate limit exhausted. It resets at ${utcTime(resetAt)} UTC; run again after that.`
            : 'GitHub API rate limit exhausted. Run again in an hour.',
        secondaryRateLimit: 'GitHub asked us to slow down (secondary rate limit). Run again in a few minutes.',
        timeout: 'The GitHub API took too long to answer, even after retrying.',
        network: (detail) => `Network error while talking to the GitHub API: ${detail}`,
        api: (status, detail) => `The GitHub API answered with error ${status}: ${detail}`,
        graphql: (detail) => `The GitHub GraphQL API answered with an error: ${detail}`,
        noWritePermission: 'No permission to commit. Add `permissions: contents: write` to the workflow (or use `commit: false`).',
        emptyRepository: 'The repository is empty. Make a first commit (a README is enough) and run again.',
        branchNotFound: (branch) => `Branch "${branch}" was not found in the repository.`,
        protectedBranch: (branch) => `Branch "${branch}" is protected and rejected the commit. Allow github-actions[bot] in the branch rules or use \`commit: false\`.`,
        unexpected: (detail) => `Unexpected error: ${detail}`,
    },
    summary: {
        title: (login) => `Guild Card of @${login}`,
        level: 'Level',
        className: 'Class',
        rank: 'Rank',
        xp: 'XP',
        source: 'Source',
        counted: 'Counts for XP',
        rawLabel: 'Public total',
        rows: {
            commits: 'Commits (up to 10 per day)',
            issues: 'Issues (up to 150 per year)',
            pullRequests: 'Opened PRs (up to 250 per year)',
            reviews: 'PR reviews (up to 250 per year)',
            merged: 'Merged PRs',
            mergedElsewhere: "Bonus: merged in other people's repositories",
        },
        files: 'Files',
        rules: 'Full rules',
    },
};
function strings(lang) {
    return lang === 'pt-BR' ? PT_BR : EN;
}

;// CONCATENATED MODULE: ./src/github/errors.ts
/** Erro com mensagem pronta para mostrar a quem usa a Action. */
class GuildCardError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'GuildCardError';
    }
}

;// CONCATENATED MODULE: ./src/github/client.ts


/** Mínimo de pontos de API antes de avisar nos logs. */
const LOW_RATE_LIMIT = 100;
/** Espera máxima aceita num `retry-after` antes de desistir (segundos). */
const MAX_RETRY_AFTER = 120;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
function defaultSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function messageFrom(body) {
    try {
        const parsed = JSON.parse(body);
        if (typeof parsed.message === 'string' && parsed.message)
            return parsed.message;
    }
    catch {
        // corpo não é JSON
    }
    return body.trim().slice(0, 200) || 'sem detalhes';
}
function resetFrom(headers) {
    const reset = Number(headers.get('x-ratelimit-reset'));
    return Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : null;
}
/** Cliente mínimo da API do GitHub (GraphQL e REST) com novas tentativas e erros claros. */
class GitHubClient {
    lang;
    rateLimit = null;
    token;
    apiUrl;
    graphqlUrl;
    fetchImpl;
    sleep;
    log;
    warn;
    maxRetries;
    timeoutMs;
    warnedLowLimit = false;
    constructor(options) {
        const t = strings(options.lang);
        if (!options.token)
            throw new GuildCardError('input', t.errors.missingToken);
        this.token = options.token;
        this.lang = options.lang;
        this.apiUrl = (options.apiUrl || 'https://api.github.com').replace(/\/+$/, '');
        this.graphqlUrl = options.graphqlUrl || `${this.apiUrl}/graphql`;
        this.fetchImpl = options.fetch ?? fetch;
        this.sleep = options.sleep ?? defaultSleep;
        this.log = options.log ?? (() => { });
        this.warn = options.warn ?? this.log;
        this.maxRetries = options.maxRetries ?? 3;
        this.timeoutMs = options.timeoutMs ?? 30_000;
    }
    get t() {
        return strings(this.lang);
    }
    async wait(attempt, seconds) {
        const delay = seconds ?? 2 ** (attempt - 1);
        this.log(this.t.log.retrying(attempt + 1, delay));
        await this.sleep(delay * 1000);
    }
    /** Faz a requisição, repetindo falhas temporárias. Erros de limite viram GuildCardError. */
    async request(url, init) {
        for (let attempt = 1;; attempt++) {
            let response;
            let body;
            try {
                response = await this.fetchImpl(url, {
                    ...init,
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        'User-Agent': 'guild-card-action',
                        ...init.headers,
                    },
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
                body = await response.text();
            }
            catch (error) {
                if (attempt <= this.maxRetries) {
                    await this.wait(attempt);
                    continue;
                }
                const name = error instanceof Error ? error.name : '';
                if (name === 'TimeoutError' || name === 'AbortError') {
                    throw new GuildCardError('timeout', this.t.errors.timeout);
                }
                const detail = error instanceof Error ? error.message : String(error);
                throw new GuildCardError('network', this.t.errors.network(detail));
            }
            if (RETRYABLE_STATUS.has(response.status) && attempt <= this.maxRetries) {
                await this.wait(attempt);
                continue;
            }
            if (response.status === 401)
                throw new GuildCardError('auth', this.t.errors.badCredentials);
            if (response.status === 403 || response.status === 429) {
                if (response.headers.get('x-ratelimit-remaining') === '0') {
                    throw new GuildCardError('rate-limit', this.t.errors.rateLimited(resetFrom(response.headers)));
                }
                const retryAfter = Number(response.headers.get('retry-after'));
                const secondary = /secondary rate limit|abuse/i.test(body) ||
                    (Number.isFinite(retryAfter) && retryAfter > 0);
                if (secondary) {
                    const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
                    if (attempt <= this.maxRetries && seconds <= MAX_RETRY_AFTER) {
                        await this.wait(attempt, seconds);
                        continue;
                    }
                    throw new GuildCardError('secondary-rate-limit', this.t.errors.secondaryRateLimit);
                }
            }
            return { status: response.status, headers: response.headers, body };
        }
    }
    /** Consulta GraphQL. Erros parciais viram exceção (com tipo NOT_FOUND identificado). */
    async graphql(query, variables) {
        for (let attempt = 1;; attempt++) {
            const response = await this.request(this.graphqlUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables }),
            });
            if (response.status === 403) {
                throw new GuildCardError('forbidden', this.t.errors.forbidden(messageFrom(response.body)));
            }
            if (response.status >= 400) {
                throw new GuildCardError('api', this.t.errors.api(response.status, messageFrom(response.body)));
            }
            let payload;
            try {
                payload = JSON.parse(response.body);
            }
            catch {
                throw new GuildCardError('api', this.t.errors.api(response.status, messageFrom(response.body)));
            }
            const errors = payload.errors ?? [];
            if (errors.length > 0) {
                if (errors.some((error) => error.type === 'RATE_LIMITED')) {
                    throw new GuildCardError('rate-limit', this.t.errors.rateLimited(resetFrom(response.headers)));
                }
                const notFound = errors.find((error) => error.type === 'NOT_FOUND');
                if (notFound) {
                    throw new GuildCardError('not-found', this.t.errors.graphql(notFound.message ?? 'NOT_FOUND'));
                }
                const detail = errors.map((error) => error.message ?? error.type ?? '?').join('; ');
                // O GitHub às vezes responde "Something went wrong" quando a consulta demora; vale repetir.
                const transient = /something went wrong|timeout|timed out/i.test(detail);
                if (transient && attempt <= this.maxRetries) {
                    await this.wait(attempt);
                    continue;
                }
                throw new GuildCardError(transient ? 'timeout' : 'graphql', this.t.errors.graphql(detail));
            }
            if (!payload.data)
                throw new GuildCardError('graphql', this.t.errors.graphql('resposta sem dados'));
            this.trackRateLimit(payload.data.rateLimit);
            return payload.data;
        }
    }
    trackRateLimit(info) {
        if (!info)
            return;
        this.rateLimit = { remaining: info.remaining, resetAt: new Date(info.resetAt) };
        if (info.remaining < LOW_RATE_LIMIT && !this.warnedLowLimit) {
            this.warnedLowLimit = true;
            this.warn(this.t.log.rateLimitLow(info.remaining, this.rateLimit.resetAt));
        }
    }
    /** Chamada REST. Devolve status e JSON; quem chama decide o que cada status significa. */
    async rest(method, path, body) {
        const response = await this.request(`${this.apiUrl}${path}`, {
            method,
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        let data;
        try {
            data = response.body ? JSON.parse(response.body) : null;
        }
        catch {
            data = null;
        }
        return { status: response.status, data, message: messageFrom(response.body) };
    }
}

;// CONCATENATED MODULE: ./src/github/queries.ts
/**
 * Consultas GraphQL. Tudo é filtrado para dados públicos: repositórios com
 * `isPrivate` são descartados mesmo que o token consiga enxergá-los.
 */
const PROFILE_QUERY = /* GraphQL */ `
  query GuildProfile($login: String!, $merged: String!, $mergedElsewhere: String!) {
    rateLimit {
      remaining
      resetAt
    }
    owner: repositoryOwner(login: $login) {
      __typename
      login
      ... on User {
        createdAt
      }
    }
    merged: search(type: ISSUE, query: $merged, first: 1) {
      issueCount
    }
    mergedElsewhere: search(type: ISSUE, query: $mergedElsewhere, first: 1) {
      issueCount
    }
  }
`;
const REPOSITORIES_QUERY = /* GraphQL */ `
  query GuildRepositories($login: String!, $cursor: String) {
    rateLimit {
      remaining
      resetAt
    }
    user(login: $login) {
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: OWNER
        isFork: false
        privacy: PUBLIC
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          isPrivate
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;
const COMMIT_DAYS_FRAGMENT = /* GraphQL */ `
  fragment GuildCommitDays on ContributionsCollection {
    commitContributionsByRepository(maxRepositories: 100) {
      repository {
        isPrivate
      }
      contributions(first: 100) {
        totalCount
        nodes {
          occurredAt
          commitCount
        }
      }
    }
  }
`;
const YEAR_QUERY = /* GraphQL */ `
  query GuildYear($login: String!, $from: DateTime!, $to: DateTime!) {
    rateLimit {
      remaining
      resetAt
    }
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        ...GuildCommitDays
        issueContributionsByRepository(maxRepositories: 100) {
          repository {
            isPrivate
          }
          contributions(first: 1) {
            totalCount
          }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          repository {
            isPrivate
          }
          contributions(first: 1) {
            totalCount
          }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository {
            isPrivate
          }
          contributions(first: 1) {
            totalCount
          }
        }
      }
    }
  }
  ${COMMIT_DAYS_FRAGMENT}
`;
/** Consulta só de commits, com uma janela por trimestre (no máximo 92 dias por repositório). */
function quartersQuery(count) {
    const variables = Array.from({ length: count }, (_, i) => `$from${i}: DateTime!, $to${i}: DateTime!`);
    const windows = Array.from({ length: count }, (_, i) => `q${i}: contributionsCollection(from: $from${i}, to: $to${i}) { ...GuildCommitDays }`);
    return `
  query GuildQuarters($login: String!, ${variables.join(', ')}) {
    rateLimit {
      remaining
      resetAt
    }
    user(login: $login) {
      ${windows.join('\n      ')}
    }
  }
  ${COMMIT_DAYS_FRAGMENT}
`;
}

;// CONCATENATED MODULE: ./src/github/collect.ts



/** Limite de repositórios por período que a API devolve em cada lista. */
const MAX_REPOSITORIES = 100;
/** Janelas de um ano do calendário (UTC), cortadas na criação da conta e em `now`. */
function yearWindows(createdAt, now) {
    const windows = [];
    for (let year = createdAt.getUTCFullYear(); year <= now.getUTCFullYear(); year++) {
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
        const from = start < createdAt ? createdAt : start;
        const to = end > now ? now : end;
        if (from <= to)
            windows.push({ year, from, to });
    }
    return windows;
}
/** Divide uma janela anual em trimestres (cada um com no máximo 92 dias). */
function quarterWindows(window) {
    const year = window.from.getUTCFullYear();
    const result = [];
    for (let quarter = 0; quarter < 4; quarter++) {
        const start = new Date(Date.UTC(year, quarter * 3, 1));
        const end = new Date(Date.UTC(year, quarter * 3 + 3, 0, 23, 59, 59));
        const from = start < window.from ? window.from : start;
        const to = end > window.to ? window.to : end;
        if (from <= to)
            result.push({ from, to });
    }
    return result;
}
/** Soma commits públicos por dia. O dia vem da data de `occurredAt`. */
function commitDays(entries) {
    const days = {};
    let incomplete = false;
    for (const entry of entries) {
        if (!entry.repository || entry.repository.isPrivate)
            continue;
        const nodes = (entry.contributions.nodes ?? []).filter((node) => node !== null);
        if (entry.contributions.totalCount > nodes.length)
            incomplete = true;
        for (const node of nodes) {
            const day = node.occurredAt.slice(0, 10);
            days[day] = (days[day] ?? 0) + Math.max(0, node.commitCount);
        }
    }
    return { days, incomplete, hitLimit: entries.length >= MAX_REPOSITORIES };
}
/** Soma contribuições de repositórios públicos. */
function publicCount(entries) {
    return entries.reduce((sum, entry) => entry.repository && !entry.repository.isPrivate ? sum + entry.contributions.totalCount : sum, 0);
}
function sortDays(days) {
    return Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)));
}
function periodLabel(window) {
    return `${window.from.toISOString().slice(0, 10)}..${window.to.toISOString().slice(0, 10)}`;
}
async function collectRepositories(options, login) {
    const t = strings(options.lang);
    const maxPages = options.maxRepositoryPages ?? 10;
    const repositories = [];
    let cursor = null;
    for (let page = 0; page < maxPages; page++) {
        const data = await options.client.graphql(REPOSITORIES_QUERY, { login, cursor });
        const connection = data.user?.repositories;
        if (!connection)
            break;
        for (const node of connection.nodes) {
            if (!node || node.isPrivate)
                continue;
            repositories.push({
                name: node.name,
                languages: (node.languages?.edges ?? [])
                    .filter((edge) => edge !== null)
                    .map((edge) => ({ name: edge.node.name, color: edge.node.color, size: edge.size })),
            });
        }
        if (!connection.pageInfo.hasNextPage)
            return repositories;
        cursor = connection.pageInfo.endCursor;
    }
    if (cursor)
        options.warn?.(t.log.repositoriesTruncated(maxPages * 100));
    return repositories;
}
async function collectYear(options, login, window) {
    const t = strings(options.lang);
    const data = await options.client.graphql(YEAR_QUERY, {
        login,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
    });
    const collection = data.user?.contributionsCollection;
    if (!collection)
        throw new GuildCardError('not-found', t.errors.userNotFound(login));
    let commits = commitDays(collection.commitContributionsByRepository);
    if (commits.incomplete) {
        // Algum repositório teve mais de 100 dias de commit no ano: relê por trimestre.
        options.log?.(t.log.quarters(window.year));
        const quarters = quarterWindows(window);
        const variables = { login };
        quarters.forEach((quarter, i) => {
            variables[`from${i}`] = quarter.from.toISOString();
            variables[`to${i}`] = quarter.to.toISOString();
        });
        const result = await options.client.graphql(quartersQuery(quarters.length), variables);
        const days = {};
        let hitLimit = false;
        quarters.forEach((quarter, i) => {
            const part = commitDays(result.user?.[`q${i}`]?.commitContributionsByRepository ?? []);
            for (const [day, count] of Object.entries(part.days))
                days[day] = (days[day] ?? 0) + count;
            if (part.hitLimit) {
                hitLimit = true;
                options.warn?.(t.log.tooManyRepositories(periodLabel(quarter)));
            }
        });
        commits = { days, incomplete: false, hitLimit };
    }
    else if (commits.hitLimit) {
        options.warn?.(t.log.tooManyRepositories(periodLabel(window)));
    }
    for (const list of [
        collection.issueContributionsByRepository,
        collection.pullRequestContributionsByRepository,
        collection.pullRequestReviewContributionsByRepository,
    ]) {
        if (list.length >= MAX_REPOSITORIES)
            options.warn?.(t.log.tooManyRepositories(periodLabel(window)));
    }
    return {
        year: window.year,
        commitsByDay: sortDays(commits.days),
        issues: publicCount(collection.issueContributionsByRepository),
        pullRequests: publicCount(collection.pullRequestContributionsByRepository),
        reviews: publicCount(collection.pullRequestReviewContributionsByRepository),
    };
}
/** Lê toda a atividade pública de uma pessoa pela API GraphQL. */
async function collectPlayer(options) {
    const t = strings(options.lang);
    const now = options.now ?? new Date();
    options.log?.(t.log.fetching(options.login));
    let profile;
    try {
        profile = await options.client.graphql(PROFILE_QUERY, {
            login: options.login,
            merged: `is:pr is:merged is:public author:${options.login}`,
            mergedElsewhere: `is:pr is:merged is:public author:${options.login} -user:${options.login}`,
        });
    }
    catch (error) {
        if (error instanceof GuildCardError && error.code === 'not-found') {
            throw new GuildCardError('not-found', t.errors.userNotFound(options.login));
        }
        throw error;
    }
    const owner = profile.owner;
    if (!owner)
        throw new GuildCardError('not-found', t.errors.userNotFound(options.login));
    if (owner.__typename !== 'User' || !owner.createdAt) {
        throw new GuildCardError('not-user', t.errors.isOrganization(owner.login));
    }
    const login = owner.login;
    const createdAt = new Date(owner.createdAt);
    const repositories = await collectRepositories(options, login);
    options.log?.(t.log.repositories(repositories.length));
    const windows = yearWindows(createdAt, now);
    const first = windows[0];
    const last = windows[windows.length - 1];
    if (first && last)
        options.log?.(t.log.years(windows.length, first.year, last.year));
    const years = [];
    for (const window of windows)
        years.push(await collectYear(options, login, window));
    return {
        login,
        createdAt: owner.createdAt,
        years,
        mergedPullRequests: profile.merged.issueCount,
        mergedPullRequestsElsewhere: profile.mergedElsewhere.issueCount,
        repositories,
    };
}

;// CONCATENATED MODULE: ./src/github/commit.ts



/**
 * Autor fixo do commit: o bot do GitHub Actions. Assim o commit diário do card
 * nunca conta como contribuição da pessoa, mesmo quando o token é pessoal.
 */
const BOT_AUTHOR = {
    name: 'github-actions[bot]',
    email: '41898282+github-actions[bot]@users.noreply.github.com',
};
/** SHA-1 de blob do git, para saber se o arquivo mudou sem baixar o conteúdo. */
function gitBlobSha(content) {
    const bytes = Buffer.from(content, 'utf8');
    return (0,external_node_crypto_namespaceObject.createHash)('sha1')
        .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`, 'utf8'), bytes]))
        .digest('hex');
}
function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
}
/**
 * Comita os arquivos com a API Git Data (um commit só, mesmo com dois temas).
 * Não precisa de `actions/checkout`. Pula o commit quando nada mudou.
 */
async function commitFiles(options, attempt = 1) {
    const t = strings(options.lang);
    const { client, owner, repo, branch } = options;
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const fail = (status, message, writing) => {
        if (status === 409 || /repository is empty/i.test(message)) {
            throw new GuildCardError('empty-repository', t.errors.emptyRepository);
        }
        if (/protected branch|branch protection|rule violations|repository rule/i.test(message)) {
            throw new GuildCardError('protected-branch', t.errors.protectedBranch(branch));
        }
        if (status === 403 || (writing && status === 404)) {
            throw new GuildCardError('permission', t.errors.noWritePermission);
        }
        throw new GuildCardError('api', t.errors.api(status, message));
    };
    const ref = await client.rest('GET', `${base}/git/ref/heads/${encodePath(branch)}`);
    if (ref.status === 404)
        throw new GuildCardError('branch', t.errors.branchNotFound(branch));
    if (ref.status !== 200 || !ref.data)
        fail(ref.status, ref.message, false);
    const parentSha = ref.data?.object.sha ?? '';
    const changed = [];
    for (const file of options.files) {
        const current = await client.rest('GET', `${base}/contents/${encodePath(file.path)}?ref=${encodeURIComponent(parentSha)}`);
        if (current.status === 404) {
            changed.push(file);
            continue;
        }
        if (current.status !== 200 || !current.data)
            fail(current.status, current.message, false);
        const existing = Array.isArray(current.data) ? null : current.data;
        if (!existing || existing.sha !== gitBlobSha(file.content))
            changed.push(file);
    }
    if (changed.length === 0)
        return { committed: false, sha: null };
    const parent = await client.rest('GET', `${base}/git/commits/${parentSha}`);
    if (parent.status !== 200 || !parent.data)
        fail(parent.status, parent.message, false);
    const tree = await client.rest('POST', `${base}/git/trees`, {
        base_tree: parent.data?.tree.sha,
        tree: changed.map((file) => ({
            path: file.path,
            mode: '100644',
            type: 'blob',
            content: file.content,
        })),
    });
    if (tree.status !== 201 || !tree.data)
        fail(tree.status, tree.message, true);
    const commit = await client.rest('POST', `${base}/git/commits`, {
        message: options.message,
        tree: tree.data?.sha,
        parents: [parentSha],
        author: BOT_AUTHOR,
    });
    if (commit.status !== 201 || !commit.data)
        fail(commit.status, commit.message, true);
    const sha = commit.data?.sha ?? '';
    const update = await client.rest('PATCH', `${base}/git/refs/heads/${encodePath(branch)}`, {
        sha,
        force: false,
    });
    if (update.status === 200)
        return { committed: true, sha };
    // Alguém comitou no meio do caminho: refaz uma vez em cima do commit novo.
    if (update.status === 422 && /fast.?forward/i.test(update.message) && attempt < 2) {
        return commitFiles(options, attempt + 1);
    }
    return fail(update.status, update.message, true);
}

;// CONCATENATED MODULE: ./src/inputs.ts




const LOGIN_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
function parseLang(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === '' || normalized.startsWith('pt'))
        return 'pt-BR';
    if (normalized.startsWith('en'))
        return 'en';
    return null;
}
function parseBoolean(value) {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'on', '1'].includes(normalized))
        return true;
    if (['false', 'no', 'off', '0'].includes(normalized))
        return false;
    return null;
}
/** Normaliza e valida o caminho de saída (relativo, dentro do repositório, terminado em .svg). */
function normalizeOutput(value) {
    const raw = (value || 'guild-card.svg').trim().replace(/\\/g, '/');
    if (raw.startsWith('/') || /^[a-z]:/i.test(raw))
        return null;
    const normalized = external_node_path_namespaceObject.posix.normalize(raw).replace(/^\.\//, '');
    if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../'))
        return null;
    if (!/\.svg$/i.test(normalized) || normalized === '.svg' || normalized.endsWith('/.svg'))
        return null;
    if (normalized.split('/').some((part) => part === '.git'))
        return null;
    return normalized;
}
/** Arquivos que serão gerados: um por tema (`both` gera `-dark` e `-light`). */
function outputFiles(output, theme) {
    if (theme !== 'both')
        return [{ theme, path: output }];
    const base = output.replace(/\.svg$/i, '');
    return [
        { theme: 'dark', path: `${base}-dark.svg` },
        { theme: 'light', path: `${base}-light.svg` },
    ];
}
/** Lê e valida as entradas. Mensagens de erro saem no idioma escolhido. */
function readInputs(env) {
    const langInput = getInput(env, 'lang');
    const lang = parseLang(langInput);
    if (!lang) {
        throw new GuildCardError('input', `${strings('pt-BR').errors.invalidLang(langInput)} / ${strings('en').errors.invalidLang(langInput)}`);
    }
    const t = strings(lang);
    const username = getInput(env, 'username') || (env.GITHUB_REPOSITORY_OWNER ?? '').trim();
    if (!LOGIN_PATTERN.test(username))
        throw new GuildCardError('input', t.errors.invalidUsername(username));
    const token = getInput(env, 'token');
    if (!token)
        throw new GuildCardError('input', t.errors.missingToken);
    const outputInput = getInput(env, 'output');
    const output = normalizeOutput(outputInput);
    if (!output)
        throw new GuildCardError('input', t.errors.invalidOutput(outputInput));
    const themeInput = getInput(env, 'theme').toLowerCase() || 'dark';
    if (themeInput !== 'dark' && themeInput !== 'light' && themeInput !== 'both') {
        throw new GuildCardError('input', t.errors.invalidTheme(themeInput));
    }
    const commitInput = getInput(env, 'commit');
    const commit = commitInput === '' ? true : parseBoolean(commitInput);
    if (commit === null)
        throw new GuildCardError('input', t.errors.invalidBoolean('commit', commitInput));
    return { username, token, output, theme: themeInput, lang, commit };
}

;// CONCATENATED MODULE: ./src/render/color.ts
/** Utilitários de cor (hex #rrggbb). */
function clampByte(value) {
    return Math.min(255, Math.max(0, Math.round(value)));
}
function parseHex(hex) {
    const clean = hex.replace('#', '');
    const full = clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(full))
        throw new Error(`cor inválida: ${hex}`);
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ];
}
function toHex([r, g, b]) {
    return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`;
}
/** Mistura duas cores: amount 0 = a, 1 = b. */
function mix(a, b, amount) {
    const ca = parseHex(a);
    const cb = parseHex(b);
    return toHex([
        ca[0] + (cb[0] - ca[0]) * amount,
        ca[1] + (cb[1] - ca[1]) * amount,
        ca[2] + (cb[2] - ca[2]) * amount,
    ]);
}
const darken = (color, amount) => mix(color, '#000000', amount);
const lighten = (color, amount) => mix(color, '#ffffff', amount);
function channel(value) {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
/** Luminância relativa (WCAG 2.x). */
function luminance(color) {
    const [r, g, b] = parseHex(color);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
/** Razão de contraste (WCAG 2.x), de 1 a 21. */
function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/**
 * Escurece (ou clareia) a cor até atingir o contraste mínimo com o fundo.
 * Usado para que a cor da classe também sirva como cor de texto nos dois temas.
 */
function ensureContrast(color, background, minimum) {
    if (contrast(color, background) >= minimum)
        return color;
    const target = luminance(background) > 0.5 ? '#000000' : '#ffffff';
    for (let step = 1; step <= 20; step++) {
        const candidate = mix(color, target, step / 20);
        if (contrast(candidate, background) >= minimum)
            return candidate;
    }
    return target;
}

;// CONCATENATED MODULE: ./src/render/pixels.ts
/**
 * Cobre um conjunto de pixels com poucos retângulos (guloso: estende para a direita
 * e depois para baixo). Deixa o SVG bem menor do que um retângulo por pixel.
 */
function coverPixels(pixels) {
    const filled = new Set();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pixels) {
        filled.add(`${x},${y}`);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }
    const used = new Set();
    const free = (x, y) => filled.has(`${x},${y}`) && !used.has(`${x},${y}`);
    const rects = [];
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (!free(x, y))
                continue;
            let w = 1;
            while (free(x + w, y))
                w++;
            let h = 1;
            grow: while (y + h <= maxY) {
                for (let dx = 0; dx < w; dx++)
                    if (!free(x + dx, y + h))
                        break grow;
                h++;
            }
            for (let dy = 0; dy < h; dy++)
                for (let dx = 0; dx < w; dx++)
                    used.add(`${x + dx},${y + dy}`);
            rects.push({ x, y, w, h });
        }
    }
    return rects;
}
/** Converte retângulos em um atributo `d` de path, com escala e deslocamento inteiros. */
function rectsToPath(rects, scale = 1, offsetX = 0, offsetY = 0) {
    return rects
        .map((r) => {
        const x = offsetX + r.x * scale;
        const y = offsetY + r.y * scale;
        const w = r.w * scale;
        return `M${x} ${y}h${w}v${r.h * scale}h-${w}z`;
    })
        .join('');
}
function pixelPath(pixels, scale = 1, offsetX = 0, offsetY = 0) {
    return rectsToPath(coverPixels(pixels), scale, offsetX, offsetY);
}
/** Lê um desenho em texto ('#' = pixel aceso) e devolve as coordenadas acesas. */
function parseBitmap(rows, on = '#') {
    const pixels = [];
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++)
            if (row[x] === on)
                pixels.push([x, y]);
    });
    return pixels;
}

;// CONCATENATED MODULE: ./src/render/font.ts

const G = {
    ' ': { rows: [], width: 3 },
    A: { rows: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'] },
    B: { rows: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'] },
    C: { rows: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'] },
    D: { rows: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'] },
    E: { rows: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'] },
    F: { rows: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'] },
    G: { rows: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'] },
    H: { rows: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'] },
    I: { rows: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'] },
    J: { rows: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'] },
    K: { rows: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'] },
    L: { rows: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'] },
    M: { rows: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'] },
    N: { rows: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'] },
    O: { rows: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'] },
    P: { rows: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'] },
    Q: { rows: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'] },
    R: { rows: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'] },
    S: { rows: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'] },
    T: { rows: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'] },
    U: { rows: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'] },
    V: { rows: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'] },
    W: { rows: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'] },
    X: { rows: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'] },
    Y: { rows: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'] },
    Z: { rows: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'] },
    a: { y: 2, rows: ['.###.', '....#', '.####', '#...#', '.####'] },
    b: { rows: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'] },
    c: { y: 2, rows: ['.####', '#....', '#....', '#....', '.####'] },
    d: { rows: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'] },
    e: { y: 2, rows: ['.###.', '#...#', '#####', '#....', '.####'] },
    f: { rows: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'] },
    g: { y: 2, rows: ['.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'] },
    h: { rows: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'] },
    i: { rows: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'] },
    ı: { y: 2, rows: ['##.', '.#.', '.#.', '.#.', '###'] },
    j: { rows: ['...#', '....', '..##', '...#', '...#', '...#', '...#', '#..#', '.##.'] },
    k: { rows: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'] },
    l: { rows: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'] },
    m: { y: 2, rows: ['##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'] },
    n: { y: 2, rows: ['####.', '#...#', '#...#', '#...#', '#...#'] },
    o: { y: 2, rows: ['.###.', '#...#', '#...#', '#...#', '.###.'] },
    p: { y: 2, rows: ['####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'] },
    q: { y: 2, rows: ['.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'] },
    r: { y: 2, rows: ['#.##', '##..', '#...', '#...', '#...'] },
    s: { y: 2, rows: ['.####', '#....', '.###.', '....#', '####.'] },
    t: { rows: ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'] },
    u: { y: 2, rows: ['#...#', '#...#', '#...#', '#...#', '.####'] },
    v: { y: 2, rows: ['#...#', '#...#', '#...#', '.#.#.', '..#..'] },
    w: { y: 2, rows: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'] },
    x: { y: 2, rows: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] },
    y: { y: 2, rows: ['#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'] },
    z: { y: 2, rows: ['#####', '...#.', '..#..', '.#...', '#####'] },
    '0': { rows: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'] },
    '1': { rows: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'] },
    '2': { rows: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'] },
    '3': { rows: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'] },
    '4': { rows: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'] },
    '5': { rows: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'] },
    '6': { rows: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'] },
    '7': { rows: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'] },
    '8': { rows: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'] },
    '9': { rows: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'] },
    '.': { y: 6, rows: ['#'] },
    ',': { y: 6, rows: ['.#', '#.'] },
    ':': { y: 2, rows: ['#', '.', '.', '.', '#'] },
    ';': { y: 2, rows: ['.#', '..', '..', '.#', '#.'] },
    '-': { y: 3, rows: ['###'] },
    _: { y: 6, rows: ['#####'] },
    '+': { y: 1, rows: ['..#..', '..#..', '#####', '..#..', '..#..'] },
    '=': { y: 2, rows: ['#####', '.....', '#####'] },
    '#': { rows: ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'] },
    '/': { rows: ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'] },
    '%': { rows: ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'] },
    '<': { rows: ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'] },
    '>': { rows: ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'] },
    "'": { rows: ['#', '#'] },
    '"': { rows: ['#.#', '#.#'] },
    '!': { rows: ['#', '#', '#', '#', '#', '.', '#'] },
    '?': { rows: ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'] },
    '(': { rows: ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'] },
    ')': { rows: ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'] },
    '[': { rows: ['###', '#..', '#..', '#..', '#..', '#..', '###'] },
    ']': { rows: ['###', '..#', '..#', '..#', '..#', '..#', '###'] },
    '|': { rows: ['#', '#', '#', '#', '#', '#', '#'] },
    '*': { y: 1, rows: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'] },
    '&': { rows: ['.##..', '#..#.', '.##..', '.#...', '#.#.#', '#..#.', '.##.#'] },
    '@': { rows: ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.####'] },
    '·': { y: 3, rows: ['#'] },
    '…': { y: 6, rows: ['#.#.#'] },
};
/** Diacríticos combinantes (NFD). `below` desenha embaixo da letra. */
const MARKS = {
    '̀': { rows: ['#.', '.#'] },
    '́': { rows: ['.#', '#.'] },
    '̂': { rows: ['.#.', '#.#'] },
    '̃': { rows: ['.#.#', '#.#.'] },
    '̈': { rows: ['#.#'] },
    '̊': { rows: ['.#.', '#.#', '.#.'] },
    '̧': { rows: ['.#.', '##.'], below: true },
};
const LETTER_SPACING = 1;
const FALLBACK = '?';
const cache = new Map();
function glyphId(char) {
    return `g${[...char].map((c) => (c.codePointAt(0) ?? 63).toString(16)).join('-')}`;
}
function baseGlyph(char) {
    const def = G[char];
    if (!def)
        return null;
    const pixels = parseBitmap(def.rows).map(([x, y]) => [x, y + (def.y ?? 0)]);
    return { id: glyphId(char), width: def.width ?? def.rows[0]?.length ?? 0, pixels };
}
function composedGlyph(char) {
    const [base, ...marks] = [...char.normalize('NFD')];
    if (!base || marks.length === 0 || !marks.every((mark) => MARKS[mark]))
        return null;
    const baseDef = G[base === 'i' ? 'ı' : base];
    if (!baseDef)
        return null;
    const pixels = parseBitmap(baseDef.rows).map(([x, y]) => [
        x,
        y + (baseDef.y ?? 0),
    ]);
    const width = baseDef.rows[0]?.length ?? 0;
    const top = baseDef.y ?? 0;
    const bottom = top + baseDef.rows.length;
    let above = top - 1;
    for (const mark of marks) {
        const markDef = MARKS[mark];
        if (!markDef)
            return null;
        const markWidth = markDef.rows[0]?.length ?? 0;
        const offsetX = Math.floor((width - markWidth) / 2);
        const offsetY = markDef.below ? bottom : above - markDef.rows.length;
        for (const [x, y] of parseBitmap(markDef.rows))
            pixels.push([x + offsetX, y + offsetY]);
        if (!markDef.below)
            above -= markDef.rows.length + 1;
    }
    return { id: glyphId(char), width, pixels };
}
/** Glifo de um caractere (com acentos compostos e "?" quando não há desenho). */
function glyph(char) {
    const cached = cache.get(char);
    if (cached)
        return cached;
    const found = baseGlyph(char) ?? composedGlyph(char) ?? baseGlyph(FALLBACK);
    if (!found)
        throw new Error('fonte sem glifo de fallback');
    cache.set(char, found);
    return found;
}
/** Divide o texto em caracteres visíveis (pares acentuados viram um caractere só). */
function characters(text) {
    return [...text.normalize('NFC')].filter((char) => char !== '\n' && char !== '\r');
}
/** Largura do texto em pixels da fonte (sem escala). */
function measure(text) {
    const chars = characters(text);
    if (chars.length === 0)
        return 0;
    return (chars.reduce((sum, char) => sum + glyph(char).width, 0) + LETTER_SPACING * (chars.length - 1));
}
/** Corta o texto com reticências até caber na largura (em pixels da fonte). */
function truncate(text, maxWidth) {
    if (measure(text) <= maxWidth)
        return text;
    const chars = characters(text);
    while (chars.length > 0 && measure(`${chars.join('')}…`) > maxWidth)
        chars.pop();
    return chars.length > 0 ? `${chars.join('').trimEnd()}…` : '';
}
/** Caminho do glifo em coordenadas da fonte (1 unidade = 1 pixel). */
function glyphPath(g) {
    return pixelPath(g.pixels);
}

;// CONCATENATED MODULE: ./src/render/icons.ts
/**
 * Emblemas 9×9 das classes, desenhados à mão para este projeto.
 * Papéis: # contorno · a cor da classe · b brilho · c madeira · d metal
 */
const EMBLEMS = {
    blacksmith: [
        '.#######.',
        '#abbaaaa#',
        '#aaaaaaa#',
        '.###c###.',
        '...#c#...',
        '...#c#...',
        '...#c#...',
        '...#c#...',
        '...###...',
    ],
    illusionist: [
        '....#....',
        '...#b#...',
        '...#a#...',
        '.##aba##.',
        '#babbbab#',
        '.##aba##.',
        '...#a#...',
        '...#b#...',
        '....#....',
    ],
    alchemist: [
        '..#####..',
        '...#b#...',
        '...#b#...',
        '..#bbb#..',
        '.#bbbbb#.',
        '#aaaaaaa#',
        '#abaaaaa#',
        '#aaaaaaa#',
        '.#######.',
    ],
    arcanist: [
        '...###...',
        '..#bba#..',
        '.#baaaa#.',
        '.#aaaaa#.',
        '..#aaa#..',
        '...###...',
        '...#c#...',
        '...#c#...',
        '..#####..',
    ],
    guardian: [
        '#########',
        '#aaaaaaa#',
        '#aaabaaa#',
        '#abbbbba#',
        '#aaabaaa#',
        '#aaabaaa#',
        '.#aaaaa#.',
        '..#aaa#..',
        '...###...',
    ],
    tinkerer: [
        '...###...',
        '.#.#a#.#.',
        '#a#aaa#a#',
        '.#aa#aa#.',
        '#aa#b#aa#',
        '.#aa#aa#.',
        '#a#aaa#a#',
        '.#.#a#.#.',
        '...###...',
    ],
    druid: [
        '.....####',
        '...##aab#',
        '..#aaab.#',
        '.#aaab.a#',
        '#aaab.a#.',
        '#aab.a#..',
        '#ab.a#...',
        '.#b##....',
        '#b#......',
    ],
    ranger: [
        '....#####',
        '.....#bb#',
        '....#aab#',
        '...#a#ab#',
        '..#a#.###',
        '.#a#.....',
        '#ca#.....',
        '#cc#.....',
        '####.....',
    ],
    merchant: [
        '..#####..',
        '.#aaaaa#.',
        '#aabbbaa#',
        '#abaaaba#',
        '#abaaaba#',
        '#abaaaba#',
        '#aabbbaa#',
        '.#aaaaa#.',
        '..#####..',
    ],
    bard: [
        '....####.',
        '....#aa##',
        '....#a#a#',
        '....#a#.#',
        '....#a#..',
        '.####a#..',
        '#aaaaa#..',
        '#abaa#...',
        '.####....',
    ],
    seer: [
        '.........',
        '...###...',
        '..#bbb#..',
        '.#baaab#.',
        '#bba#abb#',
        '.#baaab#.',
        '..#bbb#..',
        '...###...',
        '.........',
    ],
    adventurer: [
        '......###',
        '.....#bb#',
        '....#bb#.',
        '...#bb#..',
        '#.#bb#...',
        '##bb#....',
        '.#c##....',
        '#c#.#....',
        '##.......',
    ],
};
const EMBLEM_SIZE = 9;

;// CONCATENATED MODULE: ./src/render/sprite.ts



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
const SPRITE_SIZE = 16;
const BODY = {
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
};
const HAIR = [
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
];
const EYES = [
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
];
/** Estilos de olho que continuam legíveis em qualquer tom de pele. */
const HIGH_CONTRAST_EYES = [1, 4];
const EXTRAS = [
    // sorriso
    ['', '', '', '', '', '', '', '', '.......KK.......'],
    // bochechas
    ['', '', '', '', '', '', '', '', '....R......R....'],
    // barba
    ['', '', '', '', '', '', '', '', '...H..HHHH..H...', '....HHHHHHHH....'],
    // nada
    [],
];
const HEADGEAR = {
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
};
/** Peças extras de roupa por cima do corpo. */
const OUTFIT = {
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
};
const LOOKS = {
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
};
const SKIN = ['#ffe0c7', '#f2c294', '#dca36b', '#b97b4b', '#8d5634', '#603b23'];
const HAIR_COLORS = [
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
];
const TRIM_COLORS = [
    '#f2d16b',
    '#efe8d6',
    '#d94f4f',
    '#4f7fe8',
    '#74b33f',
    '#f08a3c',
    '#2b2533',
    '#3fbfb0',
];
const EYE_COLOR = '#1b1420';
function paint(grid, layer) {
    layer.forEach((row, y) => {
        for (let x = 0; x < row.length && x < SPRITE_SIZE; x++) {
            const role = row[x];
            if (!role || role === '.')
                continue;
            const line = grid[y];
            if (!line)
                continue;
            line[x] = role === '_' ? null : role;
        }
    });
}
function colorDistance(a, b) {
    const [r1, g1, b1] = parseHex(a);
    const [r2, g2, b2] = parseHex(b);
    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}
/** Sorteia os traços de forma determinística, evitando combinações ilegíveis. */
function spriteTraits(hash, classId) {
    const random = seededRandom(hash, 7);
    const index = (length) => Math.floor(random() * length);
    const skin = index(SKIN.length);
    let hair = index(HAIR_COLORS.length);
    const hairStyle = index(HAIR.length);
    let eyes = index(EYES.length);
    const extra = index(EXTRAS.length);
    let trim = index(TRIM_COLORS.length);
    const skinColor = SKIN[skin] ?? SKIN[0];
    // Cabelo precisa se destacar da pele.
    for (let tries = 0; tries < HAIR_COLORS.length; tries++) {
        if (contrast(HAIR_COLORS[hair] ?? '#000000', skinColor) >= 1.7)
            break;
        hair = (hair + 1) % HAIR_COLORS.length;
    }
    // Olhos sem brilho somem em pele escura.
    if (contrast(EYE_COLOR, skinColor) < 3 && !HIGH_CONTRAST_EYES.includes(eyes)) {
        eyes = HIGH_CONTRAST_EYES[eyes % HIGH_CONTRAST_EYES.length] ?? 1;
    }
    // Acabamento diferente da cor da classe.
    const classColor = classDef(classId).color;
    for (let tries = 0; tries < TRIM_COLORS.length; tries++) {
        if (colorDistance(TRIM_COLORS[trim] ?? '#000000', classColor) >= 150)
            break;
        trim = (trim + 1) % TRIM_COLORS.length;
    }
    return { skin, hair, hairStyle, eyes, extra, trim };
}
/** Monta o avatar a partir de traços explícitos e da classe. */
function composeSprite(traits, classId, colors) {
    const look = LOOKS[classId];
    const classColor = classDef(classId).color;
    const skin = SKIN[traits.skin % SKIN.length] ?? SKIN[0];
    const hair = HAIR_COLORS[traits.hair % HAIR_COLORS.length] ?? HAIR_COLORS[0];
    const trim = TRIM_COLORS[traits.trim % TRIM_COLORS.length] ?? TRIM_COLORS[0];
    const roles = Array.from({ length: SPRITE_SIZE }, () => Array.from({ length: SPRITE_SIZE }, () => null));
    paint(roles, BODY[look.body]);
    if (look.outfit)
        paint(roles, OUTFIT[look.outfit]);
    paint(roles, HAIR[traits.hairStyle % HAIR.length] ?? []);
    paint(roles, EYES[traits.eyes % EYES.length] ?? []);
    paint(roles, EXTRAS[traits.extra % EXTRAS.length] ?? []);
    paint(roles, HEADGEAR[look.headgear]);
    const gear = look.gear ?? darken(classColor, 0.3);
    const palette = {
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
    };
    const shade = {
        K: darken(skin, 0.14),
        H: darken(hair, 0.28),
        C: darken(classColor, 0.22),
        T: darken(trim, 0.2),
        A: darken('#7a4a2a', 0.25),
        M: '#8f9aab',
        G: darken(gear, 0.28),
        L: darken('#5fae3f', 0.25),
        P: darken('#3d4a63', 0.25),
    };
    const pixels = roles.map((row, y) => row.map((role, x) => {
        if (!role)
            return null;
        const base = palette[role] ?? '#ff00ff';
        const shadow = shade[role];
        if (!shadow)
            return base;
        // Luz vinda de cima e da esquerda: borda direita e borda de baixo de cada região na sombra.
        const right = roles[y]?.[x + 1];
        const below = roles[y + 1]?.[x];
        if (x >= SPRITE_SIZE / 2 && right !== role)
            return shadow;
        if (role !== 'K' && below !== role)
            return shadow;
        return base;
    }));
    // Contorno automático: pixel vazio encostado (4 vizinhos) em pixel cheio.
    const outlined = pixels.map((row, y) => row.map((color, x) => {
        if (color)
            return color;
        const neighbors = [pixels[y - 1]?.[x], pixels[y + 1]?.[x], row[x - 1], row[x + 1]];
        return neighbors.some(Boolean) ? colors.outline : null;
    }));
    return { size: SPRITE_SIZE, pixels: outlined };
}
/** Avatar de uma pessoa: o hash escolhe os traços e a classe escolhe o equipamento. */
function buildSprite(hash, classId, colors) {
    return composeSprite(spriteTraits(hash, classId), classId, colors);
}

;// CONCATENATED MODULE: ./src/render/theme.ts
const THEMES = {
    dark: {
        name: 'dark',
        outline: '#07090d',
        background: '#151a24',
        panel: '#1d2431',
        panelEdge: '#2d3647',
        text: '#f3ecda',
        muted: '#a9b1c2',
        track: '#2a3242',
        portrait: '#202838',
        floor: '#0e1219',
    },
    light: {
        name: 'light',
        outline: '#3a2a1c',
        background: '#f7f0de',
        panel: '#eee3c6',
        panelEdge: '#d8c9a3',
        text: '#2a1f16',
        muted: '#65543e',
        track: '#e2d5b4',
        portrait: '#efe6cd',
        floor: '#d3c39b',
    },
};
const RANK_METALS = {
    recruit: { base: '#8b5a3c', light: '#b47c55', dark: '#5c3923', gem: '#e0b98f' },
    apprentice: { base: '#b8733a', light: '#e29a5c', dark: '#7a4a22', gem: '#f6cb98' },
    veteran: { base: '#a9b3c2', light: '#e3e8ef', dark: '#6c7787', gem: '#f6f8fc' },
    master: { base: '#d9a521', light: '#f7d66b', dark: '#8e6a10', gem: '#fff1b8' },
    legend: { base: '#2fae86', light: '#83e3c1', dark: '#1a6c53', gem: '#d2fff1' },
    mythic: { base: '#9b6cf0', light: '#cdb0ff', dark: '#5d3fa6', gem: '#f1e8ff' },
};

;// CONCATENATED MODULE: ./src/render/card.ts










const CARD_WIDTH = 640;
const CARD_HEIGHT = 360;
function escapeXml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
/** Monta o SVG com a fonte em `<defs>` (cada glifo usado entra uma vez só). */
class Canvas {
    glyphs = new Map();
    parts = [];
    rect(x, y, w, h, fill) {
        if (w <= 0 || h <= 0)
            return;
        this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);
    }
    path(d, fill) {
        if (d)
            this.parts.push(`<path fill="${fill}" d="${d}"/>`);
    }
    /** Desenha um bitmap de papéis (um caractere por pixel) com uma cor por papel. */
    bitmap(rows, colors, x, y, scale) {
        for (const [role, fill] of Object.entries(colors)) {
            this.path(pixelPath(parseBitmap(rows, role), scale, x, y), fill);
        }
    }
    /** Escreve texto na fonte de pixel. Devolve a largura em px. */
    text(content, x, y, options) {
        const scale = options.scale ?? 2;
        const value = options.maxWidth !== undefined
            ? truncate(content, Math.floor(options.maxWidth / scale))
            : content;
        const width = measure(value) * scale;
        const align = options.align ?? 'left';
        const left = Math.round(align === 'center' ? x - width / 2 : align === 'right' ? x - width : x);
        const uses = [];
        let cursor = 0;
        for (const char of characters(value)) {
            const g = glyph(char);
            if (g.pixels.length > 0) {
                if (!this.glyphs.has(g.id))
                    this.glyphs.set(g.id, glyphPath(g));
                uses.push(cursor === 0 ? `<use href="#${g.id}"/>` : `<use href="#${g.id}" x="${cursor}"/>`);
            }
            cursor += g.width + LETTER_SPACING;
        }
        if (uses.length > 0) {
            this.parts.push(`<g fill="${options.fill}" transform="translate(${left} ${y}) scale(${scale})">${uses.join('')}</g>`);
        }
        return width;
    }
    toString(title, desc) {
        const defs = [...this.glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');
        return [
            `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-labelledby="gc-title gc-desc" shape-rendering="crispEdges">`,
            `<title id="gc-title">${escapeXml(title)}</title>`,
            `<desc id="gc-desc">${escapeXml(desc)}</desc>`,
            `<defs>${defs}</defs>`,
            ...this.parts,
            '</svg>',
            '',
        ].join('\n');
    }
}
/** Retângulo com cantos "arredondados" em degraus de pixel. */
function steppedRect(x, y, w, h, step) {
    const s = step;
    return (`M${x + 2 * s} ${y}h${w - 4 * s}v${s}h${s}v${s}h${s}v${h - 4 * s}h-${s}v${s}h-${s}v${s}` +
        `h-${w - 4 * s}v-${s}h-${s}v-${s}h-${s}v-${h - 4 * s}h${s}v-${s}h${s}z`);
}
const CORNER_GEM = ['..##..', '.#gg#.', '#gwgg#', '#gggg#', '.#gg#.', '..##..'];
/** Ajusta um tamanho para a grade de 2 px, para manter tudo nítido. */
function snap(value) {
    return Math.round(value / 2) * 2;
}
function renderCard(character, options) {
    const t = strings(options.lang);
    const theme = THEMES[options.theme];
    const metal = RANK_METALS[character.rank];
    const classColor = classDef(character.classId).color;
    const accentText = ensureContrast(classColor, theme.background, 4.5);
    const rankText = ensureContrast(options.theme === 'dark' ? metal.light : metal.dark, theme.background, 4.5);
    const numberText = (value) => formatNumber(value, options.lang);
    const canvas = new Canvas();
    const W = CARD_WIDTH;
    const H = CARD_HEIGHT;
    // Moldura: contorno, faixa de metal com luz e sombra, contorno interno e fundo.
    canvas.path(steppedRect(0, 0, W, H, 2), theme.outline);
    canvas.path(steppedRect(2, 2, W - 4, H - 4, 2), metal.base);
    canvas.rect(8, 2, W - 16, 2, metal.light);
    canvas.rect(2, 8, 2, H - 16, metal.light);
    canvas.rect(8, H - 4, W - 16, 2, metal.dark);
    canvas.rect(W - 4, 8, 2, H - 16, metal.dark);
    canvas.rect(10, 10, W - 20, H - 20, theme.outline);
    canvas.rect(12, 12, W - 24, H - 24, theme.background);
    for (const [gx, gy] of [
        [0, 0],
        [W - 12, 0],
        [0, H - 12],
        [W - 12, H - 12],
    ]) {
        canvas.bitmap(CORNER_GEM, { '#': theme.outline, g: metal.base, w: metal.gem }, gx, gy, 2);
    }
    // Cabeçalho.
    canvas.rect(12, 12, W - 24, 34, theme.panel);
    canvas.rect(12, 46, W - 24, 2, theme.panelEdge);
    canvas.bitmap(['..#..', '.#g#.', '#gwg#', '.#g#.', '..#..'], { '#': theme.outline, g: metal.base, w: metal.gem }, 26, 24, 2);
    canvas.text(t.card.header, 42, 22, { fill: theme.text });
    canvas.text(`${t.card.since(character.memberSince)} · #${character.guildNumber}`, W - 28, 22, {
        fill: theme.muted,
        align: 'right',
    });
    // Retrato com o avatar.
    const portraitX = 28;
    const portraitY = 60;
    canvas.rect(portraitX, portraitY, 120, 120, theme.outline);
    canvas.rect(portraitX + 2, portraitY + 2, 116, 116, theme.panelEdge);
    const portraitBg = mix(theme.portrait, classColor, options.theme === 'dark' ? 0.16 : 0.14);
    canvas.rect(portraitX + 4, portraitY + 4, 112, 112, portraitBg);
    const sparkleRandom = seededRandom(character.hash, 11);
    const sparkles = [];
    for (let i = 0; i < 5; i++) {
        const left = sparkleRandom() < 0.5;
        const sx = snap(portraitX + 8 + (left ? 0 : 76) + sparkleRandom() * 22);
        const sy = snap(portraitY + 8 + sparkleRandom() * 60);
        sparkles.push([sx, sy]);
    }
    const sparkleColor = mix(portraitBg, lighten(classColor, 0.3), 0.55);
    canvas.path(sparkles.map(([sx, sy]) => `M${sx + 2} ${sy}h2v6h-2zM${sx} ${sy + 2}h6v2h-6z`).join(''), sparkleColor);
    const spriteScale = 7;
    const spriteX = portraitX + 4;
    const spriteY = portraitY + 4;
    canvas.rect(spriteX + 2 * spriteScale, spriteY + 15 * spriteScale, 12 * spriteScale, spriteScale - 2, theme.floor);
    const sprite = buildSprite(character.hash, character.classId, { outline: theme.outline });
    const byColor = new Map();
    sprite.pixels.forEach((row, y) => row.forEach((color, x) => {
        if (!color)
            return;
        const list = byColor.get(color) ?? [];
        list.push([x, y]);
        byColor.set(color, list);
    }));
    for (const [color, pixels] of byColor)
        canvas.path(pixelPath(pixels, spriteScale, spriteX, spriteY), color);
    // Placa do nível.
    const plaqueY = 190;
    canvas.rect(portraitX, plaqueY, 120, 66, theme.outline);
    canvas.rect(portraitX + 2, plaqueY + 2, 116, 62, theme.panel);
    canvas.rect(portraitX + 2, plaqueY + 2, 116, 2, metal.base);
    canvas.text(t.card.level, portraitX + 60, plaqueY + 14, { fill: theme.muted, align: 'center' });
    canvas.text(String(character.level.level), portraitX + 60, plaqueY + 32, {
        fill: theme.text,
        align: 'center',
        scale: 4,
    });
    // Nome, classe e patente.
    const columnX = 168;
    const columnW = W - 28 - columnX;
    const login = `@${character.login}`;
    if (measure(login) * 3 <= columnW) {
        canvas.text(login, columnX, 62, { fill: theme.text, scale: 3 });
    }
    else {
        canvas.text(login, columnX, 66, { fill: theme.text, scale: 2, maxWidth: columnW });
    }
    const emblem = EMBLEMS[character.classId];
    canvas.bitmap(emblem, {
        '#': theme.outline,
        a: classColor,
        b: lighten(classColor, 0.55),
        c: '#8b5a3c',
        d: '#cdd4de',
    }, columnX, 98, 2);
    let cursor = columnX + EMBLEM_SIZE * 2 + 8;
    cursor += canvas.text(t.classes[character.classId], cursor, 100, { fill: accentText });
    cursor += canvas.text(' · ', cursor, 100, { fill: theme.muted });
    canvas.text(t.ranks[character.rank], cursor, 100, { fill: rankText });
    // Barra de XP.
    const barY = 130;
    canvas.rect(columnX, barY, columnW, 18, theme.outline);
    canvas.rect(columnX + 2, barY + 2, columnW - 4, 14, theme.track);
    const inner = columnW - 4;
    const fill = character.level.progress > 0 ? Math.max(2, snap(inner * character.level.progress)) : 0;
    canvas.rect(columnX + 2, barY + 2, fill, 14, classColor);
    canvas.rect(columnX + 2, barY + 2, fill, 4, lighten(classColor, 0.35));
    canvas.rect(columnX + 2, barY + 14, fill, 2, darken(classColor, 0.25));
    const notches = [];
    for (let i = 1; i < 10; i++)
        notches.push(`M${columnX + 2 + snap((inner * i) / 10)} ${barY + 2}h2v14h-2z`);
    canvas.path(notches.join(''), mix(theme.outline, theme.track, 0.45));
    const xpLabel = canvas.text(`${t.card.xp} `, columnX, 156, { fill: theme.muted });
    const next = character.level.nextLevel;
    canvas.text(next === null
        ? numberText(character.xp.total)
        : `${numberText(character.xp.total)} / ${numberText(next)}`, columnX + xpLabel, 156, { fill: theme.text });
    canvas.text(next === null ? t.card.maxLevel : t.card.toNext(numberText(next - character.xp.total)), W - 28, 156, { fill: theme.muted, align: 'right' });
    // Atributos em duas colunas.
    const colWidth = (columnW - 20) / 2;
    ATTRIBUTES.forEach((def, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const ax = columnX + col * (colWidth + 20);
        const ay = 186 + row * 24;
        const value = character.attributes[def.id];
        canvas.text(t.attributes[def.id].short, ax, ay, { fill: theme.text });
        const segments = Math.ceil(value / 10);
        const barX = ax + 44;
        const barW = 10 * 14 - 2;
        canvas.rect(barX - 2, ay - 2, barW + 4, 18, theme.outline);
        const on = [];
        const shine = [];
        const off = [];
        for (let i = 0; i < 10; i++) {
            const sx = barX + i * 14;
            if (i < segments) {
                on.push(`M${sx} ${ay}h12v14h-12z`);
                shine.push(`M${sx} ${ay}h12v4h-12z`);
            }
            else {
                off.push(`M${sx} ${ay}h12v14h-12z`);
            }
        }
        const barColor = options.theme === 'dark' ? def.color : darken(def.color, 0.08);
        canvas.path(off.join(''), theme.track);
        canvas.path(on.join(''), barColor);
        canvas.path(shine.join(''), lighten(barColor, 0.3));
        canvas.text(String(value), ax + colWidth, ay, { fill: theme.text, align: 'right' });
    });
    // Linguagens.
    const bottomX = 28;
    const bottomW = W - 56;
    canvas.rect(bottomX, 264, bottomW, 2, theme.panelEdge);
    const langY = 274;
    canvas.rect(bottomX, langY, bottomW, 14, theme.outline);
    canvas.rect(bottomX + 2, langY + 2, bottomW - 4, 10, theme.track);
    const top = character.languages.slice(0, 6);
    const fallbackColor = options.theme === 'dark' ? '#8b93a5' : '#9a8b70';
    if (top.length > 0) {
        let x = bottomX + 2;
        const innerW = bottomW - 4;
        for (const lang of top) {
            const w = snap(innerW * lang.share);
            if (w <= 0)
                continue;
            canvas.rect(x, langY + 2, Math.min(w, bottomX + 2 + innerW - x), 10, lang.color ?? fallbackColor);
            x += w;
        }
        const labels = character.languages.slice(0, 4);
        for (let count = labels.length; count >= 1; count--) {
            const items = labels.slice(0, count);
            const widths = items.map((lang) => 14 + measure(`${lang.name} ${t.card.percent(lang.share)}`) * 2);
            const total = widths.reduce((sum, w) => sum + w, 0) + 20 * (count - 1);
            if (total > bottomW && count > 1)
                continue;
            let lx = bottomX;
            items.forEach((lang, i) => {
                canvas.rect(lx, 300, 10, 10, theme.outline);
                canvas.rect(lx + 2, 302, 6, 6, lang.color ?? fallbackColor);
                const nameW = canvas.text(lang.name, lx + 14, 298, {
                    fill: theme.text,
                    maxWidth: count === 1 ? bottomW - 80 : undefined,
                });
                canvas.text(` ${t.card.percent(lang.share)}`, lx + 14 + nameW, 298, { fill: theme.muted });
                lx += (widths[i] ?? 0) + 20;
            });
            break;
        }
    }
    else {
        canvas.text(t.card.noLanguages, bottomX, 298, { fill: theme.muted });
    }
    // Números públicos.
    const counts = {
        commits: character.activity.commits.raw,
        merged: character.activity.merged.raw,
        reviews: character.activity.reviews.raw,
        issues: character.activity.issues.raw,
    };
    const statItems = (short) => [
        [numberText(counts.commits), t.card.stats.commits(counts.commits)],
        [
            numberText(counts.merged),
            (short ? t.card.stats.mergedShort : t.card.stats.merged)(counts.merged),
        ],
        [numberText(counts.reviews), t.card.stats.reviews(counts.reviews)],
        [numberText(counts.issues), t.card.stats.issues(counts.issues)],
    ];
    const statText = (items) => items.map(([value, label]) => `${value} ${label}`).join(' · ');
    const fullStats = statItems(false);
    const shownStats = measure(statText(fullStats)) * 2 > bottomW ? statItems(true) : fullStats;
    let sx = bottomX;
    shownStats.forEach(([value, label], i) => {
        if (i > 0)
            sx += canvas.text(' · ', sx, 326, { fill: theme.muted });
        sx += canvas.text(value, sx, 326, { fill: theme.text });
        sx += canvas.text(` ${label}`, sx, 326, { fill: theme.muted });
    });
    const attributes = ATTRIBUTES.map((def) => `${t.attributes[def.id].short} ${character.attributes[def.id]}`).join(', ');
    const languages = character.languages
        .slice(0, 3)
        .map((lang) => `${lang.name} ${t.card.percent(lang.share)}`)
        .join(', ') || t.card.noLanguages;
    const desc = t.a11y.desc({
        level: character.level.level,
        rank: t.ranks[character.rank],
        className: t.classes[character.classId],
        xp: numberText(character.xp.total),
        attributes,
        languages,
        stats: statText(fullStats),
    });
    return canvas.toString(t.a11y.title(character.login), desc);
}

;// CONCATENATED MODULE: ./src/run.ts











/** Endereço do projeto (usado no resumo do job). */
const PROJECT_URL = 'https://github.com/GabrielKoglin/guild-card';
const RULES_URL = `${PROJECT_URL}/blob/main/docs/regras.md`;
function summaryMarkdown(character, inputs, files) {
    const t = strings(inputs.lang);
    const n = (value) => formatNumber(value, inputs.lang);
    const a = character.activity;
    const xp = character.xp;
    const rows = [
        [t.summary.rows.commits, a.commits.raw, a.commits.counted, xp.commits],
        [t.summary.rows.issues, a.issues.raw, a.issues.counted, xp.issues],
        [t.summary.rows.pullRequests, a.pullRequests.raw, a.pullRequests.counted, xp.pullRequests],
        [t.summary.rows.reviews, a.reviews.raw, a.reviews.counted, xp.reviews],
        [t.summary.rows.merged, a.merged.raw, a.merged.counted, xp.merged],
        [
            t.summary.rows.mergedElsewhere,
            a.mergedElsewhere.raw,
            a.mergedElsewhere.counted,
            xp.mergedElsewhere,
        ],
    ];
    return [
        `## ${t.summary.title(character.login)}`,
        '',
        `**${t.summary.level} ${character.level.level}** · ${t.classes[character.classId]} · ${t.ranks[character.rank]} · ${n(xp.total)} XP`,
        '',
        `| ${t.summary.source} | ${t.summary.rawLabel} | ${t.summary.counted} | XP |`,
        '| --- | ---: | ---: | ---: |',
        ...rows.map(([label, raw, counted, points]) => `| ${label} | ${n(raw)} | ${n(counted)} | ${n(points)} |`),
        `| **Total** | | | **${n(xp.total)}** |`,
        '',
        `${t.summary.files}: ${files.map((file) => `\`${file}\``).join(', ')}`,
        '',
        `${t.summary.rules}: ${RULES_URL}`,
        '',
    ].join('\n');
}
/** Executa a Action: coleta, calcula, desenha, salva e (opcionalmente) comita. */
async function run(deps) {
    const env = deps.env;
    const logger = deps.logger ?? consoleLogger();
    const inputs = readInputs(env);
    const t = strings(inputs.lang);
    const client = new GitHubClient({
        token: inputs.token,
        lang: inputs.lang,
        apiUrl: env.GITHUB_API_URL,
        graphqlUrl: env.GITHUB_GRAPHQL_URL,
        fetch: deps.fetch,
        sleep: deps.sleep,
        log: (message) => logger.info(message),
        warn: (message) => logger.warning(message),
    });
    const data = await logger.group(`Guild Card · @${inputs.username}`, () => collectPlayer({
        client,
        login: inputs.username,
        lang: inputs.lang,
        now: deps.now,
        log: (message) => logger.info(message),
        warn: (message) => logger.warning(message),
    }));
    const character = buildCharacter(data);
    logger.info(t.log.result(character.level.level, t.classes[character.classId], formatNumber(character.xp.total, inputs.lang)));
    const workspace = env.GITHUB_WORKSPACE || process.cwd();
    const files = outputFiles(inputs.output, inputs.theme).map(({ theme, path }) => ({
        path,
        content: renderCard(character, { theme, lang: inputs.lang }),
    }));
    for (const file of files) {
        const target = (0,external_node_path_namespaceObject.resolve)(workspace, file.path);
        await (0,promises_namespaceObject.mkdir)((0,external_node_path_namespaceObject.dirname)(target), { recursive: true });
        await (0,promises_namespaceObject.writeFile)(target, file.content, 'utf8');
        logger.info(t.log.wrote(file.path));
    }
    let committed = false;
    let commitSha = null;
    if (!inputs.commit) {
        logger.info(t.log.commitDisabled);
    }
    else {
        const [owner, repo] = (env.GITHUB_REPOSITORY ?? '').split('/');
        const ref = env.GITHUB_REF ?? '';
        if (!owner || !repo) {
            logger.warning(t.log.noRepository);
        }
        else if (!ref.startsWith('refs/heads/')) {
            logger.warning(t.log.notOnBranch(ref));
        }
        else {
            const branch = ref.slice('refs/heads/'.length);
            const result = await commitFiles({
                client,
                owner,
                repo,
                branch,
                files,
                message: t.commitMessage,
                lang: inputs.lang,
            });
            committed = result.committed;
            commitSha = result.sha;
            logger.info(result.sha ? t.log.committed(result.sha, branch) : t.log.unchanged);
        }
    }
    setOutput(env, 'level', String(character.level.level));
    setOutput(env, 'xp', String(character.xp.total));
    setOutput(env, 'class', character.classId);
    setOutput(env, 'class-name', t.classes[character.classId]);
    setOutput(env, 'rank', character.rank);
    setOutput(env, 'files', files.map((file) => file.path).join('\n'));
    setOutput(env, 'committed', String(committed));
    appendSummary(env, summaryMarkdown(character, inputs, files.map((file) => file.path)));
    return { character, files, committed, commitSha };
}
/** Ponto de entrada: transforma qualquer erro em falha do step, com mensagem clara. */
async function main(env = process.env, logger = consoleLogger()) {
    try {
        await run({ env, logger });
        return 0;
    }
    catch (error) {
        const lang = parseLang(env.INPUT_LANG ?? '') ?? 'pt-BR';
        const message = error instanceof GuildCardError
            ? error.message
            : strings(lang).errors.unexpected(error instanceof Error ? error.message : String(error));
        logger.error(message);
        return 1;
    }
}


/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __nccwpck_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	var threw = true;
/******/ 	try {
/******/ 		__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 		threw = false;
/******/ 	} finally {
/******/ 		if(threw) delete __webpack_module_cache__[moduleId];
/******/ 	}
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/asset-relocator-loader */
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = decodeURIComponent(new URL('.', import.meta.url).pathname).slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/******/ /* webpack/runtime/async module */
/******/ (() => {
/******/ 	var webpackQueues = typeof Symbol === "function" ? Symbol("webpack queues") : "__webpack_queues__";
/******/ 	var webpackExports = typeof Symbol === "function" ? Symbol("webpack exports") : "__webpack_exports__";
/******/ 	var webpackError = typeof Symbol === "function" ? Symbol("webpack error") : "__webpack_error__";
/******/ 	var resolveQueue = (queue) => {
/******/ 		if(queue && queue.d < 1) {
/******/ 			queue.d = 1;
/******/ 			queue.forEach((fn) => (fn.r--));
/******/ 			queue.forEach((fn) => (fn.r-- ? fn.r++ : fn()));
/******/ 		}
/******/ 	}
/******/ 	var wrapDeps = (deps) => (deps.map((dep) => {
/******/ 		if(dep !== null && typeof dep === "object") {
/******/ 			if(dep[webpackQueues]) return dep;
/******/ 			if(dep.then) {
/******/ 				var queue = [];
/******/ 				queue.d = 0;
/******/ 				dep.then((r) => {
/******/ 					obj[webpackExports] = r;
/******/ 					resolveQueue(queue);
/******/ 				}, (e) => {
/******/ 					obj[webpackError] = e;
/******/ 					resolveQueue(queue);
/******/ 				});
/******/ 				var obj = {};
/******/ 				obj[webpackQueues] = (fn) => (fn(queue));
/******/ 				return obj;
/******/ 			}
/******/ 		}
/******/ 		var ret = {};
/******/ 		ret[webpackQueues] = x => {};
/******/ 		ret[webpackExports] = dep;
/******/ 		return ret;
/******/ 	}));
/******/ 	__nccwpck_require__.a = (module, body, hasAwait) => {
/******/ 		var queue;
/******/ 		hasAwait && ((queue = []).d = -1);
/******/ 		var depQueues = new Set();
/******/ 		var exports = module.exports;
/******/ 		var currentDeps;
/******/ 		var outerResolve;
/******/ 		var reject;
/******/ 		var promise = new Promise((resolve, rej) => {
/******/ 			reject = rej;
/******/ 			outerResolve = resolve;
/******/ 		});
/******/ 		promise[webpackExports] = exports;
/******/ 		promise[webpackQueues] = (fn) => (queue && fn(queue), depQueues.forEach(fn), promise["catch"](x => {}));
/******/ 		module.exports = promise;
/******/ 		body((deps) => {
/******/ 			currentDeps = wrapDeps(deps);
/******/ 			var fn;
/******/ 			var getResult = () => (currentDeps.map((d) => {
/******/ 				if(d[webpackError]) throw d[webpackError];
/******/ 				return d[webpackExports];
/******/ 			}))
/******/ 			var promise = new Promise((resolve) => {
/******/ 				fn = () => (resolve(getResult));
/******/ 				fn.r = 0;
/******/ 				var fnQueue = (q) => (q !== queue && !depQueues.has(q) && (depQueues.add(q), q && !q.d && (fn.r++, q.push(fn))));
/******/ 				currentDeps.map((dep) => (dep[webpackQueues](fnQueue)));
/******/ 			});
/******/ 			return fn.r ? promise : getResult();
/******/ 		}, (err) => ((err ? reject(promise[webpackError] = err) : outerResolve(exports)), resolveQueue(queue)));
/******/ 		queue && queue.d < 0 && (queue.d = 0);
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__nccwpck_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__nccwpck_require__.o(definition, key) && !__nccwpck_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__nccwpck_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/************************************************************************/
/******/ 
/******/ // startup
/******/ // Load entry module and return exports
/******/ // This entry module used 'module' so it can't be inlined
/******/ var __webpack_exports__ = __nccwpck_require__(730);
/******/ __webpack_exports__ = await __webpack_exports__;
/******/ 
