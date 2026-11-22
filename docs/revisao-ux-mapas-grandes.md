# Revisão de UX — mapas grandes (2×, 3×, 4×) no celular

Revisão do `mobile-ux`, 22/11/2026, sobre os commits 39d9cf1..603912e (tamanho do mapa, arrastar e aproximar,
selos de impérios fora da tela, botões de zoom em telas baixas, balanceamento). **Só revisão: nenhum código foi
alterado.** As mudanças grandes de tela propostas aqui precisam da aprovação do usuário antes de começar
(regra de `docs/decisoes.md`); as que mexem em regras ou números são do `game-designer`.

## Como foi testado

- Versão do jogador (`index.html`) servida por `tools/serve.js`, Playwright/Chromium com `deviceScaleFactor: 1`:
  **Pixel 7** (412×839), **tela pequena 360×640** e **Pixel 7 deitado** (863×360).
- Partidas jogadas pela interface (planos rápidos, toque nas regiões, "Atacar", "Concluir era"): Original 1 rival
  (10 eras), 2× 2 rivais (10 eras, 360×640), 3× 2 rivais (10 eras), 4× 3 rivais (12 eras no Pixel 7 e **29 eras até
  a vitória** no 360×640) e 4× 3 rivais até a era 23 só com o plano Equilibrado (para ver os rivais crescerem).
- Gestos de toque reais (CDP `Input.dispatchTouchEvent`): arrastar, toque com tremor, pinça, duplo toque.
- Desempenho com a CPU 4× e 6× mais lenta (`Emulation.setCPUThrottlingRate`; 4× é a referência habitual de
  celular intermediário, 6× aproxima um celular modesto).
- `tests/map-size.test.js` (16/16) e `tests/internal.test.js` (`runTests()`, 3/3 grupos) passam.
- Capturas em [`docs/img/revisao-ux-mapas-grandes/`](img/revisao-ux-mapas-grandes/)
  (pasta temporária; nomes `inicio-*`, `afastado-*`, `jogo-*`, `resumo-*`, `meio-*`, `setup-*`). Abaixo, "📷" =
  nome do arquivo nessa pasta.

## Resumo

**Ficou bom**

- O Original continua idêntico e o padrão de fábrica continua Original (certo para quem está começando).
- As regiões mantêm o tamanho do Original na escala 1: nomes (11–13 px) e números legíveis, alvos de 53–64 px.
- Arrastar e pinça funcionam com toque real e **não brigam com o toque na região**: arrastar 60 px não abre nada;
  tremor de 7 px ainda conta como toque (abre a folha); acima de 9 px vira arrasto. A pinça mantém o ponto entre os
  dedos parado. A página nunca rola para o lado.
- A partida começa centrada no seu império; os selos de borda com cor + símbolo + seta mostram para onde estão os
  rivais e levam até eles com um toque. Não dependem só da cor.
- Em telas baixas os botões + e − saem de cima do mapa (boa ideia).
- A tela Nova partida explica o tamanho em uma linha ("12 × 8 = 96 regiões…") e o aviso "Mapas 4× ficam melhores
  com 3 rivais" tem atalho de um toque ("Usar 3 rivais"). O resumo mostra "mapa 4×".
- Arrastar é barato: só muda o `transform` da camada; sem travadas na rolagem.

**Problemas principais**

1. Com o mapa afastado não dá para ver **quem é dono de quê** (os nomes e símbolos somem e o terreno domina).
2. A **janela do mapa é pequena** para 70–96 regiões e não há visão geral/minimapa: no 360×640 vê-se 1/4 do mapa 4×.
3. **Achar a próxima ação** fica caro: no 4× metade dos alvos está fora da tela a partir da era 14.
4. **O que as IAs fizeram longe** não aparece no mapa: o resumo diz "Rubro +2 regiões · cresceu longe de você" sem
   dizer onde.
5. **Selos de borda e botões de zoom ficam por cima de regiões** e engolem toques; no 2× afastado o império inicial
   do Rubro fica escondido embaixo dos botões.
