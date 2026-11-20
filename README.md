# Era_Empires
Game development prototype of civilization inspired game

## Versão do jogador e versão de desenvolvimento

São duas páginas feitas a partir do mesmo código:

- **Jogador** — `index.html` (é o que o site publicado mostra): só o jogo, o tutorial e a configuração da partida.
  Não tem as abas de laboratório, o botão "Exportar", o cabeçalho "Versão completa · laboratórios" nem os botões
  "Balanceamento"/"Configurações" da tela inicial — e **não baixa** o código nem o HTML dos laboratórios
  (cerca de 228 KB, ou 86 KB comprimidos, contra 404 KB / 121 KB antes).
- **Desenvolvimento** — `dev.html`: o jogo e todos os laboratórios, como antes.
  Endereços antigos com `?dev=1` (ex.: `index.html?dev=1`) abrem o `dev.html` automaticamente.

Cada versão guarda a partida na sua própria chave do navegador (`imperios-jogador-partida` e
`imperios-dev-partida`), para os testes e os laboratórios nunca estragarem a partida do jogador. A partida que
estava guardada na chave antiga (`imperios-completo-partida`) passa sozinha para a do jogador na primeira vez
que se abre o `index.html` — nada se perde.

**Como gerar a versão do jogador.** O `dev.html` é a fonte; o `index.html` é gerado a partir dele (tira tudo o que
tem a classe `dev-only` e troca o código de entrada). Depois de mudar o HTML do jogo, edite o `dev.html` e rode:

```
npm run build:jogador
```

Se alguém editar o `index.html` à mão, o `npm test` avisa (`tests/structure.test.js`).

## Jogar no computador

O jogo agora é feito de módulos JavaScript (`<script type="module">`), que o navegador **não abre com duplo
clique** (endereço `file://`). É preciso um pequeno servidor local — qualquer um destes, na pasta do projeto:

```
npm start                      # sem instalar nada além do Node.js
python3 -m http.server 8080    # se tiver Python
npx serve .                    # outra opção com Node.js
```

Depois abra http://localhost:8080/ (jogador) ou http://localhost:8080/dev.html (desenvolvimento).
No GitHub Pages nada muda: o site continua a ser publicado a partir do `index.html` do branch `main`.

## Organização do código

```
index.html            versão do jogador (gerada a partir do dev.html)
dev.html              versão de desenvolvimento (jogo + laboratórios)
styles/               base.css (comum), game.css (jogo), screens.css (início, Nova partida, Como jogar), labs.css (só laboratórios)
assets/fonts/         Marcellus SC (nome IMPÉRIOS e títulos) e a licença OFL.txt
src/
  core/               regras do jogo: configuração, mapa, economia, militar, eras, fim de partida (sem tela)
  ai/                 decisões e perfis das IAs (sem tela)
  app/                sessão (partida atual, dificuldade, rivais), gravação do save, ganchos, depuração
  platform/           armazenamento (localStorage hoje; @capacitor/preferences no app) e ficheiros
  ui/                 telas do jogador: tela inicial, tela da era, mapa, gaveta, folhas, tutorial…
  labs/               laboratórios (só no dev.html), incluindo os 148 testes internos
  main-player.js      entrada do index.html
  main-dev.js         entrada do dev.html
tools/                build-player-html.js (gera o index.html) e serve.js (servidor local do npm start)
tests/                testes automáticos
```

Regras que os testes conferem: as regras (`src/core`) e as IAs (`src/ai`) não usam a tela nem importam o resto;
só `src/platform/storage.js` usa o `localStorage`; nenhuma função é substituída "em cadeia" (usam-se ganchos,
`src/app/hooks.js`); o jogador não carrega nada de `src/labs`.

## Testes

