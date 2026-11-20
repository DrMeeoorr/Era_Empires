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

## Terrenos

Cada região tem um terreno (Campina, Floresta, Colinas, Montanha, Deserto, Pântano, Tundra). Em **Nova partida →
Personalizar → Terrenos** o jogador escolhe:

- **Só visual** (padrão para jogador novo e sempre no tutorial): o terreno só enfeita o mapa; as regras são as de
  sempre (impressão digital `39190b06`). Saves antigos abrem assim.
- **Com efeitos**: cada terreno dá 2 vantagens e 1 desvantagem (`TERRAIN_EFFECTS` em `src/core/terrain.js`):

| Terreno | Vantagens | Desvantagem |
|---|---|---|
| Campina | +20% ouro · +5% Obras | −2 defesa |
| Floresta | +10% Obras · +2 defesa | −20% ouro |
| Colinas | +10% Força · +2 defesa | −20% ouro |
| Montanha | +4 defesa · +20% ouro | −10% Ciência |
| Deserto | +10% Ciência · +20% ouro | −2 defesa |
| Pântano | +20% Ciência · atacar custa +20% | −20% ouro |
| Tundra | +15% Ciência · +2 defesa | −20% ouro |

  O ouro vale para o que a região rende; as % de Obras, Força e Ciência somam-se por região desse terreno que o
  império tem (Força: nos pontos de cada novo investimento militar). Defesa e custo de ataque do terreno só valem
  em regiões com dono (uma região livre custa o normal). A região inicial de cada império conta como Campina.
  A IA escolhe alvos pelo custo dividido pelo valor do terreno (ouro + afinidade do estilo: Construtor →
  Campina/Floresta, Científico → Deserto/Pântano/Tundra, Militar/Agressivo → Colinas). A partida guarda
  `state.terrainEffects=true` e as regiões iniciais em `state.terrain.starts`. Nos laboratórios,
  `runMatch`/`runFixedGame` aceitam `terrain: {type, seed, effects}`.

### Rodada de balanceamento (20/11/2026)

- **Posições iniciais** (mapa de 24 regiões, `START_ORDER_24` em `src/core/map.js`): Arvela, Zênite, Esmera, Torva,
  Musgo, Ombral. Pedral (centro, espremida por todos) saiu; 2 e 3 impérios ficam como antes. A posição aleatória e
  outros tamanhos de mapa seguem a regra de sempre (o mais afastado).
- **Mapa padrão**: Jaspe é Montanha e Rochedo é Colinas (antes o contrário), para as 3 Montanhas não ficarem todas do
  lado de Zênite.
- **Difícil**: rivais com +5% de receita com 2 ou mais rivais (+3% no 1×1). **Difícil e Lendário no Só visual com 2+
  rivais em jogo**: vão primeiro às regiões livres (atacando sempre) em vez da coligação contra o líder
  (`leaderTargetMode` em `src/ai/decide.js`); no 1×1 e com terrenos com efeito, a coligação continua.
- **Médio com terrenos com efeito**: rivais +3% de ouro (1,06 com 2+ rivais, 1,03 no 1×1; `effectsIncome` em
  `DIFFICULTIES.medio`). Fica gravado na partida (`state.aiIncomeEffects`): saves já em curso não mudam.

### Rodada 2 de balanceamento (20/11/2026)

- **Reflexo de defesa** (`defenseReflexOn`/`applyDefenseReflex` em `src/ai/decide.js`): o rival que faz fronteira
  com o jogador humano, quando o exército (Força) do jogador é maior que o dele, ganha **+15 pontos de Militar**
  nessa era, tirados de Obras e Ciência na proporção de cada uma (nunca abaixo de 0). Cada estilo mantém a sua
  prioridade principal (o Científico, por exemplo, fica com 20/20/60 → 35/16/49). Não dispara em partidas só de IAs.
- **Científico decide atacar já com o desconto da Ciência** (`attackNeed`); os outros estilos continuam a decidir
  pelo custo cheio (e todos pagam o custo com desconto).
- O ouro das dificuldades não mudou: Difícil e Lendário ficam um pouco mais duros (aceito pelo usuário).
- Não há nada novo no save: partidas em curso passam a usar a IA nova a partir da era seguinte.

### Rodada 4 de balanceamento (20/11/2026) — "só Ataque"

