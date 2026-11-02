# Regras do jogo

Este documento é a referência das regras do Codorna Card. O código que aplica cada regra
está em [`src/game/`](../src/game), e toda mudança de regra precisa atualizar este arquivo.

Princípios:

- **Só dados públicos.** Nada privado entra no cálculo, mesmo que o token consiga enxergar.
- **Regras abertas.** Qualquer pessoa consegue refazer a conta do próprio card.
- **Constância vale mais que volume.** Tetos diários e anuais impedem que farm vire nível.
- **O card só muda quando os números mudam.** Não há data de atualização no SVG, então não
  existe commit diário à toa.

## De onde vêm os dados

Tudo vem da API GraphQL do GitHub, lida um ano de cada vez (ano do calendário, em UTC), desde
a criação da conta até o dia da execução.

| Dado                                            | Como é lido                                                                                                                                                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commits                                         | Contribuições de commit por dia e por repositório (as mesmas do gráfico de contribuições do perfil). Quando um repositório tem mais de 100 dias de commit no ano, o ano é relido por trimestre para não perder nenhum dia. |
| Issues                                          | Issues abertas pela pessoa.                                                                                                                                                                                                |
| PRs abertos                                     | Pull requests abertos pela pessoa.                                                                                                                                                                                         |
| Reviews de PR                                   | Reviews de pull request. O GitHub conta um review por PR revisado (o mais recente).                                                                                                                                        |
| PRs mesclados                                   | Busca `is:pr is:merged is:public author:LOGIN`, desde sempre.                                                                                                                                                              |
| PRs mesclados em repositórios de outras pessoas | A mesma busca com `-user:LOGIN`.                                                                                                                                                                                           |
| Linguagens                                      | Repositórios próprios, públicos e que não são fork (até os 1.000 com push mais recente), com as 10 maiores linguagens de cada um.                                                                                          |

Em todas as listas, repositórios marcados como privados são descartados. As "contribuições
privadas" que o GitHub mostra de forma anônima no perfil também não entram.

Limites da API que vale conhecer: em cada período a API lista até 100 repositórios por tipo de
contribuição. Quem contribui em mais de 100 repositórios no mesmo ano pode ter os menos ativos
de fora (a Action avisa no log quando isso acontece).

## XP

| Atividade                                  |           XP | Teto contra farm                                                               |
| ------------------------------------------ | -----------: | ------------------------------------------------------------------------------ |
| Commit                                     |            2 | Só os 10 primeiros commits de cada dia contam (somando todos os repositórios). |
| Issue aberta                               |            4 | 150 por ano.                                                                   |
| PR aberto                                  |            5 | 250 por ano.                                                                   |
| Review de PR                               |            8 | 250 por ano.                                                                   |
| PR mesclado                                |          +10 | Nunca conta mais PRs mesclados do que PRs abertos contados.                    |
| PR mesclado em repositório de outra pessoa | +10 de bônus | O mesmo limite acima.                                                          |

Na prática:

- Um PR aberto e mesclado no seu próprio repositório vale 5 + 10 = **15 XP** (7,5 commits).
- Um PR mesclado no projeto de outra pessoa vale 5 + 10 + 10 = **25 XP**.
- Um review vale **8 XP**, quatro vezes um commit.
- Um dia com 300 commits vale o mesmo que um dia com 10: **20 XP**.

Por que esses tetos: commit é fácil de inflar com script, issue e PR também (dá para abrir e
fechar em loop), e um PR mesclado ou um review costuma exigir outra pessoa. Os tetos foram
escolhidos para quase nunca atrapalhar quem trabalha de verdade.

O que **não** dá XP: estrelas, seguidores, repositórios criados (popularidade e quantidade de
repositórios são fáceis de farmar) e os commits do próprio Codorna Card, que são feitos em nome
do `github-actions[bot]` e por isso não contam como contribuição sua.

## Nível

XP total para chegar ao nível **N** = **50 × (N − 1)²**. O nível máximo é 99.

| Nível | XP total |     | Nível | XP total |
| ----: | -------: | --- | ----: | -------: |
|     1 |        0 |     |    20 |   18.050 |
|     2 |       50 |     |    30 |   42.050 |
|     5 |      800 |     |    50 |  120.050 |
|    10 |    4.050 |     |    75 |  273.800 |
|    15 |    9.800 |     |    99 |  480.200 |

Cada nível pede um pouco mais do que o anterior: do nível N para o N + 1 são 50 × (2N − 1) XP.

## Patente

A patente muda a moldura do card.

| Patente               | Níveis  | Moldura  |
| --------------------- | ------- | -------- |
| Recruta (Recruit)     | 1 a 4   | madeira  |
| Aprendiz (Apprentice) | 5 a 14  | bronze   |
| Veterano (Veteran)    | 15 a 29 | prata    |
| Mestre (Master)       | 30 a 49 | ouro     |
| Lenda (Legend)        | 50 a 74 | jade     |
| Mítico (Mythic)       | 75 a 99 | ametista |

## Classe

A classe vem da linguagem dominante:

1. Cada repositório com código vale **um voto**, dividido entre as linguagens dele na proporção
   do tamanho em bytes. Assim um repositório gigante não engole os outros.
2. Os votos de linguagens da mesma família somam para a mesma classe (JavaScript e TypeScript
   votam juntos, C e C++ também).
3. Vence a classe com mais votos. Empate é resolvido pela ordem da tabela abaixo.
4. Linguagens que não estão na tabela não votam. Sem nenhuma linguagem conhecida, a classe é
   Aventureiro.

| Classe                    | Linguagens (principais)                                                                          | Equipamento do avatar              |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Ferreiro (Blacksmith)     | C, C++, Rust, Zig, Assembly, Nim, D, Ada, Odin, CUDA, VHDL, Verilog                              | faixa na cabeça e avental de couro |
| Ilusionista (Illusionist) | JavaScript, TypeScript, HTML, CSS, SCSS, Vue, Svelte, Astro, GLSL, HLSL, Processing              | cartola                            |
| Alquimista (Alchemist)    | Python, Jupyter Notebook, R, Julia, MATLAB, Mathematica, Fortran, Mojo                           | óculos de proteção e manto         |
| Arcanista (Arcanist)      | Haskell, Elixir, Erlang, Clojure, OCaml, F#, Scheme, Racket, Lisp, Elm, Gleam, Lean, Coq, Prolog | chapéu pontudo e manto             |
| Guardião (Guardian)       | Java, C#, Scala, Groovy, Visual Basic, COBOL, Pascal                                             | elmo e armadura                    |
| Inventor (Tinkerer)       | Swift, Kotlin, Dart, Objective-C, QML, OpenSCAD, G-code, KiCad                                   | capacete de obra e macacão         |
| Druida (Druid)            | Shell, PowerShell, Dockerfile, HCL, Nix, Makefile, CMake, Starlark, Puppet                       | coroa de folhas e manto            |
| Patrulheiro (Ranger)      | Go, Templ, Crystal, V, Vala                                                                      | capuz                              |
| Mercador (Merchant)       | PHP, Ruby, Perl, Blade, Twig, Liquid, ABAP, Apex, Solidity                                       | chapéu de aba larga e colete       |
| Bardo (Bard)              | TeX, Markdown, MDX, Typst, Lua, Luau, GDScript, Haxe, Pawn, Ren'Py, LilyPond                     | boina com pena                     |
| Vidente (Seer)            | SQL, PLpgSQL, PL/SQL, T-SQL, GraphQL, Cypher, SPARQL, CodeQL, jq                                 | tiara com gema e manto             |
| Aventureiro (Adventurer)  | nenhuma linguagem conhecida                                                                      | cachecol                           |

A lista completa (com todos os nomes exatamente como o GitHub informa) está em
[`src/game/classes.ts`](../src/game/classes.ts). Falta a sua linguagem? Abra um PR.

## Atributos

Seis atributos de 1 a 99. Eles descrevem o estilo da pessoa e **não** dão XP.

`valor = 99 × (quantidade ÷ referência) ^ curva`, arredondado, com mínimo 1 e máximo 99.
Com curva 0,4 o atributo cresce rápido no começo e devagar perto do topo.

| Atributo                    | Sigla pt-BR / en | Quantidade                                                                                          | Referência (vale 99) |      Curva |
| --------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- | -------------------: | ---------: |
| Força / Strength            | FOR / STR        | commits contados (com o teto diário)                                                                |               20.000 |        0,4 |
| Destreza / Dexterity        | DES / DEX        | PRs mesclados contados                                                                              |                2.000 |        0,4 |
| Constituição / Constitution | CON / CON        | dias com pelo menos um commit público                                                               |                3.650 |        0,4 |
| Inteligência / Intelligence | INT / INT        | linguagens principais diferentes (a maior linguagem de cada repositório com 1 KB ou mais de código) |                   12 | 1 (linear) |
| Sabedoria / Wisdom          | SAB / WIS        | reviews de PR contados                                                                              |                2.000 |        0,4 |
| Carisma / Charisma          | CAR / CHA        | issues contadas + 2 × PRs mesclados em repositórios de outras pessoas                               |                2.000 |        0,4 |

Exemplos com curva 0,4 e referência 2.000: 10 PRs mesclados dão DES 12; 100 dão 30; 500 dão 57.

## Avatar e número da carteirinha

- O avatar 16×16 é desenhado por código. O SHA-256 do username em minúsculas escolhe pele,
  cabelo (estilo e cor), olhos e um detalhe (sorriso, bochechas ou bigode); a classe escolhe o
  equipamento. O mesmo username sempre gera o mesmo avatar.
- Há duas regras de legibilidade: o cabelo precisa contrastar com a pele, e em pele escura os
  olhos sempre têm brilho.
- O número da carteirinha (ex.: `#CBA1-245E`) são os últimos 4 bytes do mesmo hash. É só decorativo.

## Mudanças nas regras

As regras fazem parte da versão da Action. Mudança que altera XP, nível ou classe de quem já
usa sai numa versão major nova (por exemplo, de `v1` para `v2`), com nota explicando o motivo.