6. **Desempenho do toque** no 4×: cada toque numa região redesenha o mapa inteiro (≈ 380 ms até a folha abrir num
   celular modesto, contra ≈ 150 ms no Original).
7. Alvos de toque abaixo de 48 dp quando afastado; legenda cortada e sem botão "centralizar" em telas baixas.

## Problemas encontrados

| ID | Problema | Severidade |
| --- | --- | --- |
| P1 | Visão afastada não mostra os donos | **alta** |
| P2 | Janela do mapa pequena e sem visão geral/minimapa | **alta** |
| P3 | Alvos fora da tela: achar a próxima ação custa toques e arrastos | **alta** |
| P4 | Turno das IAs sem localização no mapa | média |
| P5 | Selos de borda e botões de zoom cobrem regiões e bloqueiam toques | média |
| P6 | Desempenho: toque numa região redesenha o mapa inteiro | média |
| P7 | Alvos de toque menores que 48 dp com o mapa afastado | média |
| P8 | Telas baixas: legenda cortada e sem "centralizar no meu império" | média |
| P9 | Como navegar só aparece num aviso de 3 s por cima do placar | baixa |
| P10 | Tela Nova partida: opção escondida, sem duração estimada | baixa |
| P11 | Gestos: pinça muito sensível, sem duplo toque, zoom máximo pouco útil | baixa |
| P12 | Celular deitado: layout quebra (já acontecia no Original) | baixa |
| P13 | Começo longo e vazio no 3×/4× (jogabilidade) | média (game-designer) |

### P1 — Visão afastada não mostra os donos (alta)

- **O que acontece**: abaixo de 0,7 de escala a caixa ganha a classe `far` e `styles/game.css` esconde `.rname`,
  `.who` (número **e símbolo do dono**), `.def` e `.order-tag`. Sobra só a fronteira fina e as bandeirinhas de
  ~6 px. As cores dos terrenos (verde, vermelho-terracota, cinza) dominam e se confundem com as cores dos impérios.
  É justamente a escala em que o jogador quer ver "quem está onde".
- **Escala mínima medida** (o mapa inteiro cabe): Pixel 7 2× 0,73 · 3× 0,59 · 4× 0,49; 360×640 2× 0,65 · 3× 0,56 ·
  4× 0,49. Ou seja, no 3×/4× (e no 2× em tela pequena) a visão geral **sempre** esconde os donos.
- **Evidência**: 📷 `afastado-pixel7-4x.png`, `afastado-small-4x.png`, `jogo-pixel7-3x-final-afastado-zoom.png`
  (Ocre com 6 regiões no topo aparece só como uma faixa listrada fina), `meio-pixel7-4x-era23-afastado.png` (era 23:
  Ocre 39, Rubro 14, Anil 14 regiões; difícil dizer onde acaba um e começa o outro).
- **Reproduzir**: Nova partida → Personalizar → 4× → Jogar; tocar "−" até desabilitar.

### P2 — Janela do mapa pequena e sem visão geral (alta)

- **Medido** (escala 1, início): Pixel 7, caixa 392×314–334 px, **24–39 de 96 regiões à vista** (25–40%);
  360×640, caixa 340×217 px, **24–35 de 96** (25–36%). O painel "Dividir o ouro" ocupa a metade de baixo o tempo
  todo, mesmo quando o jogador só quer olhar o mapa.
- Não há minimapa nem botão de "visão geral"; os selos de borda dizem a direção dos rivais, mas não o tamanho
  deles, nem onde estão as regiões livres, nem onde está a frente de batalha.
- **Evidência**: 📷 `inicio-small-4x.png`, `jogo-small-4x-era20.png` (era 20: 16 regiões suas, só ~22 regiões à
  vista), `inicio-pixel7-4x.png`.

### P3 — Achar a próxima ação (alta)