Atacar todas as eras ganhava demais com 2 ou 3 rivais. Mudou, nos dois modos de terreno:

- **Saque limitado a 20%** (`pillageMaxShare` em `DEFAULTS.military`): cada conquista leva no máximo 20% das Obras
  ativas e da Ciência do derrotado (antes min(50%, 3/regiões)); o espólio em ouro não mudou.
- **Força guardada defende** (`defensePerReserveForce`): cada ponto de Força que o dono **não** usou em ordens de
  ataque soma 1 à defesa das suas regiões, repartido como a defesa das Obras (÷ raiz do número de regiões). A Força
  reservada em ordens não conta; durante a resolução vale a Força livre de antes de devolver as reservas
  (`resolveOrders`). Entra no custo de ataque que o jogador vê, no `attackNeed` e, por isso, na decisão das IAs.
  A folha da região mostra "Força guardada +X" (`defenseParts` em `src/core/military.js`).
- **Ouro dos rivais com 2+ rivais** (para a escada de dificuldade continuar em ordem): Médio 1,03 → 1,00 (com
  terrenos com efeito 1,06 → 1,03) e Difícil 1,05 → 1,03. O 1×1 e o Lendário não mudaram.
- **Sorteio novo a cada partida**: `newGame()` sorteia `state.rngSeed` (guardado no save; saves antigos mantêm o
  seu). O tutorial (`newGame({fixedSeed:true})`), os laboratórios, os testes de regressão e as impressões digitais
  continuam com a semente fixa.
- Saves em curso: abrem com as regras novas (saque e Força guardada) a partir da era seguinte, mas mantêm o ouro dos
  rivais e a semente com que começaram (estão gravados no save).

## Organização do código

