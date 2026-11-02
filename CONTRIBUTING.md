# Como contribuir

Obrigado por querer ajudar o Guild Card! Contribuições pequenas e focadas são as melhores.

## Preparar o ambiente

Precisa de Node 22 ou mais novo.

```bash
npm ci
npm test          # testes (nenhum teste chama a API do GitHub)
npm run lint      # ESLint + Prettier
npm run typecheck
npm run demo      # regenera os exemplos em examples/
npm run build     # empacota a Action em dist/
```

## Antes de abrir o PR

- Rode `npm run all` (lint, tipos, testes, build e demo) e comite também o `dist/` e os
  `examples/` atualizados. A CI falha se o `dist/` estiver desatualizado.
- Mudou o visual do card? Atualize os snapshots com `npm run test:update` e confira os SVGs em
  `tests/__snapshots__/` antes de comitar.
- Mudou alguma regra de XP, nível, classe ou atributo? Atualize o [`docs/regras.md`](docs/regras.md)
  no mesmo PR e explique o motivo. Mudanças que alteram o card de quem já usa só entram em versão
  major nova.
- Linguagem faltando? Adicione o nome exatamente como o GitHub (Linguist) informa em
  [`src/game/classes.ts`](src/game/classes.ts). Cada linguagem pode estar em uma classe só (há um
  teste para isso).

## Arte

Toda a arte do projeto é original e gerada por código. Não aceitamos personagens, logos, fontes,
sprites ou paletas copiados de jogos ou de terceiros, nem desenhos que imitem o visual de um jogo
existente.

## Commits e mensagens

Mensagens curtas, no imperativo, em português ou inglês. Textos de interface existem nos dois
idiomas em [`src/i18n.ts`](src/i18n.ts): ao adicionar um texto, traduza os dois.

---

**English:** run `npm ci`, then `npm run all` before opening a PR, and commit the updated `dist/`
and `examples/`. Rule changes must update `docs/regras.md`. All art must be original and generated
by code. UI strings live in both languages in `src/i18n.ts`.
