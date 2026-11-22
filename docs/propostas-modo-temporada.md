# Propostas de "modo temporada" para o Impérios

*game-designer · 22/11/2026 · proposta para o usuário decidir. Nenhuma regra, número ou arquivo do jogo foi alterado.*

## 1. Resumo

- **Objetivo:** dar ao jogador motivos para voltar todo dia e toda semana, sem internet, sem conta e sem nada que dê
  vantagem a quem paga ou a quem joga mais (só prêmios de honra, como as medalhas aprovadas em 20/11/2026).
- **Propostas (5):** A. *Estações de Decretos* (regra da semana) · B. *Desafio do Dia* (partida igual para todos, criada a partir da
  data) · C. *Rota dos Rivais* (campanha curta da temporada) · D. *Escada de Glória* (títulos da temporada) ·
  E. *Corridas Curtas* (vitórias por Ciência ou Obras em 15 eras).
- **Recomendação:** começar pela **A, junto com a D** (a Glória é o "placar" da temporada), com a **Temporada 1 —
  "Terra Viva"**: as regras da temporada usam o que já existe (**terrenos com efeito + mapa sorteado**) e há
  3 decretos simples, que se revezam por semana. A **B** fica para a fase 2; a **C**, para a Temporada 2; a **E** precisa de uma rodada
  própria de balanceamento (os números mostram que é instável).
- **O que as simulações mostram** (cerca de 75 mil partidas, semente fixa): os 3 decretos da Temporada 1 **mantêm a escada de dificuldade
  em ordem** nas partidas de 15 eras, **nenhuma estratégia fixa passa de 60%** de vitórias contra todos os estilos com
  2 rivais, a duração não muda (15 eras ≈ 7 min) e, nas partidas só de IAs, **a diferença entre o estilo que mais vence e o que menos vence
  cai de 41 para 20–23 pontos** com 4 impérios (efeito do "Terra Viva").
  Dois mutadores foram **reprovados** pelos números: "Muralhas +4" (no 1×1 o Difícil fica mais fácil que o Médio) e
  "Renascença" (o Científico passa a vencer 51% com 4 impérios).

## 2. O que o jogo já tem e que serve de base

| Peça | Onde | Como a temporada aproveita |
| --- | --- | --- |
| Regras por configuração (`DEFAULTS`) e por partida (`state.*`) | `src/core/config.js`, `src/core/state.js` | A maioria dos mutadores é só **mudar um número** na configuração da partida |
| Terrenos com efeito, mapa sorteado, Ritmo Rápido, tamanhos de mapa, Grande Descoberta/Maravilha (com opção para ligar no Original) | `src/core/terrain.js`, `src/core/endgame.js` | Regras de temporada **já prontas e balanceadas** |
| Semente por partida (`state.rngSeed`) e sorteio determinístico (`rand`) | `src/core/rng.js`, `src/app/session.js` | Desafio do Dia: a **mesma partida para todos** a partir da data |
| 12 medalhas lidas do estado da partida | `src/app/medals.js` | Os desafios da temporada usam **o mesmo tipo de critério** (lido do estado) |
| Gravação local por versão (`imperios-jogador-medalhas`) | `src/platform/storage.js` | Progresso da temporada numa chave própria (`imperios-jogador-temporada`) |
| Save com tudo o que define a partida | `src/app/save.js` | O decreto fica **gravado na partida**: quem fecha o app retoma com a mesma regra, mesmo depois que a semana vira |

**Como o jogo está hoje (Médio, 15 eras, mapa Original):** jogador-IA Adaptativo vence 75% contra 1 rival e 36% contra 3; 96–98%
das partidas de 15 eras terminam **por pontos na última era**. Nas partidas de 15 eras só de IAs, os estilos de economia
quase não vencem (com 4 impérios: Equilibrado 6%, Científico 3%, Construtor 0%; Adaptativo 50%, Militar 45%). Por isso os
**desafios** da temporada devem premiar também outros jeitos de jogar (ex.: "termine com Ciência como maior fatia"),
e não só vencer.

## 3. Como foi medido

