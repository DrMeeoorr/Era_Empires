# Era_Empires
Game development prototype of civilization inspired game

## Testes

O jogo tem uma suíte de testes automáticos na pasta `tests/`. Ela abre o `index.html` num navegador
invisível (Chromium, via [Playwright](https://playwright.dev)) e verifica se nada quebrou.

**Como rodar**

1. Tenha o Node.js 20 ou mais recente.
2. Se o Playwright ainda não estiver instalado no computador:
   `npm i -D playwright` e depois `npx playwright install chromium` (só na primeira vez).
3. Na pasta do projeto, rode:

```
npm test
```

Leva cerca de 30 segundos. No fim aparece quantos testes passaram (`# pass`), falharam (`# fail`)
e quantos são bugs conhecidos ainda por corrigir (`# todo`). Se algum falhar, `npm test` termina com erro.

Para uma verificação rápida só das regras (uns 3 segundos): `npm run test:rapido`.

**O que é testado**

| Ficheiro | O que verifica |
| --- | --- |
| `tests/internal.test.js` | Os 140+ testes internos do jogo (`runTests()`, aba "Testes funcionais"). |
| `tests/rules.test.js` | Regras extra: mapa, economia, ataques, fim de partida, configuração e gravação. |
| `tests/regression.test.js` | Partidas simuladas com semente fixa têm de dar sempre o mesmo resultado. |
| `tests/fingerprint.test.js` | "Impressão digital" de 27 partidas/simulações com `SEED` fixo: tem de continuar `5917a5c2` (o valor do jogo original). Para ver o código e os subcódigos: `npm run fingerprint`. |
| `tests/mobile.test.js` | Celulares Pixel 7, Galaxy S9+ e 360×640: sem erros, sem rolagem horizontal, botões visíveis e clicáveis. |
| `tests/game-flow.test.js` | Partida curta completa até à tela de resultado, salvar/recarregar e o tutorial do início ao fim. |
| `tests/known-bugs.test.js` | Bugs conhecidos (marcados `BUG:` / `# todo`): descrevem o comportamento certo e não quebram o `npm test`. |

**Se o teste de regressão falhar**

Quer dizer que uma mudança alterou o resultado de partidas com semente fixa. Se a mudança de regras
foi **intencional**, grave o novo resultado com `npm run test:update-snapshots` e faça commit do ficheiro
`tests/snapshots/regression.json`. Se **não** foi intencional, é um bug.

As capturas de tela tiradas durante os testes ficam em `tests/artifacts/` (não vão para o git).