- **Medido** jogando o 4× com 3 rivais no 360×640 até a vitória (29 eras): a partir da era 14, **5–6 dos 10–12
  alvos possíveis ficavam fora da janela**; 34 conquistas; **7,6 toques por era** contra 5,8 no Original (sem contar
  os arrastos, que um jogador real faz para procurar alvos; o robô usou 20 "saltos" de foco).
- Não existe lista de alvos nem "próximo alvo"; o jogador precisa varrer o mapa com o dedo procurando o selo de
  espadas, que no modo afastado tem ~8 px.
- **Evidência**: 📷 `jogo-small-4x-era15.png`, `jogo-small-4x-era20.png`; registro: "era 16: targets 12 (fora da
  tela 6)".

### P4 — Turno das IAs sem localização (média)

- O resumo da era lista "▲ Rubro +2 regiões · cresceu longe de você", uma linha por rival, **sem dizer onde** e sem
  atalho "ver no mapa". O mapa não marca as regiões que mudaram de dono na última era. Guerras entre rivais não
  aparecem. Quando um rival toma uma região sua fora da tela ("Rubro tomou X"), o jogador precisa procurar X.
- Com 3 rivais as linhas "cresceu longe de você" aparecem quase toda era e viram ruído.
- **Evidência**: 📷 `resumo-pixel7-4x-era10.png`, `resumo-small-4x-era25.png`; código em `src/ui/report.js`
  (`eraChanges`, tipo `grow`) e `src/ui/map.js` (nenhuma classe de "mudou nesta era").

### P5 — Selos e botões por cima das regiões (média)

- Verificado com `elementFromPoint` no centro de cada região à vista, no início da partida: Pixel 7 — Velar,
  Aroeira (2×), Alcova, Cascalho (3×), Bétula, Espinho (4×) ficam **embaixo de + / −**; 360×640 — Fenda (2×),
  Quartzo, Cascalho (3×), Corisco (4×) ficam **embaixo de um selo de borda**. Jogando, o toque em regiões-alvo
  falhou 9 vezes porque um selo estava por cima.
- No **Pixel 7 2× totalmente afastado**, o mapa inteiro cabe, mas o canto de baixo à direita (onde começa o Rubro)
  fica embaixo dos botões; por isso o selo do Rubro aparece **por cima de Zênite** dizendo "fora da tela" para um
  império que está dentro da janela (📷 `afastado-pixel7-2x.png`). A margem para os botões (`ctrlW`) só vale
  quando o mapa é maior que a janela (`clampView` centraliza quando cabe).
- No zoom máximo (2) os selos ficam por cima de alvos (📷 `meio-pixel7-4x-era23-zoommax.png`: Rubro sobre Gralha,
  Anil sobre Rochedo).

### P6 — Desempenho do toque (média)

- Tocar numa região chama `renderMap()` (refaz os 96 botões e a arte SVG; `src/ui/map.js:103`) e fechar a folha
  chama de novo (`src/ui/sheets.js:14`). Nós no `#map`: **2.692 no 4×** contra 733 no Original.

  | Medida | Original | 4× |
  | --- | --- | --- |
  | `renderMap()` CPU normal / 6× mais lenta | 9 / 52 ms | 24 / **221 ms** |
  | Toque na região até o quadro seguinte (CPU 6×) | 134–165 ms | **364–403 ms** |
  | `renderAll()` (CPU 4× / 6×) | — / 66–105 ms | 102–128 / 181–209 ms |
  | Concluir a era (CPU 6×) | — | ~1,0 s |

- Arrastar continua leve (só `transform`), mas houve quadros de até 120 ms com CPU 4×. Num celular modesto, cada
  toque em região tem atraso perceptível (> 100 ms quebra a regra "feedback imediato").

### P7 — Alvos de toque pequenos com o mapa afastado (média)

- Tamanho mediano das regiões na escala mínima: Pixel 7 2× 48×58 · 3× 38×47 · **4× 32×39**; 360×640 2× 37×37 ·
  3× 32×32 · **4× 28×27** (px CSS ≈ dp). O toque ainda abre a folha de ataque nesse tamanho, então erros de toque
  levam à região vizinha.