- Programa próprio (fora do jogo) que importa as regras de `src/core` e `src/ai` no Node e joga partidas completas com
  as regras atuais. Semente base `SEED` = 74291, com `fixedGameSeed(SEED, n)` → resultados reproduzíveis.
  Programas: `/tmp/claude-0/-home-user-Era-Empires/c9abb45f-b618-582f-bcb7-5ac4f9ab2df3/scratchpad/sim.mjs` (motor dos mutadores), `exp1.mjs`, `e15.mjs`,
  `ladder.mjs`, `strat.mjs`, `boss.mjs`, `daily.mjs`, `daily2.mjs`, `cal.mjs` (mesma pasta). A impressão digital não foi
  comparada (o Node dá códigos diferentes do navegador, como avisa `tests/internal-node.test.js`).
- **Jogador-IA**: o lugar do jogador fica "humano" (para valerem a receita da dificuldade e o reflexo de defesa dos rivais), mas
  quem decide é a IA: **Adaptativo** (jogador atento) ou **Equilibrado** (aproximação de um **iniciante**: divide igual
  e ataca quando pode).
- **Estratégias fixas**: as do laboratório (`balanced`, `military`, `aggressive`, `infrastructure`, `technology`,
  `growth`, `techFirst`) contra **2 rivais** de cada estilo (no 1×1 várias estratégias passam de 60% já hoje — pendência
  conhecida). "Pior caso" = taxa de vitória contra o estilo de rival mais difícil para aquela estratégia; se o pior caso passa de 60%, a estratégia domina.
- **Só IAs**: os 6 estilos revezando os lugares; "faixa" = diferença entre o estilo que mais vence e o que menos vence.
- **Eventos por era** (Colheita, Inverno) ainda não existem no jogo: foram aplicados pelo programa ao fim da era
  indicada (o bônus chega antes das decisões da era seguinte). Seria o mesmo comportamento se forem implementados.
- Amostras: 240–300 partidas por linha (estratégias: 40 por estilo de rival na tabela geral e 120 na confirmação).
  Margem de erro de ±3 a ±8 pontos.

## 4. Catálogo de mutadores medidos

Médio, mapa Original. Colunas: jogador-IA Adaptativo (% de vitórias) · duração média (30 eras, 1 rival) · estratégia
fixa com o melhor pior caso (30 eras, 2 rivais; meta ≤ 60) · faixa entre estilos só de IAs (30 eras; 2 e 4 impérios)
· vitórias por estilo com 4 impérios (Equil./Militar/Agress./Científico/Construtor/Adapt.).

