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

## Testes internos a trocar (próxima rodada, em `defineTests()` de `src/labs/tests-def.js`)

`tests/reinforced.test.js` tem versões reforçadas destes testes internos. Os internos continuam a
correr (não foram desativados); trocar cada um pela versão reforçada (ou portá-la para dentro de
`defineTests()`, hoje em `src/labs/tests-def.js`), mantendo o mesmo nome/categoria em `TEST_CAT_BY_NAME`:

| Teste interno (nome exato) | Problema | Versão reforçada |
| --- | --- | --- |
| Conquista respeita adjacência e aumenta territórios | Só verifica o dono se o sorteio vencer (18% das vezes não verifica nada); nunca tenta um alvo **não** adjacente. | "conquista: alvo não adjacente é recusado…" — recusa de não adjacente e do próprio território sem gastar poder; vitória forçada (`s.forcedAttack`) muda só o alvo; poder gasto = `spent × winCost`; novos vizinhos ficam elegíveis. |
| Ataque bem-sucedido ou falho gera métricas de expansão | Só confere `neutralConquests` se vencer; a derrota nunca é verificada. | "ataque: vitória e derrota contabilizadas…" — força vitória e derrota e confere todos os contadores (`s.attacks` e da civilização), dono, poder gasto (`winCost`/`lossCost`) e registo; confirma que o sorteio natural dá as duas saídas. |
| Reinício restaura estado | Tautológico: cria um `newState` novo e verifica o próprio `newState`. | "botão Reiniciar…" — pela interface: Cancelar no diálogo não muda nada; Reiniciar volta ao estado de uma partida nova com as mesmas definições (3 IAs, 15 eras, Difícil); continua assim após recarregar. Só pode ficar como teste externo (precisa da interface). Dentro de `defineTests()` dá para testar `startNewGame()` contra o estado de `newGame()`. |
| Cancelamento preserva eras concluídas (primitiva) | Não cancela nada: corre 1 era e verifica `history.length === 1`. | "avanço rápido: Cancelar a meio…" — pelos laboratórios (`?dev=1`), bloco de 1 era, avança 1000 eras e carrega em Cancelar: para, o histórico tem exatamente as eras concluídas (consecutivas), "Concluir a era" volta a ficar ativo e a partida continua. Também só faz sentido como teste externo. |
| Desempenho: uma partida de 30 eras com 4 civilizações em menos de 200 ms | Média de 5 partidas sem aquecimento: um único pico (medido: 72 ms numa partida de ~7 ms) desloca a média; numa máquina lenta/partilhada falha sem motivo. | "desempenho: mediana de 7 partidas…" — 2 partidas de aquecimento + mediana de 7; limite 200 ms local / 600 ms em CI. |
| Predefinições de dificuldade aplicam os valores certos | Não confere `aiIncomeMultiplier1v1` (Médio = 1, restantes = −1), nem "sobras" da dificuldade anterior, nem o efeito na receita. | "dificuldades: os 4 valores…" + "dificuldade Médio pela interface…" — os 4 campos vindos de outra dificuldade; receita da 1.ª era das IAs em 1×1 e com 3 rivais (Médio 1×1 = igual ao jogador; 3 rivais = ×1,03). |
