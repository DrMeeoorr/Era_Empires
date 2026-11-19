# Testes automáticos — notas para quem mantém

Como rodar e o que cada ficheiro faz: ver a secção **Testes** do `README.md` na raiz.

## Execução automática (GitHub Actions)

`.github/workflows/testes.yml` roda `npm test` em cada push e pull request (qualquer branch).
Como o `package.json` não tem dependências, o workflow instala o Playwright com
`npm install --no-save playwright@<versão>` (não altera o `package.json`) e o Chromium com
`npx playwright install --with-deps chromium`. A versão fica em `PLAYWRIGHT_VERSION` no workflow;
ao atualizar o Playwright do ambiente de desenvolvimento, atualize-a também (`node -e
"console.log(require('playwright/package.json').version)"`).

No CI (`CI=true`) o teste de desempenho usa um limite de 600 ms em vez de 200 ms
(ajustável com `PERF_BUDGET_MS`). Quando falha, `tests/artifacts/` é enviado como artefato.

## Como os testes chegam às funções do jogo

O jogo é feito de módulos ES (`src/`), que não criam variáveis globais. Para os testes continuarem a escrever
`state`, `newGame()`, `runTests()`… dentro de `page.evaluate`, o `openGame()` de `helpers.js` define
`window.__IMPERIOS_TEST__ = true` antes de a página abrir; o jogo então expõe as exportações de todos os módulos
como variáveis globais (e em `window.__imperios`) — ver `src/app/debug.js`. Escrever numa delas (ex.:
`state = newGame()`) chama a função `set…` do módulo dono (`setState`). Fora dos testes isso só acontece no
`dev.html`.

- `openGame(browser)` abre a versão do **jogador** (`index.html`): não tem `runTests()` nem os laboratórios.
- `openGame(browser, { dev: true })` abre a versão de **desenvolvimento** (`dev.html`): tudo, incluindo
  `runTests()`, `runGame()` e as abas. Os testes de regras que usam o motor dos laboratórios usam esta.
- Espere sempre por `window.__imperiosReady === true` depois de `page.reload()` (o arranque é assíncrono, porque
  o save é lido do armazenamento assíncrono).
- Chaves do save: `KEYS.save` (jogador), `KEYS.saveDev` (dev) e `KEYS.legacySave` (chave antiga, migrada).
- `saveGame()` e `loadSavedGame()` devolvem promessas (use `await`).

## Testes internos fracos (trocados)

Cinco dos seis testes internos fracos foram trocados, dentro de `defineTests()` (`src/labs/tests-def.js`), pelas
versões reforçadas de `tests/reinforced.test.js`, com o mesmo nome e a mesma categoria (o identificador
continua igual). As versões em `tests/reinforced.test.js` continuam a correr também.

| Teste interno (nome exato) | Era fraco porque… | Agora verifica |
| --- | --- | --- |
| Conquista respeita adjacência e aumenta territórios | Só via o dono se o sorteio vencesse; nunca tentava um alvo não adjacente. | Não adjacente e próprio território recusados sem gastar Força nem contar ataque; todos os alvos são vizinhos; vitória forçada muda só o alvo; Força gasta = custo × `winCost`; novos vizinhos ficam elegíveis. |
| Ataque bem-sucedido ou falho gera métricas de expansão | Só conferia a vitória, e só se o sorteio a desse. | Vitória e derrota forçadas: todos os contadores (estado e civilização), dono, Força gasta (`winCost`/`lossCost`) e registo; o sorteio natural dá as duas saídas. |
| Reinício restaura estado | Tautológico (comparava o `newState` com ele mesmo). | Pela sessão (3 rivais, 15 eras, Difícil): depois de jogar 4 eras, `newGame()` dá exatamente a mesma partida do início e a configuração não muda. |
| Desempenho: uma partida de 30 eras com 4 civilizações em menos de 200 ms | Média de 5 sem aquecimento: um pico isolado reprovava. | 2 partidas de aquecimento + mediana de 7, abaixo de 200 ms. |
| Predefinições de dificuldade aplicam os valores certos | Não conferia `aiIncomeMultiplier1v1`, nem "sobras" da dificuldade anterior, nem a receita. | Os 4 valores vindos de Médio e de Difícil; receita da 1.ª era das IAs em 1×1 e com 3 rivais. |

Continua por trocar (precisa da interface, por isso fica só como teste externo em `tests/reinforced.test.js`):

| Teste interno (nome exato) | Problema | Versão reforçada |
| --- | --- | --- |
| Cancelamento preserva eras concluídas (primitiva) | Não cancela nada: corre 1 era e verifica `history.length === 1`. | "avanço rápido: Cancelar a meio…" — no `dev.html`, bloco de 1 era, avança 1000 eras e carrega em Cancelar: para, o histórico tem exatamente as eras concluídas (consecutivas), "Concluir a era" volta a ficar ativo e a partida continua. |