[![Testes](https://github.com/DrMeeoorr/Era_Empires/actions/workflows/testes.yml/badge.svg)](https://github.com/DrMeeoorr/Era_Empires/actions/workflows/testes.yml)

**Execução automática:** o GitHub Actions (`.github/workflows/testes.yml`) roda `npm test` em cada push e pull request, em qualquer branch; o selo acima fica verde quando todos os testes passam. Se falhar, as capturas de `tests/artifacts/` ficam disponíveis para download na página da execução.

O jogo tem uma suíte de testes automáticos na pasta `tests/`. Ela abre o `index.html` e o `dev.html` num
navegador invisível (Chromium, via [Playwright](https://playwright.dev)) e verifica se nada quebrou. Os testes
internos das regras também correm direto no Node, sem navegador.

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

Para uma verificação rápida só das regras: `npm run test:node` (uns 2 segundos, sem navegador) ou
`npm run test:rapido` (inclui as regras no navegador e a impressão digital).

**O que é testado**

| Ficheiro | O que verifica |
| --- | --- |
| `tests/internal.test.js` | Os 148 testes internos do jogo (`runTests()`, aba "Testes funcionais" do `dev.html`). |
| `tests/internal-node.test.js` | Os mesmos 148 testes internos, mas no Node, sem navegador. |
| `tests/structure.test.js` | Organização do código: regras sem tela, `localStorage` só no `storage`, sem funções substituídas em cadeia, jogador sem laboratórios, `index.html` igual ao gerado a partir do `dev.html`. |
| `tests/rules.test.js` | Regras extra: mapa, economia, ataques, fim de partida, configuração e gravação. |
| `tests/regression.test.js` | Partidas simuladas com semente fixa têm de dar sempre o mesmo resultado. |
| `tests/fingerprint.test.js` | "Impressão digital" de 27 partidas/simulações com `SEED` fixo: tem de continuar `e82cdda4` (valor após o rebalanceamento de Obras/Ciência e dificuldades; o jogo original era `5917a5c2`). Para ver o código e os subcódigos: `npm run fingerprint`. |
| `tests/mobile.test.js` | Celulares Pixel 7, Galaxy S9+ e 360×640: sem erros, sem rolagem horizontal, botões visíveis e clicáveis. |
| `tests/screens.test.js` | Telas fora da partida (início "Aurora", Nova partida + Personalizar, Como jogar, convite do tutorial) nos 3 celulares, também com a fonte larga: início sem rolar, sem rolagem horizontal nem textos cortados, alvos ≥ 48 px, Personalizar com todas as opções, "Continuar · Era N" com partida salva, fonte Marcellus SC local. |
| `tests/era-screen.test.js` | Tela da era sem rolagem vertical (Pixel 7, Galaxy S9+, 360×640; também com a fonte larga "DejaVu Sans"), sem textos cortados; folha de ataque (abre, fecha com toque fora/Esc/voltar, atacar, cancelar ordem, "Investir em Militar"); menu ☰ com Reiniciar confirmado; planos, Resto, Zerar e valor exato. |
| `tests/game-flow.test.js` | Partida curta completa até à tela de resultado, salvar/recarregar, a "Posição inicial aleatória" (gravada no aparelho e ignorada pelo tutorial) e o tutorial do início ao fim. |
| `tests/security.test.js` | Um save com HTML no nome de uma IA, na cor ou no registo de eventos não pode executar código. |
| `tests/save.test.js` | Save danificado não trava o jogo (vai para `…-corrompido` e começa partida nova com aviso); falha ao salvar mostra aviso ao jogador. |
| `tests/difficulty.test.js` | Valores de uma dificuldade não "vazam" para outra nem para "Configurações"; o tutorial não grava as suas escolhas (Fácil, 1 IA, 30 eras) nas do jogador. |
| `tests/player-version.test.js` | No `index.html` não aparece (nem é baixado) nada de laboratórios/Exportar/"Versão completa"; no `dev.html` aparece tudo; `index.html?dev=1` abre o `dev.html`; a partida da chave antiga passa para a do jogador e as duas versões não mexem no save uma da outra. |
| `tests/reinforced.test.js` | Versões reforçadas de testes internos fracos (adjacência e resultado dos ataques, botão Reiniciar, Cancelar no avanço rápido, desempenho estável, dificuldades com `aiIncomeMultiplier1v1`). Cinco delas já substituem os internos fracos em `src/labs/tests-def.js`; ver `tests/README.md`. |
| `tests/ptbr.test.js` | Textos do jogador em português do Brasil: telas principais, relatório da era, resultado e tutorial sem palavras de pt-PT ("registo", "Toque num", "resolvem-se"…) nem os nomes antigos ("u.", "Poder militar", "Infraestrutura", "Tecnologia"). |
| `tests/known-bugs.test.js` | Bugs conhecidos (marcados `BUG:` / `# todo`): descrevem o comportamento certo e não quebram o `npm test`. Hoje não há nenhum em aberto; ficam lá os testes do balão do tutorial nos 3 celulares (bug corrigido). |

**Se o teste de regressão falhar**

Quer dizer que uma mudança alterou o resultado de partidas com semente fixa. Se a mudança de regras
foi **intencional**, grave o novo resultado com `npm run test:update-snapshots` e faça commit do ficheiro
`tests/snapshots/regression.json`. Se **não** foi intencional, é um bug.

As capturas de tela tiradas durante os testes ficam em `tests/artifacts/` (não vão para o git).
