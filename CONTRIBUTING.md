# Como contribuir

Obrigado por querer ajudar o Codorna Card! Contribuições pequenas e focadas são as melhores.

## Preparar o ambiente

Precisa de Node 22 ou mais novo. Tudo funciona igual no Windows (PowerShell) e no Linux.

```bash
npm ci
npm test          # testes (nenhum teste chama a API do GitHub)
npm run lint      # ESLint + Prettier
npm run typecheck
npm run demo      # regenera os exemplos em examples/ (SVG e PNG)
npm run assets    # regenera o logo, a codorna, as prévias sociais e o GIF em assets/
npm run build     # empacota a Action em dist/
npm run all       # tudo isso, em sequência
```

## Prévia com a API de verdade

Para ver como uma mudança fica no card de uma pessoa de verdade, sem comitar nada:

```bash
npm run preview -- --user algum-login
```

O resultado vai para `preview/` (fora do git): `<login>-dark.svg` e `<login>-light.svg`, os PNGs e
os dados lidos em `<login>.json`, no mesmo formato das fixtures de `fixtures/` (útil para
reproduzir um bug sem chamar a API). Opções: `--lang en`, `--private` (soma as contribuições
privadas, como a entrada `private-contributions`), `--private-token` (modo completo, como a
entrada `private-token`) e `--out <pasta>`.

O token vem de `GITHUB_TOKEN` ou, se a variável estiver vazia, de `gh auth token` (GitHub CLI).
Um token sem permissão nenhuma basta, porque a prévia só lê dados públicos. Para definir a variável:

- PowerShell: `$env:GITHUB_TOKEN = "seu-token"`
- bash/zsh: `export GITHUB_TOKEN=seu-token`

Com `--private-token`, o token privado vem de `CODORNA_TOKEN` ou, se estiver vazia, também do
`gh auth token`. Nunca passe token na linha de comando (a prévia recusa).

## Privacidade no modo completo

Tudo o que mexe com o `private-token` segue uma regra dura: nenhum nome de repositório privado,
organização, branch, mensagem de commit ou título pode aparecer em lugar nenhum (SVG, logs,
resumo, saídas, arquivos da prévia, mensagens de erro). Na prática:

- As consultas de [`src/github/private-queries.ts`](src/github/private-queries.ts) não pedem esses
  campos (há um teste que confere). Precisa de um dado novo? Só ids, datas, contagens e linguagens.
- Logs e avisos do modo completo levam só quantidades.
- O cliente do `private-token` usa `redact` (erros sem texto da API) e `readOnly` (nada de escrita).
- A API falsa dos testes devolve nomes secretos de propósito; os testes conferem que eles não
  aparecem em nenhuma saída. Mudou algo no modo completo? Cubra com um teste desses.

## Antes de abrir o PR

- Rode `npm run all` e comite também o `dist/`, os `examples/` e os `assets/` atualizados. A CI
  falha se algum deles estiver desatualizado. Os scripts só regravam o que mudou (nos PNGs a
  comparação é pelos pixels), então rodar de novo não suja o git.
- Mudou o visual do card? Atualize os snapshots com `npm run test:update` e confira os SVGs em
  `tests/__snapshots__/` antes de comitar. `npm run demo` e `npm run assets` refazem os PNGs e o GIF.
- Mudou alguma regra de XP, nível, classe ou atributo? Atualize o [`docs/regras.md`](docs/regras.md)
  e a versão em inglês, [`docs/rules.md`](docs/rules.md), no mesmo PR e explique o motivo. Mudanças
  que alteram o card de quem já usa só entram em versão major nova.
- As regras ficam em [`src/game/`](src/game) e precisam continuar puras: sem I/O, sem relógio, sem
  API e importando só arquivos da própria pasta (`tests/game-api.test.ts` confere). Exporte o que
  for público pelo [`src/game/index.ts`](src/game/index.ts), com comentário.
- Linguagem faltando? Adicione o nome exatamente como o GitHub (Linguist) informa em
  [`src/game/classes.ts`](src/game/classes.ts). Cada linguagem pode estar em uma classe só (há um
  teste para isso).

## Arte

Toda a arte do projeto é original e gerada por código: a fonte, os avatares, os emblemas, as
molduras e a codorna mascote ([`src/render/mascot.ts`](src/render/mascot.ts)), desenhada à mão em
texto, um caractere por pixel. Não aceitamos personagens, logos, fontes, sprites ou paletas
copiados de jogos ou de terceiros, nem desenhos que imitem o visual de um jogo existente.

Os PNGs e o GIF saem do rasterizador do projeto ([`scripts/lib/raster.ts`](scripts/lib/raster.ts)),
sem navegador nem ffmpeg. Ele só entende o subconjunto de SVG que o projeto gera (retângulos,
caminhos retos e a fonte); se um desenho novo usar outra coisa (curva, círculo, transparência
parcial), ele para com erro em vez de gerar uma imagem diferente do SVG.

`assets/social-preview.png` é a imagem de prévia do repositório (Settings → General → Social
preview); `assets/social-preview-en.png` é a versão em inglês.

## Commits e mensagens

Mensagens curtas, no imperativo, em português ou inglês. Textos de interface existem nos dois
idiomas em [`src/i18n.ts`](src/i18n.ts): ao adicionar um texto, traduza os dois.

---

**English:** run `npm ci`, then `npm run all` before opening a PR, and commit the updated `dist/`,
`examples/` and `assets/` (CI checks all three). To try a change against a real account without
committing anything, run `npm run preview -- --user some-login`: the token comes from
`GITHUB_TOKEN` or, if it is empty, from `gh auth token`, and the output goes to `preview/`
(git-ignored); `--private-token` adds full mode, with the token from `CODORNA_TOKEN` or `gh`. Rule
changes must update `docs/regras.md` and `docs/rules.md`, and `src/game/` must stay pure (no I/O,
no API, only imports from its own folder). Anything touching the `private-token` must never expose
private names (repositories, organizations, branches, commit messages, titles): queries don't ask
for them, logs only carry counts and tests check it. All art, including the quail mascot, must be
original and generated by code. UI strings live in both languages in `src/i18n.ts`.
