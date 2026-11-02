# Regras do jogo

_English version: [`rules.md`](rules.md)._

Este documento é a referência das regras do Codorna Card. O código que aplica cada regra
está em [`src/game/`](../src/game), e toda mudança de regra precisa atualizar este arquivo e a
versão em inglês.

Princípios:

- **Dados públicos por padrão.** Nada privado entra no cálculo sem você pedir, mesmo que o token
  consiga enxergar. Há duas opções, desligadas por padrão: `private-contributions: true` soma o
  número de contribuições privadas que o GitHub já mostra no seu perfil, e `private-token` (o
  [modo completo](#modo-completo-private-token-opcional)) conta o trabalho nos repositórios
  privados que um token seu, só de leitura, enxerga. Nos dois casos, só entram totais: nenhum nome
  privado aparece em lugar nenhum.
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
| Contribuições privadas (opcional)               | Só com `private-contributions: true`: o campo `restrictedContributionsCount` de cada ano, o mesmo total anônimo que o GitHub mostra no gráfico do perfil. Veja [Contribuições privadas](#contribuições-privadas-opcional). |

Em todas essas listas, repositórios marcados como privados são descartados. As "contribuições
privadas" que o GitHub mostra de forma anônima no perfil só entram com `private-contributions: true`,
e o trabalho nos repositórios privados só entra no modo completo, lido à parte (veja
[Modo completo](#modo-completo-private-token-opcional)).

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
| Contribuição privada (opcional)            |            1 | 1.000 por ano. Só com `private-contributions: true`.                           |

No modo completo, commits, issues, PRs e reviews dos repositórios privados seguem esta mesma
tabela, e cada teto vale para a **soma de público e privado**: o diário, no mesmo dia; os anuais,
no mesmo ano. Detalhes em [Modo completo](#modo-completo-private-token-opcional).

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

## Contribuições privadas (opcional)

Para quem trabalha quase só em repositórios privados. Fica desligado por padrão.

**Como ligar.** Duas coisas:

1. No workflow, `private-contributions: true`.
2. No GitHub, no seu perfil: acima do gráfico de contribuições, **Contribution settings** →
   **Private contributions**. Sem isso o GitHub não informa o número e a Action avisa no log.

**O que entra.** O campo `restrictedContributionsCount` da API GraphQL, ano a ano. O GitHub o
define como as contribuições que quem consulta não consegue acessar, e ele só é diferente de zero
quando a pessoa escolheu compartilhar as contagens privadas. É o mesmo total anônimo que qualquer
visitante já vê no gráfico do perfil. Nenhum nome, linguagem ou detalhe de repositório privado é
lido; as listas por repositório continuam descartando tudo o que é privado.

**Quanto vale.** 1 XP por contribuição, até 1.000 por ano. O número mistura commits, issues, PRs e
reviews sem dizer o quê, não passa pelo teto diário de commits e ninguém de fora consegue conferir.
Por isso vale metade de um commit público e tem teto anual: quem trabalha muito em privado ganha até
1.000 XP por ano (o mesmo que 500 commits públicos), e farm num repositório privado não passa disso.

**O que não muda.** Atributos, classe e linguagens não usam esse número (só o modo completo leva
atividade privada para eles).

**No card.** O rodapé mostra só o total, como `3.456 privadas` (`3,456 private` em inglês), e a
descrição acessível diz "3.456 contribuições privadas". O resumo do job mostra a conta.

**Token.** O `GITHUB_TOKEN` padrão basta, porque o número é público. Um detalhe: as contribuições
em repositórios privados que o token consegue ver deixam de ser "restritas" para ele (e esses
repositórios são descartados). Por isso um token pessoal com acesso aos seus repositórios privados
mostra um número menor. Sem o modo completo, use o padrão. Com o modo completo, o número é lido
com o próprio `private-token` de propósito: veja
[Sem contar duas vezes](#sem-contar-duas-vezes).

## Modo completo (`private-token`, opcional)

Para quem trabalha quase só em repositórios privados e quer que esse trabalho conte **com as
mesmas regras do público**, não só como um total anônimo. Fica desligado por padrão.

**Como ligar.** Crie um token pessoal só de leitura, guarde como segredo (por exemplo,
`CODORNA_TOKEN`) e passe na entrada `private-token: ${{ secrets.CODORNA_TOKEN }}`. O passo a passo
do token, com as permissões, está no [README](../README.md#modo-completo-trabalho-privado-com-token-só-de-leitura-opcional).
A entrada `token` continua sendo o `GITHUB_TOKEN`: ele faz as leituras públicas e o commit do SVG.
O `private-token` só lê: o cliente dele recusa qualquer escrita (mutação GraphQL ou REST que não
seja GET).

**Por que direto nos repositórios.** O `contributionsCollection` da API (a fonte do fluxo
público) não é confiável para o trabalho privado: na conta do autor, mesmo com um token que
enxerga 25 repositórios privados, ele só trouxe os públicos. Contar direto nos repositórios
funcionou.

**O que é lido**, sempre com o `private-token`:

| Dado                         | Como é lido                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositórios                 | `viewer.repositories` com `ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]`, `privacy: PRIVATE` e `isFork: false`, de 100 em 100 (até os 1.000 com push mais recente).                                                  |
| Commits                      | `history(author: {id: <seu id>}, since: <criação da conta>)` na branch padrão de cada um, de 100 em 100. O dia é a data de autoria em UTC.                                                                                            |
| PRs abertos, issues, reviews | Buscas com `is:private` e faixa de datas por ano (`created:`), do mesmo jeito que os anos do fluxo público: `is:pr is:private author:LOGIN`, `is:issue is:private author:LOGIN` e `is:pr is:private reviewed-by:LOGIN -author:LOGIN`. |
| PRs mesclados                | `is:pr is:merged is:private author:LOGIN`, desde sempre; o bônus usa a mesma busca com `-user:LOGIN` (repositório de outra pessoa ou de uma organização).                                                                             |
| Linguagens                   | As 10 maiores linguagens de cada repositório privado **próprio** lido (os de organizações e de outras pessoas não votam, como no público).                                                                                            |
| Contribuições anônimas       | Só com `private-contributions: true`: o `restrictedContributionsCount` lido com o `private-token`.                                                                                                                                    |

**Mesmas regras, tetos sobre a soma.** A atividade privada vale o mesmo XP da pública, e cada
teto vale para a soma dos dois: só os 10 primeiros commits de cada dia contam, somando público e
privado do mesmo dia; issues, PRs abertos e reviews têm o teto anual sobre a soma do ano; PRs
mesclados (públicos + privados) nunca passam dos PRs abertos contados. Assim ninguém dobra um teto
dividindo o trabalho entre público e privado. Os dias com commit privado contam em CON, os
repositórios privados próprios votam na classe, entram na barra de linguagens e contam em INT.

**Detalhes da contagem:**

- Só commits seus, pelo id da sua conta: commits de outras pessoas no mesmo repositório não entram.
- O mesmo commit em dois repositórios privados (uma cópia, por exemplo) conta uma vez.
- Commits com data de autoria antes da criação da conta não contam, como no público.
- Review no próprio PR não conta (`-author:LOGIN`): review vale mais porque envolve outra pessoa.
- A busca do GitHub não filtra pela data do review, então o review conta no ano em que o PR foi
  aberto.
- Cada repositório privado lê no máximo 10.000 commits seus (os mais recentes); acima disso a
  Action avisa, sem citar o repositório.

### Sem contar duas vezes

Cada contribuição entra por um caminho só:

1. **Público** (`GITHUB_TOKEN`): só repositórios públicos; os privados que aparecem nas listas
   são descartados.
2. **Modo completo** (`private-token`): só repositórios com `privacy: PRIVATE` e sem forks, e
   buscas com `is:private`. Público e privado não se cruzam.
3. **Anônimas** (`restrictedContributionsCount`): o GitHub conta só as contribuições que **quem
   consulta não enxerga**. Sem `private-token`, quem consulta é o `GITHUB_TOKEN`, que não enxerga
   nada privado: entra o total anônimo inteiro. Com `private-token`, o número é consultado com o
   próprio `private-token`: entra só o que nem ele enxerga (por exemplo, uma organização que o
   token não alcança). O que o token enxerga já foi contado no item 2.

Sem `private-token`, tudo continua exatamente como antes.

### Privacidade

Regra dura: nenhum nome de repositório privado, de organização privada, de branch, mensagem de
commit ou título de PR ou issue aparece em lugar nenhum (SVG, logs, resumo do job, saídas da
Action, arquivos da prévia, mensagens de erro). As consultas do modo completo nem pedem esses
campos: só ids opacos, datas, contagens e nomes de linguagem. Os erros do `private-token` não
levam o texto que o GitHub devolve, porque ele pode citar organizações. O token é mascarado nos
logs (`::add-mask::`), como o `@actions/core` faz.

**Repositórios pulados.** Repositório de organização com SAML SSO em que o token não foi
autorizado, ou que o token não consegue ler, é pulado inteiro (nem commits nem linguagens), e o
log diz só **quantos** foram pulados, nunca quais.

**No card.** O trabalho privado aparece só no total do rodapé, `N privadas`, que soma as anônimas
(com `private-contributions`) e commits, issues, PRs abertos e reviews do modo completo. Os outros
números do rodapé (commits, PRs mesclados, reviews) continuam sendo os públicos. O resumo do job
ganha a coluna "Privado", só com totais.

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
| Constituição / Constitution | CON / CON        | dias com pelo menos um commit (público ou, no modo completo, privado)                               |                3.650 |        0,4 |
| Inteligência / Intelligence | INT / INT        | linguagens principais diferentes (a maior linguagem de cada repositório com 1 KB ou mais de código) |                   12 | 1 (linear) |
| Sabedoria / Wisdom          | SAB / WIS        | reviews de PR contados                                                                              |                2.000 |        0,4 |
| Carisma / Charisma          | CAR / CHA        | issues contadas + 2 × PRs mesclados em repositórios de outras pessoas                               |                2.000 |        0,4 |

Exemplos com curva 0,4 e referência 2.000: 10 PRs mesclados dão DES 12; 100 dão 30; 500 dão 57.

No modo completo, as quantidades já incluem a atividade privada (com os tetos sobre a soma), e INT
considera também os repositórios privados próprios lidos.

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
Regras opcionais novas, desligadas por padrão (como `private-contributions` e `private-token`), não
mudam o card de ninguém e podem sair numa versão minor.

O código das regras ([`src/game/`](../src/game)) é puro (não faz I/O nem chama a API) e tem um
ponto de entrada documentado, [`src/game/index.ts`](../src/game/index.ts), para poder ser
compartilhado com o jogo Codorna.