| Mutador (regra) | 15 eras: 1 / 3 rivais | 30 eras: 1 / 2 rivais | Duração | Estratégia mais forte (pior caso) | Faixa 2 / 4 | Estilos com 4 impérios |
| --- | --- | --- | --- | --- | --- | --- |
| **Jogo de hoje** | 75 / 36 | 66 / 14 | 26,6 | Agressiva 50 | 58 / 41 | 26/15/26/33/3/44 |
| Era de Ouro (orçamento 180, ouro por região 26) | 68 / **18** | 61 / 19 | 24,8 | Equilibrada 48 | 65 / 32 | 38/19/20/29/6/35 |
| Muralhas +4 (defesa das regiões com dono 8 → 12) | 75 / 32 | 63 / 24 | 26,9 | Agressiva 33 | 56 / 38 | 30/14/19/40/3/41 |
| Fronteiras firmes +2 (8 → 10) | 75 / 34 | 61 / 21 | 26,8 | Agressiva 38 | 52 / 39 | 26/16/20/37/4/43 |
| Guerra relâmpago (custo de conquista 5 → 3) | 68 / 23 | 66 / 18 | 25,0 | Agressiva 48 | **78** / 34 | 32/16/28/28/5/39 |
| Exército fiel (desgaste 20% → 10%) | 73 / 25 | 67 / 18 | 26,6 | **Agressiva 63** | 64 / 34 | 29/16/24/31/7/41 |
| Renascença (Ciência rende 1 era mais cedo) | 68 / 30 | 55 / 16 | 26,2 | Agressiva 48 | **74 / 51** | 39/12/15/**51**/0/33 |
| Obras duradouras (12 → 16 eras) | 75 / 36 | 63 / 16 | 26,7 | Agressiva 48 | 57 / 41 | 25/16/24/33/3/44 |
| Saque farto (teto 20% → 35%) | 75 / 35 | 67 / 14 | 26,2 | Agressiva 58 | 66 / 45 | 23/15/30/31/3/48 |
| Prosperidade (ouro por região +2% por era) | 76 / 35 | 65 / 30 | 24,2 | Agressiva 50 | 71 / 46 | 19/31/34/18/**0**/46 |
| Ritmo Rápido | 69 / 28 | 64 / 22 | 24,9 | **Agressiva 68** | 60 / 37 | 34/18/24/35/1/38 |
| Colheitas (eras 5 e 10: +40 de ouro para todos) | 74 / 31 | 61 / 17 | 26,5 | Agressiva 58 | 59 / 40 | 26/13/25/43/3/39 |
| Inverno (eras 6 e 12: todos perdem 30% da Força) | 77 / 39 | 65 / 20 | 26,4 | Agressiva 45 | 70 / 43 | 19/16/26/38/3/46 |
| Grande Descoberta no Original (meta 6000) | 75 / 36 | 66 / 14 | 26,6 | Agressiva 50 | 58 / 41 | 27/14/28/33/3/44 |
| Maravilha no Original, meta 1500 | 75 / 36 | 63 / 12 | 26,6 | Agressiva 50 | 57 / **29** | 26/14/19/40/**11**/36 |
| Maravilha no Original, meta 1000 | 75 / 36 | 62 / 11 | 26,4 | Agressiva 43 | **37 / 29** | 24/14/18/43/**15**/34 |
| Duas corridas (Descoberta 3000 + Maravilha 1500) | 75 / 36 | 64 / 12 | 26,6 | Agressiva 50 | 56 / 32 | 26/10/16/38/14/42 |
| **Terra Viva** (terrenos com efeito + mapa sorteado) | 72 / 30 | 46 / 22 | 24,6 | Equilibrada 53 | 53 / **18** | 34/21/23/16/**20**/34 |
| Terra Viva + Colheitas | 71 / 28 | 48 / 23 | 24,5 | Equilibrada 57 * | 48 / 23 | 37/21/18/14/26/33 |
| Terra Viva + Inverno | 69 / 31 | 49 / 26 | 24,8 | Equilibrada 53 * | 47 / 20 | 36/28/19/16/18/33 |
| Terra Viva + Fronteiras +2 | 72 / 28 ** | 47 / 23 ** | 24,7 ** | Equilibrada 50 * | 58 / 23 | 38/24/23/18/15/32 |

\* Confirmado com 120 partidas por estilo de rival (na tabela geral, Terra Viva + Colheitas deu 63 com 40 partidas; com 120 dá 57).
\*\* Medido com Muralhas +4 junto com Terra Viva (com +2 a diferença é ainda menor).

O que se tira daqui:
- **As corridas (Grande Descoberta/Maravilha) não fazem diferença em partidas de 15 eras**, com qualquer meta medida (Descoberta 600–1500, Maravilha
  300–800): numa partida de 15 eras o Científico investe ~970 de ouro em Ciência (≈ 194 pontos) e o Construtor ~1.125 em
  Obras (≈ 225 pontos). Em 30 eras, a **Maravilha com meta 1000–1500** é o mutador que mais ajuda o Construtor no Original
  (3% → 11–15%) — boa candidata para uma temporada "de Obras" com partidas de 30 eras.
- **Reprovados:** Renascença (o Científico domina), Exército fiel e Ritmo Rápido como regra da semana (a estratégia
  Agressiva passa de 60%), Guerra relâmpago e Prosperidade (faixa entre estilos de 71–78 no 1×1; o Construtor some).
- **Era de Ouro** deixa 3 rivais muito mais duros (36% → 18%): só serviria com dificuldade menor.

## 5. As cinco propostas

### A. Estações de Decretos (recomendada, com a D)
- **Ideia:** cada temporada tem um tema e **regras de temporada** fixas; a cada semana entra em vigor um **decreto**
  (um mutador simples), anunciado na tela inicial ("Decreto da semana: Colheita farta").
- **Regras:** partida da temporada = 15 eras, Médio sugerido (o jogador pode mudar dificuldade e rivais), regras de temporada
  + decreto da semana. O modo normal continua idêntico (impressões digitais 39190b06 / 5c97e2c2 intactas).
