# Game rules

_Versão em português: [`regras.md`](regras.md)._

This document is the reference for the Codorna Card rules. The code that applies each rule lives
in [`src/game/`](../src/game), and every rule change must update this file and its Portuguese
version.

Principles:

- **Public data by default.** Nothing private goes into the math unless you ask for it, even if
  the token can see it. There are two options, off by default: `private-contributions: true` adds
  the number of private contributions GitHub already shows on your profile, and `private-token`
  ([full mode](#full-mode-private-token-optional)) counts the work in the private repositories a
  read-only token of yours can see. Either way, only totals are used: no private name shows up
  anywhere.
- **Open rules.** Anyone can redo the math for their own card.
- **Consistency beats volume.** Daily and yearly caps keep farming from turning into levels.
- **The card only changes when the numbers change.** There is no "updated at" date in the SVG, so
  there is no pointless daily commit.

## Where the data comes from

Everything comes from the GitHub GraphQL API, read one year at a time (calendar year, in UTC), from
the account creation until the day of the run.

| Data                                      | How it is read                                                                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commits                                   | Commit contributions per day and per repository (the same ones as the profile contribution graph). When a repository has more than 100 commit days in a year, the year is re-read by quarter so no day is lost.            |
| Issues                                    | Issues opened by the person.                                                                                                                                                                                               |
| Opened PRs                                | Pull requests opened by the person.                                                                                                                                                                                        |
| PR reviews                                | Pull request reviews. GitHub counts one review per reviewed PR (the most recent one).                                                                                                                                      |
| Merged PRs                                | Search `is:pr is:merged is:public author:LOGIN`, all time.                                                                                                                                                                 |
| PRs merged in other people's repositories | The same search with `-user:LOGIN`.                                                                                                                                                                                        |
| Languages                                 | Owned, public, non-fork repositories (up to the 1,000 most recently pushed), with the 10 largest languages of each.                                                                                                        |
| Private contributions (optional)          | Only with `private-contributions: true`: the `restrictedContributionsCount` field for each year, the same anonymous total GitHub shows on the profile graph. See [Private contributions](#private-contributions-optional). |

In all of these lists, repositories marked as private are dropped. The "private contributions"
GitHub shows anonymously on the profile only count with `private-contributions: true`, and the work
in private repositories only counts in full mode, which reads it separately (see
[Full mode](#full-mode-private-token-optional)).

API limits worth knowing: in each period the API lists up to 100 repositories per contribution
type. People who contribute to more than 100 repositories in the same year may have the least
active ones left out (the Action warns about it in the log).

## XP

| Activity                               |        XP | Anti-farm cap                                                             |
| -------------------------------------- | --------: | ------------------------------------------------------------------------- |
| Commit                                 |         2 | Only the first 10 commits of each day count (adding up all repositories). |
| Opened issue                           |         4 | 150 per year.                                                             |
| Opened PR                              |         5 | 250 per year.                                                             |
| PR review                              |         8 | 250 per year.                                                             |
| Merged PR                              |       +10 | Never counts more merged PRs than counted opened PRs.                     |
| PR merged in someone else's repository | +10 bonus | The same limit as above.                                                  |
| Private contribution (optional)        |         1 | 1,000 per year. Only with `private-contributions: true`.                  |

In full mode, commits, issues, PRs and reviews from private repositories follow this same table,
and each cap applies to **public and private combined**: the daily one on the same day, the yearly
ones in the same year. Details in [Full mode](#full-mode-private-token-optional).

In practice:

- A PR opened and merged in your own repository is worth 5 + 10 = **15 XP** (7.5 commits).
- A PR merged in someone else's project is worth 5 + 10 + 10 = **25 XP**.
- A review is worth **8 XP**, four times a commit.
- A day with 300 commits is worth the same as a day with 10: **20 XP**.

Why these caps: commits are easy to inflate with a script, and so are issues and PRs (you can open
and close them in a loop), while a merged PR or a review usually needs another person. The caps
were chosen so they almost never get in the way of people doing real work.

What does **not** give XP: stars, followers, created repositories (popularity and repository count
are easy to farm) and the commits made by Codorna Card itself, which are authored by
`github-actions[bot]` and therefore don't count as your contributions.

## Private contributions (optional)

For people who work almost only in private repositories. It is off by default.

**How to turn it on.** Two things:

1. In the workflow, `private-contributions: true`.
2. On GitHub, on your profile: above the contribution graph, **Contribution settings** →
   **Private contributions**. Without it GitHub does not report the number and the Action warns
   you in the log.

**What is used.** The `restrictedContributionsCount` field of the GraphQL API, year by year. GitHub
defines it as the contributions the viewer cannot access, and it is only non-zero when the person
chose to share their private contribution counts. It is the same anonymous total any visitor
already sees on the profile graph. No private repository name, language or detail is read; the
per-repository lists keep dropping everything that is private.

**How much it is worth.** 1 XP per contribution, up to 1,000 per year. The number mixes commits,
issues, PRs and reviews without saying which is which, it does not go through the daily commit cap
and nobody outside can check it. That is why it is worth half a public commit and has a yearly cap:
people who work a lot in private earn up to 1,000 XP per year (the same as 500 public commits), and
farming in a private repository can't go beyond that.

**What doesn't change.** Attributes, class and languages don't use this number (only full mode
brings private activity into them).

**On the card.** The footer only shows the total, like `3,456 private` (`3.456 privadas` in
Portuguese), and the accessible description says "3,456 private contributions". The job summary
shows the math.

**Token.** The default `GITHUB_TOKEN` is enough, because the number is public. One detail:
contributions in private repositories the token can see are no longer "restricted" for it (and
those repositories are dropped). That is why a personal token with access to your private
repositories shows a smaller number. Without full mode, use the default one. In full mode, the
number is read with the `private-token` itself on purpose: see
[No double counting](#no-double-counting).

## Full mode (`private-token`, optional)

For people who work almost only in private repositories and want that work to count **with the
same rules as public work**, not just as an anonymous total. It is off by default.

**How to turn it on.** Create a read-only personal token, store it as a secret (for example,
`CODORNA_TOKEN`) and pass it in the `private-token: ${{ secrets.CODORNA_TOKEN }}` input. The
step-by-step for the token, with its permissions, is in the
[README](../README.md#full-mode-private-work-with-a-read-only-token-optional). The `token` input
is still `GITHUB_TOKEN`: it does the public reads and the SVG commit. The `private-token` only
reads: its client refuses any write (GraphQL mutation or non-GET REST call).

**Why straight from the repositories.** The API's `contributionsCollection` (the source of the
public flow) is not reliable for private work: on the author's account, even with a token that
sees 25 private repositories, it only returned the public ones. Counting straight from the
repositories worked.

**What is read**, always with the `private-token`:

| Data                        | How it is read                                                                                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositories                | `viewer.repositories` with `ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]`, `privacy: PRIVATE` and `isFork: false`, 100 at a time (up to the 1,000 most recently pushed).                                         |
| Commits                     | `history(author: {id: <your id>}, since: <account creation>)` on each default branch, 100 at a time. The day is the author date in UTC.                                                                                           |
| Opened PRs, issues, reviews | Searches with `is:private` and a date range per year (`created:`), the same years as the public flow: `is:pr is:private author:LOGIN`, `is:issue is:private author:LOGIN` and `is:pr is:private reviewed-by:LOGIN -author:LOGIN`. |
| Merged PRs                  | `is:pr is:merged is:private author:LOGIN`, all time; the bonus uses the same search with `-user:LOGIN` (someone else's or an organization's repository).                                                                          |
| Languages                   | The 10 largest languages of each **owned** private repository that was read (organization and other people's repositories don't vote, like in the public flow).                                                                   |
| Anonymous contributions     | Only with `private-contributions: true`: `restrictedContributionsCount` read with the `private-token`.                                                                                                                            |

**Same rules, caps on the sum.** Private activity is worth the same XP as public activity, and each
cap applies to both combined: only the first 10 commits of each day count, adding public and
private on the same day; issues, opened PRs and reviews have the yearly cap on the year's sum;
merged PRs (public + private) never exceed the counted opened PRs. That way nobody doubles a cap by
splitting work between public and private. Days with private commits count for CON, and owned
private repositories vote for the class, show up in the language bar and count for INT.

**Counting details:**

- Only your commits, by your account id: other people's commits in the same repository don't count.
- The same commit in two private repositories (a copy, for example) counts once.
- Commits authored before the account was created don't count, like in the public flow.
- A review on your own PR doesn't count (`-author:LOGIN`): reviews are worth more because they
  involve another person.
- GitHub search can't filter by review date, so a review counts in the year the PR was opened.
- Each private repository reads at most 10,000 of your commits (the most recent); above that the
  Action warns you, without naming the repository.

### No double counting

Each contribution comes in through one path only:

1. **Public** (`GITHUB_TOKEN`): only public repositories; private ones that show up in the lists
   are dropped.
2. **Full mode** (`private-token`): only repositories with `privacy: PRIVATE` and no forks, and
   searches with `is:private`. Public and private never overlap.
3. **Anonymous** (`restrictedContributionsCount`): GitHub only counts the contributions **the
   viewer cannot see**. Without `private-token`, the viewer is `GITHUB_TOKEN`, which sees nothing
   private: the whole anonymous total counts. With `private-token`, the number is queried with the
   `private-token` itself: only what not even it can see counts (for example, an organization the
   token can't reach). What the token can see was already counted in item 2.

Without `private-token`, everything works exactly as before.

### Privacy

Hard rule: no private repository name, private organization name, branch name, commit message or
PR or issue title shows up anywhere (SVG, logs, job summary, Action outputs, preview files, error
messages). Full-mode queries don't even ask for those fields: only opaque ids, dates, counts and
language names. `private-token` errors don't carry the text GitHub sends back, because it may name
organizations. The token is masked in the logs (`::add-mask::`), like `@actions/core` does.

**Skipped repositories.** An organization repository with SAML SSO where the token was not
authorized, or one the token can't read, is skipped entirely (no commits, no languages), and the
log only says **how many** were skipped, never which.

**On the card.** Private work only shows up in the footer total, `N private`, which adds the
anonymous ones (with `private-contributions`) and full-mode commits, issues, opened PRs and
reviews. The other footer numbers (commits, merged PRs, reviews) are still the public ones. The
job summary gets a "Private" column, with totals only.

## Level

Total XP to reach level **N** = **50 × (N − 1)²**. The maximum level is 99.

| Level | Total XP |     | Level | Total XP |
| ----: | -------: | --- | ----: | -------: |
|     1 |        0 |     |    20 |   18,050 |
|     2 |       50 |     |    30 |   42,050 |
|     5 |      800 |     |    50 |  120,050 |
|    10 |    4,050 |     |    75 |  273,800 |
|    15 |    9,800 |     |    99 |  480,200 |

Each level asks a bit more than the previous one: going from level N to N + 1 takes
50 × (2N − 1) XP.

## Rank

The rank changes the card frame.

| Rank                  | Levels   | Frame    |
| --------------------- | -------- | -------- |
| Recruit (Recruta)     | 1 to 4   | wood     |
| Apprentice (Aprendiz) | 5 to 14  | bronze   |
| Veteran (Veterano)    | 15 to 29 | silver   |
| Master (Mestre)       | 30 to 49 | gold     |
| Legend (Lenda)        | 50 to 74 | jade     |
| Mythic (Mítico)       | 75 to 99 | amethyst |

## Class

The class comes from the dominant language:

1. Each repository with code is worth **one vote**, split among its languages in proportion to
   their size in bytes. That way a huge repository doesn't swallow the others.
2. Votes for languages of the same family add up to the same class (JavaScript and TypeScript vote
   together, and so do C and C++).
3. The class with the most votes wins. Ties are broken by the order of the table below.
4. Languages that are not in the table don't vote. Without any known language, the class is
   Adventurer.

| Class                     | Languages (main ones)                                                                            | Avatar gear                    |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| Blacksmith (Ferreiro)     | C, C++, Rust, Zig, Assembly, Nim, D, Ada, Odin, CUDA, VHDL, Verilog                              | headband and leather apron     |
| Illusionist (Ilusionista) | JavaScript, TypeScript, HTML, CSS, SCSS, Vue, Svelte, Astro, GLSL, HLSL, Processing              | top hat                        |
| Alchemist (Alquimista)    | Python, Jupyter Notebook, R, Julia, MATLAB, Mathematica, Fortran, Mojo                           | safety goggles and robe        |
| Arcanist (Arcanista)      | Haskell, Elixir, Erlang, Clojure, OCaml, F#, Scheme, Racket, Lisp, Elm, Gleam, Lean, Coq, Prolog | pointy hat and robe            |
| Guardian (Guardião)       | Java, C#, Scala, Groovy, Visual Basic, COBOL, Pascal                                             | helmet and armor               |
| Tinkerer (Inventor)       | Swift, Kotlin, Dart, Objective-C, QML, OpenSCAD, G-code, KiCad                                   | hard hat and overalls          |
| Druid (Druida)            | Shell, PowerShell, Dockerfile, HCL, Nix, Makefile, CMake, Starlark, Puppet                       | leaf crown and robe            |
| Ranger (Patrulheiro)      | Go, Templ, Crystal, V, Vala                                                                      | hood                           |
| Merchant (Mercador)       | PHP, Ruby, Perl, Blade, Twig, Liquid, ABAP, Apex, Solidity                                       | wide-brimmed hat and vest      |
| Bard (Bardo)              | TeX, Markdown, MDX, Typst, Lua, Luau, GDScript, Haxe, Pawn, Ren'Py, LilyPond                     | beret with a feather           |
| Seer (Vidente)            | SQL, PLpgSQL, PL/SQL, T-SQL, GraphQL, Cypher, SPARQL, CodeQL, jq                                 | circlet with a gem, and a robe |
| Adventurer (Aventureiro)  | no known language                                                                                | scarf                          |

The full list (with every name exactly as GitHub reports it) is in
[`src/game/classes.ts`](../src/game/classes.ts). Is your language missing? Open a PR.

## Attributes

Six attributes from 1 to 99. They describe the person's style and do **not** give XP.

`value = 99 × (amount ÷ reference) ^ curve`, rounded, with a minimum of 1 and a maximum of 99.
With a 0.4 curve the attribute grows fast at the start and slowly near the top.

| Attribute                   | Abbreviation en / pt-BR | Amount                                                                                       | Reference (worth 99) |      Curve |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- | -------------------: | ---------: |
| Strength / Força            | STR / FOR               | counted commits (with the daily cap)                                                         |               20,000 |        0.4 |
| Dexterity / Destreza        | DEX / DES               | counted merged PRs                                                                           |                2,000 |        0.4 |
| Constitution / Constituição | CON / CON               | days with at least one commit (public or, in full mode, private)                             |                3,650 |        0.4 |
| Intelligence / Inteligência | INT / INT               | different main languages (the largest language of each repository with 1 KB or more of code) |                   12 | 1 (linear) |
| Wisdom / Sabedoria          | WIS / SAB               | counted PR reviews                                                                           |                2,000 |        0.4 |
| Charisma / Carisma          | CHA / CAR               | counted issues + 2 × PRs merged in other people's repositories                               |                2,000 |        0.4 |

Examples with a 0.4 curve and a 2,000 reference: 10 merged PRs give DEX 12; 100 give 30; 500 give 57.

In full mode, the amounts already include private activity (with the caps on the sum), and INT
also takes the owned private repositories that were read into account.

## Avatar and card number

- The 16×16 avatar is drawn by code. The SHA-256 of the lowercase username picks the skin, the hair
  (style and color), the eyes and one detail (smile, cheeks or mustache); the class picks the gear.
  The same username always produces the same avatar.
- There are two readability rules: the hair must contrast with the skin, and on dark skin the eyes
  always have a highlight.
- The card number (e.g. `#CBA1-245E`) is the last 4 bytes of the same hash. It is just decorative.

## Rule changes

The rules are part of the Action version. A change that alters the XP, level or class of existing
users ships in a new major version (for example, from `v1` to `v2`), with a note explaining why.
New optional rules that are off by default (like `private-contributions` and `private-token`) don't
change anyone's card and can ship in a minor version.

The rules code ([`src/game/`](../src/game)) is pure (no I/O, no API calls) and has a documented
entry point, [`src/game/index.ts`](../src/game/index.ts), so it can be shared with the Codorna
game.