- Selos de borda: 34×34 px (46 com a área extra `::before`); botões de zoom 44×44 (Pixel 7) e 44×38 com área extra
  em telas baixas. Todos abaixo dos 48 dp do projeto.

### P8 — Telas baixas: legenda e volta para casa (média)

- No 360×640 com 3 rivais a linha da legenda mostra só "★ Você · ▲ Rubro · ●" e corta o resto; Ocre e Anil não
  têm nome em lugar nenhum da tela (📷 `inicio-small-4x.png`, `jogo-small-4x-era20.png`).
- O botão "centralizar no seu império" é escondido (`.map-card.zoom-row #mapCenter{display:none}`); a volta depende
  do selo "Você", que só aparece quando **nenhuma** região sua está à vista. Com uma ponta do império na borda, não
  há como voltar ao centro dele com um toque.

### P9 — Ensinar a navegar (baixa)

- A dica "Arraste o mapa para ver o resto. Dois dedos ou + e − aproximam." aparece **uma vez por sessão** (não por
  instalação: volta sempre que o app abre), dura ~3 s e **cobre o cabeçalho** (era, menu, ouro)
  (📷 `inicio-pixel7-4x.png`). O "Como jogar" não fala de tamanho do mapa, arrastar nem pinça.

### P10 — Tela Nova partida (baixa)

- "Tamanho do mapa" é o 5.º item dentro de Personalizar, a ~970 px de rolagem no 360×640
  (📷 `setup-small-4x-1rival.png`, `setup-pixel7-4x.png`). O padrão Original está certo; o problema é que "2×" não
  diz se é área ou lado e **não há duração estimada** (o próprio `docs/decisoes.md` mede ~12 min no Original e
  ~26 min no 4× com 3 rivais). "Mapa: Padrão/Sorteado" e "Tamanho do mapa" ficam separados, embora sejam o mesmo
  assunto.

### P11 — Gestos (baixa)

- Uma pinça curta (dedos aproximando ~100 px) já vai do zoom 1 ao mínimo; não há duplo toque para aproximar (o
  gesto que o jogador de Android espera em mapas). O zoom máximo 2 mostra só ~6 regiões e piora a sobreposição dos
  selos; acima de ~1,5 serve pouco.

### P12 — Celular deitado (baixa, já existia)

- Em qualquer tamanho (inclusive o Original) a legenda fica por cima da barra "Concluir era" e a página rola 44 px
  (📷 `inicio-land-1x.png`, `inicio-land-4x.png`). No mapa grande, como a caixa do mapa tem `touch-action:none`,
  arrastar sobre o mapa não rola a página, e o mapa ocupa quase toda a altura. O jogo é pensado em retrato; registro
  para quando o deitado entrar no escopo.

### P13 — Começo longo e vazio no 3×/4× (média, game-designer)

- 4× com 3 rivais: nas primeiras 12 eras o jogador ganha ~1 região livre por era; o primeiro contato com rival veio
  por volta da era 13–14. Até lá a decisão de cada era é quase sempre a mesma (atacar a região livre mais barata).
  Com 30 eras (o padrão), a partida 4× terminou na era 29 por supremacia. `docs/decisoes.md` já lista "partidas 4×
  passam de 20 minutos" como pendência.

## Melhorias propostas (por prioridade)

Esforço: **P** = até meio dia · **M** = 1–2 dias · **G** = 3+ dias. As marcadas com "aprovação" mudam a tela de
forma visível e precisam de OK do usuário (com captura ou protótipo) antes de começar.

### Só interface (mobile-ux; não mexe em regras nem números)