- **Progressão:** **3 desafios por semana** (ex.: "vença com 2 rivais", "tome 2 regiões de Montanha", "termine com
  Ciência como maior fatia") + **6 desafios da temporada**. Cada um dá Glória (ver D).
- **Recompensas (só de honra):** padrões de bandeira, moldura do brasão, título no resultado ("Senhor das Colheitas"),
  um selo de temporada na tela Medalhas. Nada muda regras.
- **Por que o jogador volta:** semanal (decreto novo + 3 desafios), por temporada (trilha de 20 marcos com bandeira final),
  diário (bônus da primeira vitória do dia — ver D).
- **Duração:** temporada de **8 semanas** (4 decretos × 2 voltas) + 1 semana de "reprise" com todos os decretos liberados.
- **Implementação offline:** tabela de temporadas **embutida no app** (datas de início e fim em data local); semana = número de
  dias desde o início ÷ 7; nada de servidor. Decretos que só mudam números (Fronteiras +2) entram como mudança na configuração da partida;
  eventos (Colheita/Inverno) pedem um gancho pequeno no começo da era (`beginEra`) que só roda quando a partida tem
  `state.season`. O save grava `state.season = {id, semana, decreto}`. **Esforço: médio** (~1 módulo `src/app/season.js` sem
  DOM, 1 tela "Temporada" no estilo Atlas, testes novos; os 159 testes internos continuam como estão).

### B. Desafio do Dia
- **Ideia:** uma partida por dia, **igual para todos os aparelhos**: mapa, rivais, decreto e semente de batalha saem de
  um código gerado a partir da data local (AAAA-MM-DD). Ex.: "Desafio de 14/03 — 2 rivais (▲ Rubro · Militar,
  ● Ocre · Construtor), mapa sorteado, Inverno".
- **Regras:** 15 eras, Médio, **1 tentativa oficial** (o resultado fica no calendário) e tentativas de treino sem limite.
  Dificuldade sobe pela semana: seg–qua 1 rival, qui–sáb 2, dom 3.
- **Progressão/recompensas:** calendário do mês com o resultado de cada dia; sequência de dias jogados; recorde pessoal
  de pontos; texto para compartilhar (sem rede: "Impérios · Desafio 14/03 · Vitória na era 15 · 9 regiões").
- **Por que o jogador volta:** diário (é o ciclo mais forte para retenção).
- **Medido** (120 dias simulados, 12 sementes por dia):

  | Regra do sorteio | Rivais | Jogador atento (Adaptativo) | Iniciante (Equilibrado) | Dias "impossíveis" (atento < 15%) | Dias "triviais" (iniciante > 85%) |
  | --- | --- | --- | --- | --- | --- |
  | Estilos livres | 1 / 2 / 3 | 70 / 51 / 27% | 43 / 22 / 3% | 0 / 6 / **29%** | 10 / 0 / 0% |
  | **No máximo 1 rival forte** (Militar, Agressivo ou Adaptativo) | 1 / 2 / 3 | 70 / 64 / 40% | 43 / 33 / 12% | 0 / 0 / 12% | 10 / 2 / 0% |

  Com a regra "no máximo 1 rival forte", o domingo fica desafiador sem ser injusto; os 12% restantes pedem ainda um
  filtro (ex.: refazer o sorteio se a região inicial do jogador tiver 2+ Montanhas/Pântanos vizinhos).
- **Duração:** contínua. **Esforço: médio** (gerador determinístico + calendário; cuidado com fuso e relógio).

### C. Rota dos Rivais (campanha da temporada)
- **Ideia:** 6 a 8 batalhas em sequência contra os rivais com nome, cada um com seu estilo, terminando num "chefe"
  (ex.: ■ Violeta, a Imperatriz Adaptativa). Cada etapa libera a próxima; até 3 estrelas por objetivo.
- **Ordem sugerida pelos números** (jogador × 1 rival, 15 eras, % de vitórias Atento / Iniciante):

  | Rival (estilo) | Médio | Difícil |
  | --- | --- | --- |
  | Construtor | 96 / 85 | 97 / 84 |
  | Científico | 94 / 78 | 93 / 64 |
  | Equilibrado | 83 / 49 | 79 / 27 |
  | Militar | 57 / 17 | 33 / 10 |
  | Agressivo | 55 / 13 | 32 / 9 |
  | **Adaptativo (chefe)** | 53 / 19 | 50 / 7 |

  (Com Terra Viva os números são parecidos; o Adaptativo fica mais duro: 37 / 14 no Médio e 27 / 8 no Difícil.)
  A escada natural é Construtor → Científico → Equilibrado (Médio) → Militar → Agressivo (Médio) → Adaptativo (Difícil).
  Atenção: para um iniciante, o salto do Equilibrado (49%) para o Militar (17%) é grande — dá para pôr uma etapa
  intermediária (Militar no Fácil) ou dar estrelas por objetivos que não exigem vencer.
