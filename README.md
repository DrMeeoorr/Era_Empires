# Era_Empires
Game development prototype of civilization inspired game

## Versão do jogador e versão de desenvolvimento

O mesmo `index.html` serve as duas versões:

- **Jogador** (padrão, é o que o site publicado mostra): só o jogo, o tutorial e a configuração da partida.
  Não aparecem as abas de laboratório, o botão "Exportar", o cabeçalho "Versão completa · laboratórios"
  nem os botões "Balanceamento"/"Configurações" da tela inicial.
- **Desenvolvimento**: acrescente `?dev=1` ao endereço (ex.: `index.html?dev=1`) e tudo aparece como antes.

Para jogar no computador basta abrir o `index.html` no navegador (duplo clique). Para a versão de
desenvolvimento, abra-o e acrescente `?dev=1` ao fim do endereço na barra do navegador.

Por enquanto os laboratórios só ficam **escondidos** na versão do jogador (o código continua no ficheiro).

## Testes

[![Testes](https://github.com/DrMeeoorr/Era_Empires/actions/workflows/testes.yml/badge.svg)](https://github.com/DrMeeoorr/Era_Empires/actions/workflows/testes.yml)

**Execução automática:** o GitHub Actions (`.github/workflows/testes.yml`) roda `npm test` em cada push e pull request, em qualquer branch; o selo acima fica verde quando todos os testes passam. Se falhar, as capturas de `tests/artifacts/` ficam disponíveis para download na página da execução.

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
| `tests/fingerprint.test.js` | "Impressão digital" de 27 partidas/simulações com `SEED` fixo: tem de continuar `e82cdda4` (valor após o rebalanceamento de Obras/Ciência e dificuldades; o jogo original era `5917a5c2`). Para ver o código e os subcódigos: `npm run fingerprint`. |
| `tests/mobile.test.js` | Celulares Pixel 7, Galaxy S9+ e 360×640: sem erros, sem rolagem horizontal, botões visíveis e clicáveis. |
| `tests/era-screen.test.js` | Tela da era sem rolagem vertical (Pixel 7, Galaxy S9+, 360×640; também com a fonte larga "DejaVu Sans"), sem textos cortados; folha de ataque (abre, fecha com toque fora/Esc/voltar, atacar, cancelar ordem, "Investir em Militar"); menu ☰ com Reiniciar confirmado; planos, Resto, Zerar e valor exato. |
| `tests/game-flow.test.js` | Partida curta completa até à tela de resultado, salvar/recarregar e o tutorial do início ao fim. |
| `tests/security.test.js` | Um save com HTML no nome de uma IA, na cor ou no registo de eventos não pode executar código. |
| `tests/save.test.js` | Save danificado não trava o jogo (vai para `…-corrompido` e começa partida nova com aviso); falha ao salvar mostra aviso ao jogador. |
| `tests/difficulty.test.js` | Valores de uma dificuldade não "vazam" para outra nem para "Configurações"; o tutorial não grava as suas escolhas (Fácil, 1 IA, 30 eras) nas do jogador. |
| `tests/player-version.test.js` | Sem `?dev=1` não aparece nada de laboratórios/Exportar/"Versão completa"; com `?dev=1` aparece tudo. |
| `tests/reinforced.test.js` | Versões reforçadas de testes internos fracos (adjacência e resultado dos ataques, botão Reiniciar, Cancelar no avanço rápido, desempenho estável, dificuldades com `aiIncomeMultiplier1v1`). Ver `tests/README.md`. |
| `tests/ptbr.test.js` | Textos do jogador em português do Brasil: telas principais, relatório da era, resultado e tutorial sem palavras de pt-PT ("registo", "Toque num", "resolvem-se"…) nem os nomes antigos ("u.", "Poder militar", "Infraestrutura", "Tecnologia"). |
| `tests/known-bugs.test.js` | Bugs conhecidos (marcados `BUG:` / `# todo`): descrevem o comportamento certo e não quebram o `npm test`. Hoje não há nenhum em aberto; ficam lá os testes do balão do tutorial nos 3 celulares (bug corrigido). |

**Se o teste de regressão falhar**

Quer dizer que uma mudança alterou o resultado de partidas com semente fixa. Se a mudança de regras
foi **intencional**, grave o novo resultado com `npm run test:update-snapshots` e faça commit do ficheiro
`tests/snapshots/regression.json`. Se **não** foi intencional, é um bug.

As capturas de tela tiradas durante os testes ficam em `tests/artifacts/` (não vão para o git).