| # | Melhoria | Resolve | Impacto esperado | Esforço | Arquivos |
| --- | --- | --- | --- | --- | --- |
| 1 | **Visão geral com donos** (aprovação): no modo afastado, pintar cada região com a cor do dono (lisa para você, listrada para rivais, como as fronteiras) por cima do terreno esmaecido; um símbolo grande + nome do império no centro de cada bloco; espadas dos alvos maiores. | P1 | Jogador entende o mapa todo num olhar; base para o minimapa. | M | `styles/game.css` (`.map-box.far`), `src/ui/map.js` (camada de donos no `mapArt`), `src/ui/mapview.js` |
| 2 | **"Próximo alvo"**: botão na linha do mapa com o número de alvos ("⚔ 12") que, a cada toque, leva o mapa até o próximo alvo (ordenado por chance ou custo) e abre a folha; setas pequenas na borda para alvos fora da tela. | P3 | Menos arrastos; próxima ação em 1 toque. | M | `src/ui/mapview.js`, `src/ui/map.js`, `index.html`, `styles/game.css` |
| 3 | **O que mudou nesta era**: marcar no mapa as regiões que mudaram de dono (contorno pulsando uma vez + ícone ⚑/⚔ na cor do novo dono, até o fim da era seguinte; fixo com "reduzir movimento"); no resumo da era, cada linha com "Ver" que fecha o resumo e centraliza ali; "Rubro +2 regiões" vira "Rubro tomou [região] e [região]", com os nomes (juntar rivais numa linha só quando não envolvem você). | P4 | O turno das IAs passa a ser visto, não só lido. | M | `src/ui/report.js`, `src/ui/map.js`, `src/ui/mapview.js`, `styles/game.css` |
| 4 | **Controles e selos sem cobrir regiões**: reservar a faixa dos botões também quando o mapa cabe na janela; considerar "visto" um império com região embaixo dos botões; selos numa moldura de 40 px fora da área tocável do mapa (ou semitransparentes e que deixam passar o toque para a região quando a região é alvo); selos e botões com 48 dp. | P5, P7 (parte) | Acaba o toque "engolido" e o selo falso do 2×. | P | `src/ui/mapview.js` (`clampView`, `updateEdges`), `styles/game.css` |
| 5 | **Toque sem redesenhar tudo**: escolher/desmarcar região só troca classes (`.selected`, escurecer o resto) em vez de `renderMap()`; guardar a arte SVG do mapa e só refazer quando os donos mudam. | P6 | Toque < 100 ms mesmo no 4× em celular modesto; menos bateria. | M | `src/ui/map.js`, `src/ui/sheets.js` |
| 6 | **Toque no modo afastado aproxima** em vez de abrir a folha (abre a folha só na escala ≥ 0,7); **duplo toque** aproxima/afasta; pinça menos sensível; zoom máximo 1,5. | P7, P11 | Menos toques errados em regiões de 28–39 px. | P | `src/ui/mapview.js` |
| 7 | **Minimapa / "Visão geral"** (aprovação): miniatura (~96×64) num canto com o retângulo da janela; tocar leva até lá. Em telas baixas, alternativa: botão "Mapa inteiro" que abre o mapa afastado (já com a melhoria 1) em tela cheia por cima do painel. | P2 | Orientação permanente; substitui parte dos selos. | M | `src/ui/mapview.js`, `src/ui/map.js`, `index.html`, `styles/game.css` |
| 8 | **Mais espaço para o mapa** (aprovação): nos mapas grandes, o painel "Dividir o ouro" vira gaveta recolhível (aberta por padrão no início da era, recolhida ao tocar no mapa) para a janela passar de ~314 para ~560 px no Pixel 7. | P2, P3 | Vê-se o dobro de regiões; menos arrastos. | G | `index.html`, `styles/game.css`, `src/ui/allocation.js`, `src/ui/mapview.js` |
| 9 | **Telas baixas**: legenda só com símbolos coloridos que abrem a lista dos impérios (nome, regiões, toque = ir até ele); manter o botão "centralizar" (pode ficar no lugar do "ⓘ", com "Terrenos" dentro da lista). | P8 | Rivais identificados; volta para casa em 1 toque. | P | `styles/game.css`, `src/ui/mapview.js` (`placeControls`), `src/ui/map.js` (`markLegend`) |
| 10 | **Ensinar a navegar**: dica uma vez por instalação (gravar no armazenamento), em balão dentro da caixa do mapa (não por cima do cabeçalho), que some no primeiro arrasto; seção "Mapas grandes" no Como jogar (arrastar, pinça, selos, centralizar). | P9 | Primeira partida grande entendida sem ler o README. | P | `src/ui/mapview.js`, `src/ui/panels.js`, `index.html` |
| 11 | **Nova partida**: juntar "Mapa" e "Tamanho" num campo só; mostrar a duração estimada ("Original · ~12 min", "4× · ~25 min"); trocar "2×" por "2× · 48 regiões" na mesma linha; no resumo do rodapé, "mapa 4× (96)". | P10 | Escolha consciente do tamanho e do tempo de jogo. | P | `index.html`, `src/ui/home.js` |
| 12 | **Resultado com o mapa final** em miniatura (quem ficou com o quê). | — | Fechamento mais satisfatório nas partidas longas. | P–M | `src/ui/panels.js`, `src/ui/map.js` |
| 13 | **Celular deitado**: layout em duas colunas (mapa à esquerda, painel à direita). | P12 | Joga-se deitado sem sobreposição. | G | `styles/*.css`, `index.html` |