- **Por que o jogador volta:** uma etapa nova liberada por semana (por data) dá um motivo semanal; as estrelas fazem o jogador repetir etapas.
- **Duração:** uma temporada (8 semanas). **Esforço: médio-alto** (cenários iniciais montados à mão, textos, tela de
  campanha; reaproveita `newState` + `aiAvoid`/posições do tutorial).

### D. Escada de Glória (títulos da temporada)
- **Ideia:** toda partida rende **Glória**; a Glória sobe o jogador por títulos de temporada (Aldeão → Senhor → Rei →
  Imperador → Lendário), que **voltam ao início** a cada temporada; o melhor título fica guardado como honra permanente.
- **Regras sugeridas:** terminar uma partida 10; vitória +20 × peso da dificuldade (Muito fácil 0,5 · Fácil 0,75 · Médio 1
  · Difícil 1,5 · Lendário 2); desafio semanal +30; **primeira vitória do dia em dobro** (premia voltar no dia seguinte, sem
  limitar quem quer jogar mais). Laboratórios e "Configurações" não rendem Glória (como as medalhas).
- **Por que o jogador volta:** diário (bônus) + temporada (título). **Esforço: baixo** (contador local + faixa na tela
  de resultado).

### E. Corridas Curtas (temporada "das Maravilhas")
- **Ideia:** nas partidas de temporada de 15 eras, ligar a Grande Descoberta e a Maravilha **com metas curtas**, para que
  Ciência e Obras também possam vencer (hoje 96–98% das partidas de 15 eras terminam por pontos e os estilos de economia quase não vencem).
- **Medido (15 eras, só IAs, 4 impérios; jogador-IA com 2 rivais):**

  | Metas (Descoberta / Maravilha / regiões mínimas) | Faixa | Construtor | Científico | Finais por corrida | Jogador-IA, 2 rivais |
  | --- | --- | --- | --- | --- | --- |
  | Sem corridas (hoje) | 50 | 0% | 3% | 0% | 55% |
  | 160 / 180 / 3 | 41 | 43% | 24% | 45% | 32% |
  | 180 / 200 / 4 | 48 | 13% | 7% | 12% | 48% |
  | 200 / 220 / 3 | 55 | 1% | 1% | 1% | 50% |
  | 200 / 220 / 3 + Terra Viva | 54 | **58%** | 10% | 45% | 30% |

  **Muito instável:** pequenas mudanças na meta levam o Construtor de 1% para 43–58% (o +5/+10% de Obras dos terrenos já basta
  para ele passar da meta). Promissora (180/200/4 melhora o equilíbrio sem dominar), mas pede **uma rodada própria de
  balanceamento** e uma barra de progresso clara para o jogador. **Esforço: baixo no código** (a regra existe e tem
  opção para ligar no Original), **alto em balanceamento**. Sugestão: Temporada 3.

### Comparação

| | Ciclo diário | Ciclo semanal | Ciclo da temporada | Risco de balanceamento | Esforço |
| --- | --- | --- | --- | --- | --- |
| A. Decretos | bônus (via D) | **decreto + 3 desafios** | trilha + bandeira | baixo (medido) | médio |
| B. Desafio do Dia | **sim** | sequência | calendário | médio (sorteio filtrado) | médio |
| C. Rota dos Rivais | — | etapa nova | campanha | baixo | médio-alto |
| D. Glória | **bônus 1ª vitória** | — | **título** | nenhum | baixo |
| E. Corridas Curtas | — | — | tema | **alto** | baixo + balanceamento |

## 6. Recomendação: A + D primeiro, com a Temporada 1 "Terra Viva"

