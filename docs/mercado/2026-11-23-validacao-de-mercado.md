# Impérios — Como validar o potencial de mercado

**Data:** 23/11/2026 · **Autor:** analista de mercado (agente) · **Status:** proposta para o usuário decidir

> **Como ler os números.** Cada número tem fonte e data. **[Fato]** = publicado pela própria empresa, loja ou
> associação do setor. **[Estimativa]** = rastreador de terceiros (AppGoblin, Similarweb etc.) ou relatório de
> fornecedor, que pode errar ou estar desatualizado. **[Hipótese]** = o que queremos testar. **[Proposta]** =
> sugestão minha, ainda sem decisão.
>
> **Limite desta pesquisa:** nesta sessão só funcionou a busca na web. A leitura direta das páginas
> (support.google.com, substack etc.) foi bloqueada pela rede. Os números vêm dos trechos que a busca devolveu.
> Antes de usar um número para uma decisão com dinheiro, abra a fonte e confira.

---

## 1. Resumo e recomendação

- **Recomendação: validar em 4 fases baratas antes de gastar com anúncios.** As duas primeiras custam quase nada e
  podem começar já, com a versão web que existe hoje.
- **O sinal de mercado é bom, mas o segmento é de nicho.** Jogos de estratégia por turnos, curtos e sem anúncios têm
  público comprovado: Polytopia tem mais de 10 milhões de instalações na Play; Antiyoy, cerca de 7 milhões; Unciv,
  cerca de 3 milhões. O dinheiro grande da "estratégia 4X" no celular, porém, está em jogos online gratuitos com
  compras (Last War, Whiteout Survival), que são outro produto.
- **O maior risco não é falta de público. É ser descoberto.** Estratégia é a categoria da Play que menos converte
  visitas em instalações (6,6% nos EUA em 2025, segundo a AppTweak). "Impérios/Empires" é um nome muito comum.
- **Hoje o jogo não mede nada** (não tem telemetria e não faz nenhuma chamada de rede). Sem alguma medição, os
  números de retenção ficam impossíveis de obter. Há uma proposta com opções na seção 6.
- **O que o usuário decide agora:** se aceita medição (e de que tipo), o modelo de monetização a testar, o tipo de
  conta na Play e o orçamento do soft launch.

---

## 2. O que o Impérios é hoje e o que precisa ser validado

**Hoje (repositório, 23/11/2026):**
- Protótipo web em HTML/JS, publicado no GitHub Pages a partir do `index.html`. Ainda não existe app Android.
  O README cita `@capacitor/preferences` como plano.
- A cada era, o jogador divide o ouro entre Força, Obras e Ciência. O mapa tem 24 regiões (ou 2×, 3×, 4×) e
  7 terrenos (só visuais ou com efeitos). Há de 1 a 5 rivais de IA com estilos diferentes e 5 dificuldades.
- Partidas de 15 ou 30 eras, ou "Sem limite". Vitórias por domínio, eliminação, supremacia e pontos; nos mapas
  maiores, também Grande Descoberta e Maravilha.
- Tem tutorial e 12 medalhas. Funciona offline, sem conta e sem anúncios. Está em 6 idiomas (pt-BR, en, pt-PT,
  it, de, fr).
- **Duração estimada** de uma partida (cálculo do `game-designer`, não medido com pessoas): no mapa Original com
  1 rival, ~27 eras e **~12 min**; no 4× com 3 rivais, ~26 min (`docs/decisoes.md`, 22/11/2026).
- Não há telemetria nem chamadas de rede no código (`grep` em `src/` e `index.html`). A monetização não foi decidida.

**Hipóteses de mercado a validar [Hipótese]:**

| # | Hipótese | Por que importa |
|---|---|---|
| H1 · Público | Há adultos que gostam de estratégia/"Civ", mas não têm tempo para partidas de horas, e querem uma partida de 10–20 min no celular. | Define a mensagem da loja e onde procurar jogadores. |
| H2 · Proposta de valor | "Estratégia curta, offline, sem anúncios e sem conta" é um motivo forte para instalar e ficar. | É o diferencial contra Polytopia, RISK e os 4X gratuitos. |
| H3 · Entendimento | O jogador novo entende a divisão Força/Obras/Ciência em uma partida (com tutorial) e quer jogar outra. | Um sistema abstrato (sem unidades no mapa) pode parecer "planilha". |
| H4 · Retenção | Quem termina a primeira partida volta no dia seguinte e na semana seguinte (D1/D7 no nível do gênero ou acima). | Sem retenção, nenhum gasto com aquisição se paga. |
| H5 · Idiomas e mercados | O Brasil é o mercado inicial. en/de/fr/it/pt-PT trazem instalações suficientes para justificar as traduções. | Mostra onde fazer o soft launch e onde gastar em ASO. |
| H6 · Disposição a pagar | Uma parte dos jogadores paga um valor único (versão completa, mapas grandes, doação) por um jogo sem anúncios. | Mostra se o projeto se sustenta. **A decisão de monetização é do usuário.** |
| H7 · Descoberta | A página da loja converte visitas em instalações a pelo menos o nível médio da categoria Estratégia. | Estratégia já é a categoria que menos converte. |