### Jogabilidade e equilíbrio (dependem do game-designer)

| # | Proposta | Resolve | Impacto esperado | Esforço | Arquivos |
| --- | --- | --- | --- | --- | --- |
| G1 | **Encurtar o começo vazio do 3×/4×**: começar com um pequeno grupo de regiões (ex.: 1 + (k−1)) ou tornar as regiões livres mais baratas de tomar nos mapas grandes (ex.: defesa das livres ÷ √k), ou ataques a regiões livres fora do multiplicador das ordens extra. | P13, P3 | Contato com rivais mais cedo; menos eras repetitivas; partida 4× abaixo de 20 min. | M | `src/core/config.js`, `src/core/military.js`, `src/core/state.js`, `src/core/map.js` |
| G2 | **Duração padrão por tamanho**: ao escolher 3×/4×, sugerir 40–50 eras ou Sem limite (aviso com atalho, como o dos rivais), ou explicar que com 30 eras a partida tende a acabar por pontos. | P10, P13 | Expectativa certa sobre como a partida termina. | P | `src/ui/home.js`, `src/core/config.js` |
| G3 | **Rivais recomendados como padrão** ao escolher o tamanho (hoje é só aviso): ao tocar em 4×, já marcar 3 rivais se o jogador não mexeu no número. | P10 | Menos partidas 1×1 no 4× (que o próprio balanceamento chama de repetitivas: 72–95 ordens). | P | `src/ui/home.js` |
| G4 | **Expandir em lote** (botão "Expandir: atacar as N livres mais baratas"): usa as mesmas regras e custos de hoje, mas muda o ritmo e a estratégia; o game-designer decide se cabe. | P3 | Menos toques na fase de expansão. | M | `src/ui/map.js`, `src/core/military.js` (só leitura) |
| G5 | Pendências já registradas: Construtor fraco com 3–5 rivais e Científico no 4× com 5 rivais. | — | — | — | `src/ai/*`, `src/core/*` |

### Ordem sugerida

1. Melhoria 4 (selos e botões, **P**) e 6 (toque afastado/duplo toque, **P**): ganhos rápidos, sem mudança visível
   grande.
2. Melhoria 1 (visão geral com donos, **M**, aprovação) e 5 (desempenho, **M**).
3. Melhoria 2 (próximo alvo, **M**) e 3 (o que mudou nesta era, **M**).
4. Melhorias 9, 10 e 11 (**P**) e, com o game-designer, G1–G3.
5. Melhorias 7 e 8 (minimapa e gaveta, aprovação) depois de ver como ficou a visão geral; 12 e 13 por último.