Por quê: dá ciclo semanal e de temporada já na primeira versão; as regras da temporada **já existem e já foram balanceadas** (terrenos
com efeito, mapa sorteado, +3% para os rivais no Médio com efeitos); os decretos são pequenos e foram medidos; e a temporada
mostra os terrenos com efeito — hoje escondidos em "Personalizar" — a quem nunca abriu essa opção.

### Temporada 1 — "Terra Viva" (8 semanas + 1 de reprise)
**Tema:** "A terra acordou: cada campo, mata e montanha muda a guerra." Arte: as 7 ilustrações de terreno que já existem
e uma bandeira de folhas como prêmio final.

**Regras da temporada (sempre ligadas):** terrenos com efeito + mapa sorteado + 15 eras. Dificuldade e rivais à escolha (o padrão é
Médio, 1 rival).

**Decretos (um por semana, em rodízio: 1-2-3-4-1-2-3-4):**

| Semana | Decreto | Regra | Código novo? |
| --- | --- | --- | --- |
| 1 e 5 | **Terra Viva** | só as regras da temporada | não |
| 2 e 6 | **Colheita farta** | eras 5 e 10: todos os impérios ganham +40 de ouro | gancho de evento |
| 3 e 7 | **Inverno rigoroso** | eras 6 e 12: todos perdem 30% da Força guardada | gancho de evento |
| 4 e 8 | **Fronteiras firmes** | regiões com dono +2 de defesa (`defenseOwned` 8 → 10) | só número |