---

## 3. Panorama do mercado

### 3.1 Celular no mundo e estratégia

| Dado | Valor | Fonte e data | Tipo |
|---|---|---|---|
| Receita de jogos de celular (compras no app), 2025 | ~US$ 82 bi; +1% a +1,4% no ano | Sensor Tower, *State of Gaming 2026* (fev/2026) — [comunicado](https://sensortower.com/press/press-release-sensor-tower-state-of-gaming-gaming-drove-52-billion-downloads-82b-iap-revenue-on-mobile-and-12b-premium-revenue-on-steam), [resumo](https://www.globalgamesforum.com/news/state-of-gaming-heres-what-the-mobile-data-actually-says) | Estimativa (fornecedor) |
| Downloads de jogos de celular, 2025 | ~50 bi, **−7%** no ano | Sensor Tower, mesmo relatório | Estimativa |
| Estratégia em 2025 | Foi a única categoria que cresceu em receita, downloads e tempo de jogo, puxada pelos 4X gratuitos e online | Sensor Tower, mesmo relatório | Estimativa |
| Estratégia no 1º semestre de 2025 | US$ 10,6 bi, 24% dos gastos em jogos de celular | AppMagic, via [PocketGamer.biz](https://www.pocketgamer.biz/strategy-games-surge-as-rpg-revenue-tumbles-h1-2025s-top-genres-revealed) | Estimativa |
| Concentração | Os 50 maiores jogos ficaram com ~80% do crescimento; o resto do mercado, somado, caiu | Análise crítica em [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/seven-things-the-2025-state-of-gaming-report-actually-tells-us) | Opinião de analista |
| Jogos pagos (premium) | Lançamentos premium **+77%** em 2025 (~750 jogos); os gratuitos ainda são ~96% dos downloads | AppMagic via GamesIndustry.biz/[GameDev.net](https://gamedev.net/news/4367/); [Pocket Tactics](https://www.pockettactics.com/premium-mobile-games-increase) | Estimativa (mede oferta, não demanda) |

**O que isto quer dizer para o Impérios:** a "estratégia" que cresce em dinheiro é a dos jogos online gratuitos com
compras pesadas. O Impérios não compete nesse segmento. O subnicho do Impérios é o de estratégia por turnos offline
(Polytopia, Antiyoy, Unciv). Ele tem milhões de instalações, mas receita modesta. A volta dos jogos premium e as
reclamações contra monetização agressiva (veja Polytopia na seção 4) ajudam a proposta "sem anúncios". Ainda assim,
é nicho.

### 3.2 Brasil (mercado inicial)

| Dado | Valor | Fonte e data | Tipo |
|---|---|---|---|
| Brasileiros que jogam | 82,8% (PGB 2025) → **75,3%** (PGB 2026) | Pesquisa Game Brasil, via [Mobile Time](https://www.mobiletime.com.br/noticias/26/03/2025/pesquisa-pgb-jogos) e [Omelete](https://www.omelete.com.br/games/pesquisa-game-brasil-2026-ia-jogos) | Fato (pesquisa) |
| Celular como plataforma principal | **44,1%** (PGB 2026), contra PC 21,1% e console 24% | PGB 2026, via [Omelete](https://www.omelete.com.br/games/pesquisa-game-brasil-2026-ia-jogos) | Fato (pesquisa) |
| Estratégia entre os gêneros preferidos | 37,3% (várias respostas possíveis) | PGB 2022, via [Forbes Brasil](https://forbes.com.br/forbes-tech/2022/10/gamers-brasileiros-preferem-consoles-a-celulares-aponta-pesquisa/) (dado antigo) | Fato antigo |
| Gasto mensal | 34,6% gastam de R$ 51 a R$ 200 por mês com jogos | PGB 2025, via busca | Fato (pesquisa); sem recorte por gênero |
| Jogadores (Newzoo) | ~115 mi | Via [Allcorrect](https://allcorrectgames.com/insights/brazil/) | Estimativa de segunda mão |
| Receita só de celular, 2025 | ~US$ 640 mi | Statista/Allcorrect (previsões) | **Estimativa fraca**; as fontes divergem |

### 3.3 Mercados dos outros idiomas

| Mercado | Dado | Fonte e data | Tipo |
|---|---|---|---|
| Alemanha (de) | Celular: **€ 2,7 bi** em 2025 (+3%); **28,1 mi** de jogadores; 97% da receita vem de compras no app; idade média 38,8 anos | game – associação alemã ([game.de](https://www.game.de/en/mobile-games-germany-2026/), 06/07/2026) | Fato (associação; base Sensor Tower, com mudança de método em 2025) |
| França (fr) | Celular: € 1,6 bi em **2024**; 40 mi de jogadores (todas as plataformas, 2025) | Statista citando SELL; [SELL, *L'Essentiel du jeu vidéo*](https://sell.fr/sites/default/files/essentiel-jeu-video/ejv_avril_2026_def-en.pdf) (abr/2026) | Fato / estimativa |
| Itália (it) | Smartphone é o aparelho mais usado (80% dos jogadores); gasto de "929 mi" em 2025 (moeda e escopo pouco claros) | [Il Sole 24 Ore](https://en.ilsole24ore.com/art/stable-video-game-market-thanks-to-mobile-exploit-AIribQ3C) | **Não verificado** |
| Europa | € 30 bi em jogos em 2025; mais de 70% dos jogadores europeus jogam no celular | Video Games Europe, [Key Facts 2025](https://www.videogameseurope.eu/wp-content/uploads/2026/08/All-About-Games-2025-Key-Facts-report-final.pdf) (ago/2026) | Fato (associação) |
| Portugal (pt-PT) e inglês | Não achei dados confiáveis só de celular | — | Lacuna |

**Tendências relevantes:**
1. Os downloads caem e o custo de aquisição sobe. Ser descoberto de forma orgânica (ASO, comunidades, vídeos curtos)
   vale mais que anúncio para um desenvolvedor independente.
2. Mais jogos premium e mais crítica à monetização agressiva. O CEO da Polytopia disse em 2025 que monetização
   agressiva faz o jogador fiel desistir ([PocketGamer.biz](https://www.pocketgamer.biz/aggressive-mobile-game-monetisation-pushes-loyal-players-to-churn-says-battle-of-polytopia-ceo)).
3. Assinaturas (Netflix Games, Apple Arcade, Play Pass) põem jogos de estratégia "limpos" no celular. É concorrência,
   mas também um canal possível no futuro.
4. **Verificação de desenvolvedor Android:** desde **30/09/2026**, no **Brasil**, na Indonésia, em Singapura e na
   Tailândia, apps de desenvolvedores não verificados não podem ser instalados em aparelhos certificados. A regra
   vale também para APK distribuído fora da Play, e deve virar global em 2027 ([Android Developers Blog,
   mar/2026](https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html?m=1);
   [Android Authority](https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/)). Por isso,
   testar com APK avulso no Brasil exige conta verificada ou o fluxo avançado (com espera de 24 h). A versão web
   não é afetada.

---

## 4. Mapa de concorrentes (Google Play)

As instalações são da Play (faixa oficial, ex.: "10M+") quando apareceram; senão, são **[Estimativa]** do AppGoblin,
em capturas de 2025–2026 com data nem sempre visível. Nenhum número foi inventado. "—" quer dizer que não achei.

| Jogo | Instalações (Play) | Nota | Monetização | Elogios | Reclamações | Onde o Impérios se diferencia |
|---|---|---|---|---|---|---|
| **The Battle of Polytopia** (Midjiwan) | 10M+ ([androidrank](https://www.androidrank.org/application/the_battle_of_polytopia/air.com.midjiwan.polytopia)); ~15,7 mi [Est.] ([AppGoblin](https://appgoblin.info/apps/air.com.midjiwan.polytopia)); 20 mi no total iOS+Android [Fato] ([PocketGamer.biz](https://www.pocketgamer.biz/news/82527/the-battle-of-polytopia-celebrates-a-milestone-20-million-mobile-downloads/)) | 4,4 (~235 mil notas) [Est., início de 2026] | Grátis + tribos pagas (US$ 0,99–1,99 na App Store); multijogador online pago (FAQ da Epic, versão PC); offline | Simples, rápido, "Civ de bolso" | Tribos pagas desequilibradas ("pague para ganhar"), repetitivo ([Vaporlens](https://vaporlens.app/app/874390/the_battle_of_polytopia)) | Sem unidades nem microgestão; economia por eras; tudo incluso. **É o concorrente mais direto.** |
| **Civilization VI** (Aspyr) | ~1,6 mi [Est.] ([AppGoblin](https://appgoblin.info/apps/com.aspyr.civvi)) | **1,76** (21,2 mil notas) [Est.] | 60 turnos grátis, depois US$ 19,99 (preço de 2020, [Capsule Computers](https://www.capsulecomputers.com.au/?p=309397)); expansões pagas à parte | Fidelidade ao PC ([PocketGamer](https://www.pocketgamer.com/sid-meiers-civilization-vi/review)) | Preço e exigência de hardware ([Gamepressure](https://www.gamepressure.com/newsroom/civilization-6-available-on-android-players-complain-about-price/ze2246)) | Leve, partidas de 10–25 min, roda em celular simples. |
| **Civilization VI: NETFLIX** | — | — | Incluso na assinatura Netflix; sem anúncios nem compras ([Netflix Tudum](https://www.netflix.com/tudum/articles/civilization-6-mobile-game-news)) | Versão completa com expansões | Exige assinatura | Grátis/sem assinatura, curto. |
| **Unciv** (código aberto) | ~3,1 mi [Est.] ([AppGoblin](https://appgoblin.info/apps/com.unciv.app)); a Play mostra ~54,9 mil avaliações, atualizado em 17/11/2026 ([Play](https://play.google.com/store/apps/details?id=com.unciv.app)) | 4,6 [Est.] | Grátis, sem anúncios, "sem coleta de dados" | "Civ V de verdade" no celular, mods | Tela poluída em celular, travamentos no fim de jogo ([Gamebrain](https://gamebrain.co/game/unciv-1)) | Partida curta e interface pensada para celular; Unciv é longo (estilo Civ V). |
| **Antiyoy Classic** (yiotro) | ~6,8–7,1 mi [Est.] ([AppGoblin](https://appgoblin.info/apps/yio.tro.antiyoy.android)) | 4,54 (~105 mil notas) [Est.] | Grátis, sem anúncios (segundo a página) | Minimalista, partidas curtas | — (não achei avaliações) | Tema de civilização e eras, várias vitórias. **Prova de que "simples, curto e sem anúncios" atinge milhões.** |
| **Antiyoy Online** | ~1,2 mi [Est.] | 4,32 [Est.] | Grátis | Multijogador | — | Offline-first. |
| **Age of Conquest IV** (Noble Master) | ~3,6 mi [Est.] ([AppGoblin](https://appgoblin.info/apps/com.ageofconquest.app.user.aoc)) | 4,2 (41,2 mil notas) [Est.] | Grátis + mapas pagos (~US$ 19,99 todos); moedas para criar partida online | Profundidade, "não é pague para ganhar" ([GamingOnLinux](https://gamingonlinux.com/2016/05/free-to-play-age-of-conquest-iv-a-risk-like-wargame-now-fully-released-available-on-linux)) | Poucos mapas grátis ([Gamebrain](https://gamebrain.co/game/age-of-conquest-4)) | Mais simples; mapas grátis (se o usuário quiser). |
| **RISK: Global Domination** (SMG/Hasbro) | **10M+** [Fato, página da Play]; ~19,5 mi [Est.] ([AppGoblin](https://appgoblin.info/apps/com.hasbro.riskbigscreen)) | 4,3 (357 mil) | Contém anúncios + compras | Marca conhecida, online | — | Sem anúncios, sem dados (dado), com economia. |
| **Hexapolis: Civilization Wars** (NOXGAMES) | **1M+** [Fato, página da Play]; ~1,8 mi [Est.] ([Grand Screen](https://grand-screen.com/games/hexapolis-civilization-wars/)) | 4,5 [Est.] | Contém anúncios + compras | — | — | Sem anúncios. |
| **Hex Commander: Fantasy Heroes** | ~3,2 mi [Est.] ([AppGoblin](https://appgoblin.info/apps/com.HomeNetGames.HexHeroes)) | 4,24 (33,9 mil) [Est.] | Grátis + compras | Tático, por turnos | Proporção de notas 1★/5★ subindo | Macro (império), não tático. |
| **Hexonia** (Togglegear) | — (não achei) | — (nota 4/5 no [Stuff](https://stuff.tv/?p=1969)) | Maioria das tribos paga ([Gamebrain](https://gamebrain.co/game/hexonia)) | "Parecido com Polytopia", intuitivo | IA agressiva demais; poucos jogadores | Tudo incluso. |
| **Freeciv Go** | ~55 mil [Est.] / 50K+ ([AppBrain](https://www.appbrain.com/dev/Vladimir+Davidovich/)) | 4,18 (~1 mil) [Est.] | Grátis | Freeciv completo | Port pouco atualizado | Feito para toque e sessão curta. |
| *Referência (outro segmento):* Last War, Whiteout Survival | — | — | 4X online gratuito com compras pesadas; os 2 jogos de maior receita do mundo em 2025 (Sensor Tower) | — | — | Não são concorrentes diretos: mostram onde está o dinheiro, não o público do Impérios. |

**Leitura do mapa:**
- Há um público grande para estratégia curta, offline e simples (Polytopia e Antiyoy somam dezenas de milhões de
  instalações). As notas altas vêm de jogos simples e honestos na monetização. As notas baixas vêm de preço alto ou
  port pesado (Civ VI na Aspyr: 1,76).
- As reclamações mais comuns são conteúdo pago que desequilibra o jogo, conteúdo trancado (mapas ou tribos), anúncios
  e tela poluída. Estes são os pontos em que o Impérios pode se diferenciar.
- **Ponto fraco a testar:** todos os concorrentes têm unidades ou peças se mexendo no mapa. O Impérios é mais
  abstrato (você divide o ouro). Isso pode ser charme ("estratégia de decisão") ou uma barreira (H3).

---

## 5. Plano de validação em fases

### 5.1 Benchmarks de referência

| Métrica | Mediana | Top 25% | Top 10% | Fonte | Observação |
|---|---|---|---|---|---|
| Retenção D1 | ~22% | pouco acima de 30% | ~40% | GameAnalytics, *Mobile Gaming Benchmarks* 2025/2026 ([PDF 2025](https://investgame.net/wp-content/uploads/2025/02/2025-GameAnalytics-Mobile-Gaming-Benchmarks.pdf); [PDF 2026](https://investgame.net/wp-content/uploads/2026/01/2026-01-27-2026-mobile-pc-benchmarks_compressed.pdf)) | Todos os gêneros juntos; não achei número só de Estratégia. No Android é menor que no iOS (top 25%: 25–27% contra 31–33%). |
| Retenção D7 | pouco abaixo de 4% | 6–8% | 11–12% | GameAnalytics (mesmos relatórios) | Caiu de novo em 2025. |
| Retenção D30 | ~0,7% (trecho cortado; conferir) | — | ~4% | GameAnalytics | — |
| Regra de bolso "atualizada" | 35/15/5 (D1/D7/D30) para um jogo saudável | — | — | [AppFollow](https://appfollow.io/blog/mobile-game-retention) | Opinião de mercado. |
| Conversão da página da loja (Play, EUA, 2025) | Média de todas as categorias: 16,15%; **Jogos-Estratégia: 6,6%** (a menor) | — | — | [AppTweak](https://www.apptweak.com/en/aso-blog/average-app-conversion-rate-per-category?lang=en-US) | A partir de jun/2026, o Play Console troca a "taxa de conversão" por métricas de cliques únicos ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/9859173)): compare com cuidado. |
| CPI Android, Estratégia | US$ 2–5 (mundo) | — | — | [Admiral Media](https://admiral.media/mobile-game-marketing-benchmarks/) | Fornecedor de marketing; sem recorte por país. |
| CPI midcore, América Latina × América do Norte | ~US$ 0,27 × ~US$ 5,45 | — | — | Benchmark citado na busca (fornecedor) | **Estimativa fraca**; não é Brasil nem só Estratégia. |
| CPI Alemanha (puzzle, Android, 3º tri/2026) | US$ 3,10 (EUA: US$ 4,81) | — | — | [AppsFlyer](https://www.appsflyer.com/?p=549948) | Outro gênero; serve só de ordem de grandeza. |
| Pré-registro → instalação | ~50% (Nexon); +20% de conversão com recompensa | — | — | [Estudo de caso do Google](https://play.google.com/console/about/nexon-casestudy/) | Um só caso, de jogo grande; material promocional do Google. |

> Um jogo offline e sem anúncios não "monetiza" a retenção como um jogo gratuito com compras. Mesmo assim, D1 e D7
> mostram se o jogo prende, e é isso que faz alguém pagar uma versão completa ou recomendar o jogo.

### 5.2 Regra atual do teste fechado obrigatório (confirmada)

- **Contas pessoais criadas depois de 13/11/2023** precisam de um teste fechado com **pelo menos 12 testadores
  inscritos sem parar por pelo menos 14 dias** antes de pedir acesso à produção. Os 12 precisam continuar inscritos
  no dia do pedido. No pedido, o Google pergunta como foi o teste e qual feedback você recebeu ([Play Console Help,
  "App testing requirements for new personal developer accounts"](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)).
  A regra era de 20 testadores e baixou para 12 (dez/2024, [Android Authority](https://www.androidauthority.com/google-play-app-testing-requirement-3510580)).
- **Contas de organização** não passam por essa regra, mas exigem número D-U-N-S, que pode levar até 30 dias
  (fontes de terceiros, [Choicely](https://www.choicely.com/blog/google-play-12-tester-rule)).
- **Cuidado [relatos de terceiros, não oficiais]:** pedidos são recusados por "pouco engajamento" dos testadores.
  Depois de uma recusa, o Google pede mais 14 dias. Alguns dizem que o relógio zera se cair para 11 testadores
  ([DEV](https://dev.to/tizoc_araujo_3cd9fb67191f/google-play-closed-testing-rejected-for-insufficient-engagement-what-that-actually-means-in-2026-ion),
  [Indie Hackers](https://www.indiehackers.com/post/google-play-production-access-rejected-why-fixes-1efcef20e8)).
  **Recrute 20–25 testadores reais** para ter folga. **Não compre "testadores" no Fiverr**: além do risco, você perde
  o feedback, que é o motivo do teste.

### 5.3 Fases e experimentos

Custos em R$; "≈" indica estimativa minha. Os critérios são **[Proposta]**: defina antes de cada teste e não mude
depois de ver o resultado.

#### Fase 0 — Entender o jogador (já, versão web, 2–3 semanas, ~R$ 0)

| Experimento | Hipótese | Métrica | Seguir | Ajustar | Parar/repensar | Custo | Prazo |
|---|---|---|---|---|---|---|---|
| **E1. Playtests gravados** com 6–8 pessoas do público (gostam de estratégia, jogam no celular), metade sem contato prévio. A pessoa joga tutorial + 1 partida falando em voz alta; depois, 5 perguntas. | H1, H3 | % que termina a 1ª partida sem ajuda; % que diz, sem ser perguntado, que jogaria de novo; minutos até a 1ª decisão "consciente" | ≥ 6 de 8 terminam e ≥ 5 de 8 jogariam de novo | 4–5 de 8 → mexer no tutorial/explicação (`mobile-ux`, `game-designer`) | ≤ 3 de 8 → H3 falhou; rever a apresentação antes de qualquer loja | R$ 0 (videochamada) ou ≈ R$ 30–50 de vale por pessoa | 1–2 semanas |
| **E2. Teste da mensagem** (sem jogo): 3 frases de proposta ("Estratégia de 15 minutos", "Civilização sem anúncios", "Construa um império offline") em posts e pesquisa rápida (Google Forms) em comunidades (r/4Xgaming, r/AndroidGaming, grupos brasileiros de estratégia e boardgame). | H2 | Qual frase recebe mais cliques/votos; % que deixa e-mail para "me avise" | Uma frase vence com folga clara (≥ 1,5× a segunda) | Empate → testar de novo com imagens | Ninguém se interessa (< 2% de quem viu deixa e-mail) | R$ 0 | 1 semana |

#### Fase 1 — Teste de demanda com a versão web (3–6 semanas, ~R$ 0–100)

| Experimento | Hipótese | Métrica | Seguir | Ajustar | Parar/repensar | Custo | Prazo |
|---|---|---|---|---|---|---|---|
| **E3. Página no itch.io** (jogável no navegador) + link do GitHub Pages, com lista de espera (formulário) e pesquisa de 1 minuto no fim da partida. O itch.io mostra visitas e partidas sem precisar de código no jogo. | H1, H2, H5 | Visitas → "jogou" (%); jogou → deixou e-mail (%); idioma/país de quem joga | ≥ 300 jogadores e ≥ 10% deixam e-mail | 100–300 ou 5–10% → trocar imagens/mensagem e repetir | < 100 jogadores após 3 rodadas de divulgação | R$ 0 | 3–4 semanas |
| **E4. Pergunta de preço** na pesquisa (método Van Westendorp: "a partir de que preço seria caro demais / barato demais / um bom negócio?") + escolha entre modelos (grátis com doação, grátis + versão completa, pago único). | H6 | Faixa de preço aceitável; % que escolhe "pagaria" | ≥ 30% dizem que pagariam algo e a faixa é ≥ R$ 10 | 15–30% → testar modelo grátis + desbloqueio | < 15% → pagamento não sustenta; considerar só doação ou parar de investir em monetização | R$ 0 | Junto com E3 |
| **E5. Vídeos curtos** (TikTok/Shorts/Reels, 3–5 vídeos de 20–30 s: "uma partida inteira em 30 s", "escolha: Força ou Ciência?") | H1, H7 | Visualizações, % assistido até o fim, cliques para o link | Um vídeo passa de 5 mil visualizações orgânicas ou gera ≥ 50 cliques | Testar outros ganchos | Nenhum passa de 500 visualizações após 5 tentativas → depender de comunidades e ASO | R$ 0 | 2–3 semanas |

> Declarações em pesquisa superestimam a disposição de pagar. Use o E4 só para ordenar opções; a prova vem com
> compras de verdade (Fase 3).

#### Fase 2 — Teste fechado obrigatório da Play (≥ 14 dias + preparação, ~US$ 25)

Pré-requisito: o app Android (Capacitor) feito pelo `arquiteto`, a conta na Play paga (taxa única de US$ 25 —
confira no Play Console) e a verificação de identidade.

| Experimento | Hipótese | Métrica | Seguir | Ajustar | Parar/repensar | Custo | Prazo |
|---|---|---|---|---|---|---|---|
| **E6. Teste fechado com 20–25 testadores** (lista de espera do E3 + amigos + 3–5 falantes de en/de/fr/it/pt-PT), com roteiro: dia 1 tutorial + partida; dia 3 uma partida de 30 eras; dia 7 tentar uma medalha; formulário nos dias 3 e 14. | H3, H4, H5 + cumprir a regra | Testadores ativos nos dias 1, 7 e 14 (Play Console + formulário, ou telemetria opt-in se aprovada); partidas por pessoa; travamentos (Android vitals); nota média do formulário | ≥ 60% jogaram de novo depois do dia 1 e ≥ 30% ainda jogavam no dia 7; nenhum travamento grave | 40–60% / 15–30% → ajustar ritmo, tutorial e metas e repetir com novos testadores | < 40% voltam depois do dia 1 → problema de núcleo; voltar ao design antes de publicar | US$ 25 + ≈ R$ 0 | 3–4 semanas (14 dias de teste + análise) |

#### Fase 3 — Produção discreta, pré-registro/teste aberto e página da loja (4–8 semanas, ~R$ 0)

| Experimento | Hipótese | Métrica | Seguir | Ajustar | Parar/repensar | Custo | Prazo |
|---|---|---|---|---|---|---|---|
| **E7. Teste aberto ou pré-registro** com a página da loja completa nos 6 idiomas. | H5, H7 | Visitas, instalações ou pré-registros por país e idioma | Conversão da página ≥ 6,6% (média de Estratégia) | 3–6,6% → mexer em ícone, imagens e frase | < 3% depois de 2 versões da página → posicionamento errado | R$ 0 | 4–6 semanas |
| **E8. Experimentos da página da loja** (A/B nativo do Play Console: ícone, 1ª imagem, descrição curta) | H2, H7 | Diferença de conversão entre versões | Uma versão ganha com significância → adotar | Sem diferença → testar elemento mais forte (1ª imagem/vídeo) | — | R$ 0 | 2–4 semanas por teste |
| **E9. Teste real de pagamento** (se o usuário escolher um modelo pago): ex.: desbloqueio dos mapas 2×–4× ou "versão completa". | H6 | % de jogadores ativos que compram; receita por instalação | ≥ 2–3% compram [meta minha, sem benchmark confiável para premium] | 1–2% → mudar preço ou o que é pago | < 1% → rever modelo | Taxa da Play sobre as vendas | 4–8 semanas |

#### Fase 4 — Soft launch com pouco dinheiro (4–6 semanas, ≈ R$ 1.000–2.500)

| Experimento | Hipótese | Métrica | Seguir | Ajustar | Parar/repensar | Custo | Prazo |
|---|---|---|---|---|---|---|---|
| **E10. Anúncios pequenos** (Google App Campaigns ou Meta) só no Brasil e em 1 mercado europeu (ex.: Alemanha ou Portugal), com 2–3 criativos vindos do E5. | H4, H5 + custo de aquisição | CPI por país; D1/D7 da coorte paga (precisa de medição, seção 6); conversão da página | CPI ≤ US$ 1 no Brasil e D1 ≥ 30% / D7 ≥ 8% (top 25%) | D1 20–30% ou CPI US$ 1–2 → melhorar a página e os primeiros minutos | D1 < 20% (abaixo da mediana) ou CPI > US$ 3 no Brasil → não escalar com anúncios; crescer só de forma orgânica | ≈ R$ 1.000–2.500 | 4–6 semanas |

**Cronograma resumido:** Fase 0–1 em dez/2026–jan/2027 (em paralelo com o app Android); Fase 2 em
jan–fev/2027; Fase 3 em fev–mar/2027; Fase 4 só se as fases 2–3 derem "seguir".

---

## 6. O que precisaria mudar no jogo para medir [Proposta — nada foi implementado]

Hoje o jogo não envia nada para fora do aparelho. Isso é um ponto de venda ("sem coleta de dados", como o Unciv), e
cada opção abaixo mexe nisso. Quem implementa, depois da aprovação do usuário, é o `arquiteto` ou o `mobile-ux`.

| Opção | O que mede | Impacto em privacidade e na loja | Esforço |
|---|---|---|---|
| **A. Só ferramentas da loja/plataforma** (Play Console: instalações, desinstalações, notas, Android vitals, aquisição da página; itch.io: visitas e partidas) | Funil da loja, travamentos, notas | Nenhum: não muda o formulário de Segurança dos dados | Zero código |
| **B. Pedido de avaliação nativo** (In-App Review API da Play) depois de uma vitória ou medalha | Mais notas na loja | O jogo não coleta dados; a Play mostra o pedido | Pequeno |
| **C. Estatísticas só no aparelho + "Enviar feedback"** (contador local de partidas, eras, vitórias e tutorial concluído; um botão abre e-mail ou formulário com um resumo que o jogador vê e decide enviar) | Engajamento dos testadores que aceitam enviar | Nada é enviado sozinho. Precisa confirmar com a política da Play se o envio iniciado pelo usuário por e-mail conta como "coleta" (em geral não conta, porque é outro app que envia). Política de privacidade simples | Pequeno |
| **D. Telemetria opt-in mínima** (pergunta clara na 1ª abertura, desligada por padrão; eventos: abriu, começou/terminou partida, duração, dificuldade, tutorial concluído, idioma; sem nome, sem localização, sem ID de publicidade) para um servidor próprio simples ou Firebase | D1/D7/D30 reais, funil do tutorial, onde o jogador desiste | **Muda o formulário de Segurança dos dados** (declarar "Atividade no app" e, com Firebase, identificadores do aparelho: [Firebase](https://firebase.google.com/docs/android/play-data-disclosure), [Play](https://support.google.com/googleplay/android-developer/answer/10787469)). Exige política de privacidade publicada, consentimento (LGPD no Brasil; RGPD/GDPR na Alemanha, França, Itália e Portugal), opção de desligar e de apagar. O jogo perde o selo "nenhum dado coletado". | Médio |
| **E. "Porta falsa" de interesse** (botão "Mapas grandes — em breve" ou "Apoiar o jogo" que só conta toques) | Interesse em conteúdo pago | Só tem valor junto com C ou D; sem elas, o toque fica no aparelho | Pequeno |

**Recomendação:** A + B + C já para o teste fechado, porque não mexem na privacidade. D só para a Fase 4, e só se o
usuário aceitar mudar a política de privacidade e o formulário. Uma alternativa é usar D só na faixa de teste
fechado, com aviso aos testadores, e decidir depois se vai para a produção.

**Lembretes:**
- Anúncios (AdMob), se um dia forem escolhidos, também mudam o formulário de Segurança dos dados, exigem
  consentimento na Europa e põem o selo "Contém anúncios" na loja.
- Compras no app põem o selo "Compras no app". Nenhum dos dois afeta a classificação etária por si só, mas o
  questionário IARC pergunta sobre compras.

---

## 7. Riscos, decisões e próximos passos

### Riscos

| Risco | Probabilidade/impacto | Como reduzir |
|---|---|---|
| Ser descoberto: Estratégia converte pouco na loja (6,6%) e "Impérios/Empires" é genérico | Alta / alta | Testar subtítulo/descrição curta ("Estratégia de 15 min, sem anúncios"); E7/E8; vídeos curtos |
| Jogo abstrato demais (sem unidades no mapa) → "planilha" | Média / alta | E1 antes de tudo; a direção visual "Tabuleiro" já ajuda |
| Retenção baixa sem nenhuma medição → decidir às cegas | Alta se nada mudar | Opções A–C já; D se aprovada |
| Recusa no acesso à produção (engajamento baixo dos testadores) | Média / atraso de +14 dias | 20–25 testadores reais, roteiro de uso, feedback por escrito |
| Verificação de desenvolvedor Android (Brasil desde 30/09/2026) | Certa / baixa se usar a Play | Verificar a conta cedo; não depender de APK avulso |
| Monetização que fere a proposta "sem anúncios" | Depende da escolha | Testar o modelo no E4/E9 antes de construir |
| Manter 6 idiomas com pouco retorno | Média / média | Medir instalações por idioma no E3/E7; manter as traduções, mas focar ASO e anúncios onde houver tração |
| Comparação direta com Polytopia (marca forte, preço baixo) | Alta / média | Posicionar pela diferença: sem microgestão, eras, sem conteúdo pago que desequilibra |

### Decisões que o usuário precisa tomar

1. **Medição:** aceita as opções A + B + C agora? E a telemetria opt-in (D), com a mudança na política de
   privacidade e no formulário de Segurança dos dados — sim, não ou só no teste fechado?
2. **Monetização a testar** (sem decidir a final): quais modelos entram na pesquisa do E4? (grátis com doação;
   grátis + desbloqueio único; pago único; cosméticos/mapas; anúncios — este último contraria a proposta atual.)
3. **Tipo de conta na Play:** pessoal (mais simples, com teste fechado obrigatório) ou organização (sem o teste
   obrigatório, mas exige empresa e D-U-N-S)?
4. **Mercados:** o Brasil primeiro e qual mercado europeu no soft launch (Alemanha tem mais receita;
   Portugal é mais barato e usa a tradução pt-PT)?
5. **Orçamento** da Fase 4 (sugestão: até R$ 2.500) e se aceita os critérios de "parar" acima.
6. **Nome na loja:** manter "Impérios"/"Empires" e trabalhar o subtítulo, ou testar alternativas no E2?

### Próximos 3 passos concretos

1. **Esta semana:** publicar a versão web no itch.io (jogável no navegador), com um formulário de lista de espera e
   uma pesquisa de 1 minuto (inclui a pergunta de preço do E4). Fazer 3 posts de teste de mensagem (E2) em
   comunidades.
2. **Próximas 2 semanas:** fazer 6–8 playtests gravados (E1) com roteiro fixo. Passar o resultado para o
   `game-designer` e o `mobile-ux` **antes** de criar o app Android.
3. **Em paralelo:** o usuário responde às decisões 1–3 acima. Com isso, o `arquiteto` planeja o app Android
   (Capacitor) com as opções de medição aprovadas, e começa o recrutamento de 20–25 testadores para o teste fechado
   de 14 dias (E6).