```
index.html            versão do jogador (gerada a partir do dev.html)
dev.html              versão de desenvolvimento (jogo + laboratórios)
styles/               base.css (comum), game.css (jogo), screens.css (início, Nova partida, Como jogar), labs.css (só laboratórios)
assets/fonts/         Marcellus SC (nome IMPÉRIOS e títulos) e a licença OFL.txt
src/
  core/               regras do jogo: configuração, mapa, terrenos, economia, militar, eras, fim de partida (sem tela)
  ai/                 decisões e perfis das IAs (sem tela)
  app/                sessão (partida atual, dificuldade, rivais), gravação do save, ganchos, depuração
  platform/           armazenamento (localStorage hoje; @capacitor/preferences no app) e ficheiros
  ui/                 telas do jogador: tela inicial, tela da era, mapa, gaveta, folhas, tutorial…
  labs/               laboratórios (só no dev.html), incluindo os 155 testes internos
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
| `tests/internal.test.js` | Os 155 testes internos do jogo (`runTests()`, aba "Testes funcionais" do `dev.html`). |
| `tests/internal-node.test.js` | Os mesmos 155 testes internos, mas no Node, sem navegador. |
| `tests/structure.test.js` | Organização do código: regras sem tela, `localStorage` só no `storage`, sem funções substituídas em cadeia, jogador sem laboratórios, `index.html` igual ao gerado a partir do `dev.html`. |
| `tests/rules.test.js` | Regras extra: mapa, economia, ataques, fim de partida, configuração e gravação. |
| `tests/regression.test.js` | Partidas simuladas com semente fixa têm de dar sempre o mesmo resultado. |
| `tests/fingerprint.test.js` | "Impressão digital" de 27 partidas/simulações com `SEED` fixo: tem de continuar `39190b06` (rodada 4 de balanceamento, 20/11/2026: saque até 20% e Força guardada que defende; antes `8ba37eca`, `a911f8cd`, `e82cdda4`, e o jogo original era `5917a5c2`). Mede o jogo com os terrenos só visuais (padrão). Para ver o código e os subcódigos: `npm run fingerprint`. |
| `tests/fingerprint-effects.test.js` | Segunda impressão digital: 37 partidas só de IAs com os **terrenos com efeitos** (mapa padrão e sorteado, 2/4/6 impérios, ritmo normal e rápido): tem de continuar `5c97e2c2` (rodada 4 de balanceamento, 20/11/2026: saque até 20% e Força guardada; antes `4010a086`, `bda662ed` e `75da3210`). Muda se mudar a tabela dos terrenos ou a escolha de alvos da IA. `npm run fingerprint` mostra as duas. |
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
| `tests/terrain.test.js` | Terrenos do mapa (só visuais): tabela do mapa padrão, sorteio determinístico pela semente e com as regras (milhares de sementes, 1–6 impérios), save/recarregar, save antigo = mapa padrão, opção "Mapa" em Personalizar, tutorial sempre no padrão, folha "ⓘ Terrenos" e Como jogar, fronteira + bandeira do dono, espadas nos alvos (sem tracejado), região escolhida com o resto escurecido, "⚔ ordem", nomes legíveis nos 3 celulares (também com a fonte larga). |
| `tests/terrain-effects.test.js` | Terrenos com efeitos: tabela final, desligado idêntico (também com terrenos variados), um teste por efeito (ouro, defesa, custo de ataque, % de Obras/Força/Ciência), proteção só para quem ocupa, região inicial como Campina, IA prefere o terreno do seu estilo, laboratórios com `terrain`, opção "Terrenos" em Personalizar e resumos, save (ligado sobrevive a recarregar; save antigo = Só visual), tutorial sempre Só visual, folha da região (etiquetas + / + / − e custo com o terreno), folha ⓘ Terrenos e Como jogar ligados e desligados. |
| `tests/acabamento.test.js` | Acabamento visual (21/11/2026), nos 3 celulares e com a fonte larga: etiquetas + / − dos terrenos com efeito sem quebrar nem cortar (ⓘ Terrenos, folha da região, Como jogar; contraste AA, sinal no texto), lista só visual em 2 colunas; o "?" da partida abre o Como jogar novo, que fecha com ✕, Esc, Voltar do Android e Entendi e devolve o foco; janelas no estilo novo (Reiniciar, Nova partida, tutorial, ouro parado, save danificado, aviso de falha ao salvar, menu ☰) com role="dialog", nome, descrição, foco preso, alvos ≥ 48 px e Esc que cancela. |
| `tests/balance-round.test.js` | Rodada de balanceamento de 20/11/2026: ordem das posições iniciais (Pedral nunca; 2–3 impérios e outros mapas como antes), Difícil/Lendário com 2+ rivais no Só visual vão às regiões livres e no 1×1/com efeitos atacam o líder, receitas (desde a rodada 4: Difícil 1,03; Médio 1,00 e com efeitos 1,03 só com o valor gravado na partida; o carimbo de saves antigos 1,06/1,03 continua a valer; valores estranhos ignorados), mapa padrão com Montanhas dos dois lados e, pela interface, Médio com efeitos no save. |
| `tests/balance-round-2.test.js` | Rodada 2 de balanceamento de 20/11/2026: reflexo de defesa (só com fronteira com o jogador humano e o exército dele maior; nunca em partidas só de IAs; +15 p.p. de Militar tirados de Obras/Ciência na proporção; cada estilo mantém a prioridade principal), Científico ataca já com o desconto da Ciência e os outros não, e em partidas contra o jogador o Científico continua a gastar ≥50% em Ciência e mais que todos. |
| `tests/balance-round-4.test.js` | Rodada 4 de balanceamento (20/11/2026): saque ≤ 20% (também em partidas inteiras), Força guardada na defesa (÷ raiz das regiões, na folha e no custo), Força reservada em ordens não defende e a resolução usa a Força livre de antes das devoluções, a IA não ataca quem guarda muita Força, semente nova a cada partida (tutorial e laboratórios fixos; save e recarregar mantêm a semente) e os textos do Como jogar. |
| `tests/known-bugs.test.js` | Bugs conhecidos (marcados `BUG:` / `# todo`): descrevem o comportamento certo e não quebram o `npm test`. Hoje não há nenhum em aberto; ficam lá os testes do balão do tutorial nos 3 celulares (bug corrigido). |

**Se o teste de regressão falhar**

Quer dizer que uma mudança alterou o resultado de partidas com semente fixa. Se a mudança de regras
foi **intencional**, grave o novo resultado com `npm run test:update-snapshots` e faça commit do ficheiro
`tests/snapshots/regression.json`. Se **não** foi intencional, é um bug.

As capturas de tela tiradas durante os testes ficam em `tests/artifacts/` (não vão para o git).