Os eventos valem para **todos os impérios ao mesmo tempo** e são avisados uma era antes no resumo ("Na próxima era: Colheita
farta"), para o jogador poder se planejar.

**Números (15 eras, % de vitórias do jogador-IA; Muito fácil / Fácil / Médio / Difícil / Lendário):**

| Regras | Atento, 1 rival | Atento, 2 rivais | Iniciante, 1 rival | Iniciante, 2 rivais |
| --- | --- | --- | --- | --- |
| Jogo de hoje (Original, só visual) | 96/83/71/62/37 | 95/75/54/43/33 | 85/58/46/36/21 | 74/36/24/20/8 |
| Terra Viva | 96/81/67/57/39 | 92/75/50/35/17 | 88/65/42/36/20 | 79/44/23/15/8 |
| Terra Viva + Colheita farta | 97/85/69/51/36 | 93/68/52/32/15 | 87/65/46/35/22 | 79/45/27/16/7 |
| Terra Viva + Inverno rigoroso | 97/84/70/57/41 | 93/75/54/35/24 | 86/58/38/34/24 | 77/43/21/19/10 |
| Terra Viva + Fronteiras firmes | 96/81/67/60/40 | 92/76/50/40/20 | 88/65/42/38/22 | 79/44/23/16/8 |

- **Escada em ordem** em todos os decretos (cada nível mais difícil que o anterior, para o jogador atento);
  **Muito fácil vencível por iniciante** (86–88% com 1 rival, 77–79% com 2).
- Pontos de atenção: com "Fronteiras firmes" o Difícil fica perto do Médio no 1×1 (60 × 67); com 1 rival, o iniciante quase empata entre Médio e Difícil
  em todas as regras (42 × 36–38, como hoje: 46 × 36). **"Muralhas +4" ficou de fora** porque inverte a escada
  (Médio 71 × Difícil 76 no 1×1) e, nas partidas de 30 eras, até o +2 inverte (47 × 50): por isso a temporada é só de 15 eras.
- **Estratégias fixas** (2 rivais, pior caso): 15 eras, a mais forte é a Agressiva com 38–48% em todos os decretos;
  30 eras (confirmação, 120 partidas por estilo): Equilibrada 50–57%, Agressiva 41–58%. **Nenhuma passa de 60%.**
- **Só IAs (30 eras, 4 impérios):** faixa entre estilos 41 hoje → 18–23 com Terra Viva e os decretos; o Construtor
  sobe de 3% para 15–26%. Em 15 eras a vantagem do Militar/Adaptativo continua (pendência do jogo, não da temporada).
- **Duração:** 15 eras sempre; com 7–9 ordens de ataque por partida, ≈ **7 min** por partida (25 s por era + 5 s por
  ordem), dentro da meta de ~10 min. Desfecho: 95–97% por pontos na última era, 3–5% empate (igual a hoje).

**Desafios semanais (3 por semana; exemplos, todos lidos do estado da partida, como as medalhas):**
1. *Colono*: vença uma partida da temporada (qualquer dificuldade).
2. *Senhor das Campinas*: termine com 4 regiões de Campina ou mais.
3. *Guardião da Floresta / Mestre das Colinas*: repila 2 ataques em regiões de Floresta ou Colinas.
4. *Alpinista*: tome uma região de Montanha de um rival.
5. *Sábio do Pântano*: termine com Ciência como a maior fatia do que você investiu e pelo menos 1 Pântano.
6. *Celeiro cheio* (semanas de Colheita): tenha 300 de ouro ou mais guardado ao fim da era 10.
7. *Fogo no inverno* (semanas de Inverno): conquiste uma região na era 6 ou 12.
8. *Muro de pedra* (semanas de Fronteiras): termine sem perder nenhuma região.
9. *Dois fronts*: vença com 2 rivais ou mais.

**Desafios da temporada (6):** vença em cada um dos 4 decretos · vença no Difícil · conquiste regiões dos 7 terrenos
(em qualquer partida da temporada) · complete 12 desafios semanais · alcance o título "Rei" · vença por domínio do mapa.

**Recompensas (só de honra):** trilha de 20 marcos por Glória → 6 padrões de bandeira (folha, espiga, floco, torre,
montanha, onda), 2 molduras de brasão, título "Guardião da Terra Viva" na tela de resultado e o selo
"Temporada 1" na tela Medalhas. Quem perder semanas pode jogar os decretos passados na **semana de reprise**.

## 7. Como implementar sem servidor (para quando for aprovado)

1. **`src/app/season.js` (sem DOM):** tabela `SEASONS` embutida (id, nome, início/fim em data local, regras, decretos,
   desafios) e `seasonAt(data)`, `decreeAt(data)`. A semana conta pelos dias desde o início (sem depender de fuso).
2. **Partida:** `state.season = {id, semana, decreto}` gravado no save; as regras da temporada viram ajustes na configuração
   dessa partida (como já acontece com terrenos e `aiIncomeEffects`). Sem `state.season`, o jogo é **idêntico** ao
   de hoje (impressões digitais 39190b06 / 5c97e2c2 não mudam).
3. **Eventos:** um gancho no começo da era (`beginEra`), lido de `state.season.events` (`[{era:5, tipo:"ouro", valor:40}]`).
   Vale igual para as IAs; os laboratórios ganham a opção de ligar o gancho, para medir.
4. **Progresso:** chave `imperios-jogador-temporada` (e `-dev-`) via `src/platform/storage.js`; dados danificados =
   começar do zero, como as medalhas. Progresso **nunca é apagado** se o relógio voltar; a sequência de dias só conta datas novas.
   Mudar o relógio do aparelho permite adiantar decretos — aceitável num jogo offline com prêmios só de honra.
5. **Temporadas futuras:** a tabela pode já trazer as próximas 3–4 temporadas, que entram sozinhas por data; depois
   da última, as antigas voltam em reprise. Atualização na loja só para conteúdo novo.
6. **Testes:** testes novos para o rodízio por data, para os eventos e para o save com temporada; os 159 testes internos e as
   impressões digitais continuam iguais (o modo normal não muda).
7. **Play Store:** nada exige internet, conta ou permissão nova. **Notificações locais** ("O decreto da semana mudou")
   pediriam a permissão POST_NOTIFICATIONS no Android 13+ — fica para o usuário decidir. Sem monetização.

## 8. Decisões que ficam para o usuário

1. Aprovar a ordem **A + D → B → C → E**, ou outra.
2. Temporada 1 "Terra Viva": aprovar os 3 decretos (Colheita farta, Inverno rigoroso, Fronteiras firmes) e a duração
   (8 semanas + 1 de reprise).
3. Partidas de temporada **só de 15 eras** (recomendado; nas de 30 eras, "Fronteiras firmes" inverte Médio × Difícil no 1×1).
4. Glória com **primeira vitória do dia em dobro** (sem limite diário).
5. Notificações locais: sim ou não (permissão no Android 13+).
6. Pendências do jogo que aparecem também na temporada: nas partidas de 15 eras quase tudo termina por pontos e os estilos de
   economia vencem pouco; o Desafio do Dia de domingo (3 rivais) ainda tem ~12% de dias muito duros.
