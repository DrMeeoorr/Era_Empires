# Proposta de monetização — Impérios

Proposta do agente `monetizacao`, 22/11/2026. **É só uma proposta: nada foi implementado**, nenhum SDK foi adicionado e
nenhuma regra mudou. Pela regra de `docs/decisoes.md`, nada de compras, anúncios ou coleta de dados entra no código sem
a aprovação do usuário registrada lá. Todos os números de receita, retenção e conversão abaixo são **estimativas**
(marcadas com *(est.)*), feitas sem dados reais do jogo; servem para comparar caminhos, não como promessa.

---

## 1. Resumo executivo

**Recomendação: Impérios grátis para baixar, com uma compra única "Edição Completa" por R$ 14,99, sem anúncios e sem
coleta de dados no lançamento.**

- A parte grátis é um jogo inteiro e honesto: o mapa Original, quatro dificuldades (Muito fácil a Difícil), 1 a 5
  rivais, partidas de 15 e 30 eras, mapa padrão e sorteado, terrenos só visuais e com efeitos, tutorial e **as 12
  medalhas** (todas conquistáveis sem pagar).
- A Edição Completa desbloqueia **mais jogo, nunca vantagem**: mapas 2×, 3× e 4× (com as vitórias Grande Descoberta
  e Maravilha da Humanidade), duração "Sem limite" e "Outra", dificuldade Lendário, várias partidas salvas,
  estatísticas da partida e temas do tabuleiro. Quem compra recebe também os cenários futuros.
- Uma **partida de teste grátis num mapa grande** mostra o que se ganha antes de pagar.
- Por que este caminho: combina com o jogo (estratégia, offline, sessões de 12–26 min, sem conta), não muda o
  balanceamento (as regras em `src/core` e as impressões digitais **39190b06** / **5c97e2c2** ficam iguais), exige o
  mínimo de privacidade na Play Store ("nenhum dado coletado") e é o que rende mais por jogador num jogo de nicho
  sem orçamento de marketing.
- Receita no 1.º ano *(est.)*: **R$ 2,5 mil (pessimista) · R$ 11,5 mil (base) · R$ 51 mil (otimista)** líquidos da
  taxa do Google, conforme 10 mil, 30 mil ou 100 mil downloads.
- Anúncios ficam **fora** do lançamento. Só voltam à mesa se os dados mostrarem muita gente jogando e pouca comprando
  (fase 4, nova decisão do usuário).

---

## 2. Diagnóstico do jogo (ótica de monetização)

### 2.1 Como o jogo é hoje

- Estratégia por eras: a cada era o jogador divide o ouro entre **Militar/Força, Obras e Ciência**, dá ordens de
  ataque e toca "Concluir era". Rivais com estilos (Equilibrado, Militar, Agressivo, Construtor, Científico,
  Adaptativo), 5 dificuldades, mapas Original/2×/3×/4×, terrenos com ou sem efeito, 15/30 eras ou Sem limite.
- Funciona **offline e sem conta**; o save fica no aparelho (`src/platform/storage.js`). Ainda é uma página web
  (GitHub Pages); o plano é virar app Android com Capacitor.
- Duração medida pelo `game-designer` (Médio, Sem limite): Original 1 rival ~12 min (27 eras); 2× ~16–18 min;
  3× ~22 min; 4× com 3 rivais ~26 min (46 eras). Cerca de 25 s por era.
- Rodei a versão do jogador (Playwright, Pixel 7): a primeira tela oferece o tutorial ("5 passos · cerca de 2 min"),
  e a tela inicial tem **Jogar**, **Tutorial**, **Como jogar** e **Medalhas 0/12**. Não há loja, conta nem rede.

### 2.2 Pontos fortes para monetizar

- **Muito conteúdo já pronto e equilibrado**: os mapas grandes, as vitórias novas (Grande Descoberta, Maravilha),
  o Sem limite e o Lendário são variedade real, testada com dezenas de milhares de partidas. Isso pode ser a
  "Edição Completa" sem inventar nada novo antes do lançamento.
- **Rejogabilidade**: semente nova a cada partida, mapa sorteado, 6 estilos de rival e terrenos com efeito.
- **Público que paga por jogo inteiro**: quem joga estratégia por turnos costuma preferir pagar uma vez a ver
  anúncios (é o padrão de jogos do gênero no celular).
- **Código separado** em regras (`core`), IA (`ai`), sessão (`app`), tela (`ui`) e plataforma (`platform`): dá para pôr
  a "trava" das opções pagas só em `app`/`ui`/`platform`, sem tocar nas regras.

### 2.3 Lacunas de retenção (o que falta para o jogador voltar)

| Lacuna | Efeito | Sugestão (quem faz) |
| --- | --- | --- |
| Só **um save** | quem quer testar um mapa grande perde a partida em curso | várias partidas salvas (`arquiteto` + `mobile-ux`) |
| Nenhum **motivo diário** | pouco hábito de abrir o jogo | "Desafio do dia" grátis: mesma semente e configuração para todos, sem ranking online (`game-designer`) |
| Medalhas acabam em 12 | depois de pegar todas, falta meta | mais medalhas nos mapas grandes e nos cenários (`game-designer`) |
| Sem **histórico** | o jogador não vê a própria evolução | estatísticas: vitórias por dificuldade, melhor pontuação, gráficos da partida (`charts.js` já existe) |
| Sem **objetivos guiados** depois do tutorial | jogador novo não sabe o que tentar | cenários/campanha curta com objetivos ("vença o Rubro sem atacar até a era 10") |
| Partidas 4× passam de 20 min | difícil terminar numa pausa | o save já resolve; mostrar "Continuar · Era N" é suficiente |

### 2.4 Pausas naturais (onde uma oferta pode aparecer sem atrapalhar)

| Momento | Pode ter oferta? |
| --- | --- |
| Tutorial e primeira partida | **Nunca** |
| Durante a era (dividir o ouro, atacar, folhas das regiões) | **Nunca** |
| Pergunta "Você domina o mapa!" | **Nunca** (é uma decisão de jogo) |
| Resumo da era | Não (é parte da partida) |
| **Tela de resultado**, a partir da 2.ª partida terminada | Sim: um cartão discreto, no máximo 1 vez por dia |
| **Nova partida → Personalizar** (opções com cadeado) | Sim: o cadeado explica o que é e leva à tela da Edição Completa |
| **Tela inicial / menu ☰** | Sim: um botão fixo "Edição Completa" (sem janela que salta) |
| Tela **Medalhas** | Só um aviso de que há medalhas nos mapas grandes, se elas existirem |

### 2.5 O que é conteúdo e o que é sistema

- **Conteúdo** (pode ser vendido): tamanhos de mapa, duração Sem limite, dificuldade Lendário, cenários/campanhas
  futuros, temas visuais, bandeiras e nomes de império.
- **Sistema** (nunca vendido): as regras, o balanceamento, a IA, o tutorial, as medalhas, o save, a acessibilidade.

---

## 3. Comparação de modelos de negócio

### Premissas comuns (todas estimativas)

- Downloads no 1.º ano sem marketing pago: **10 mil (pessimista) · 30 mil (base) · 100 mil (otimista)** *(est.)*.
- Retenção de um jogo de estratégia pequeno: **D1 30% · D7 10% · D30 4%** *(est.)*; isso dá ~5 dias jogados por
  instalação ao longo da vida *(est.)*.
- Taxa do Google Play: **15%** sobre a receita (programa para o primeiro US$ 1 milhão por ano; confirmar a adesão no
  Play Console). Impostos no Brasil não estão descontados (confirmar com um contador).
- Câmbio: **US$ 1 = R$ 5,50** *(est.)*.
- eCPM no Brasil *(est.)*: intersticial **US$ 1,50**, recompensado **US$ 3,00**, com 90% de preenchimento.

### Modelo A — App pago (R$ 9,99, tudo incluído)

- **Prós**: o mais simples (sem Billing, sem anúncios); "nenhum dado coletado"; offline total; sem pressão de venda
  dentro do jogo.
- **Contras**: no Brasil poucos pagam antes de experimentar; ranking e avaliações crescem devagar; não há como mostrar
  o jogo antes da compra; a versão web grátis (GitHub Pages) concorre diretamente.
- **Esforço**: baixo (só publicar como app pago).
- **Privacidade/Play Store**: mínimo; formulário de Segurança dos Dados = "nenhum dado coletado".
- **Receita *(est.)***: vendas ≈ 4% do volume que um app grátis teria → base 1.200 × R$ 9,99 × 0,85 ≈
  **R$ 10,2 mil** (pessimista ~R$ 3,4 mil; otimista ~R$ 34 mil). Muito incerto: depende de destaque na loja.

### Modelo B — Grátis + "Edição Completa" (compra única R$ 14,99) — **recomendado**

- **Prós**: o jogador experimenta de graça; quem gosta paga uma vez e esquece o assunto; sem anúncios; continua
  offline; não muda regras; o conteúdo pago já existe; avaliações e boca a boca crescem com a parte grátis.
- **Contras**: precisa de Google Play Billing (trabalho de integração e testes); é preciso acertar a divisão
  grátis/pago (grátis de menos irrita, de mais não vende); o código é aberto, então quem quiser pode burlar a trava
  (aceitável para um jogo deste tamanho).
- **Esforço**: médio (Billing + telas + travas + testes; ver fase 1).
- **Privacidade/Play Store**: baixo. Compras pelo Google Play Billing (cartão, Pix, saldo Google Play, operadora — o
  que o Google oferecer no Brasil); o jogo em si não coleta dados. Precisa de política de privacidade simples e
  declarar no formulário que as compras são processadas pelo Google.
- **Receita *(est.)***: conversão de 2% / 3% / 4% das instalações → 10 mil × 2% × R$ 14,99 × 0,85 ≈ **R$ 2,5 mil**;
  30 mil × 3% ≈ **R$ 11,5 mil**; 100 mil × 4% ≈ **R$ 51 mil**.

### Modelo C — Grátis com anúncios + "Remover anúncios" (R$ 7,99)

- **Prós**: todos jogam tudo de graça; alguma receita mesmo de quem nunca paga.
- **Contras**: sessões longas e poucas pausas = **poucas exibições** (1–2 por dia por jogador); eCPM baixo no Brasil;
  anúncios pioram avaliações num jogo calmo de estratégia; exigem internet (offline não rende nada).
- **Esforço**: médio a alto (AdMob + consentimento UMP + regras de frequência + testes com e sem rede).
- **Privacidade/Play Store**: **alto**. SDK de anúncios coleta o ID de publicidade e dados do aparelho: Segurança dos
  Dados com "dados coletados e compartilhados", tela de consentimento (LGPD e GDPR, via UMP do Google), política de
  privacidade detalhada, declaração de anúncios na loja ("Contém anúncios"), cuidado com classificação etária e, se o
  público incluir menores de 13, a **Política de Famílias** (só redes de anúncios certificadas, sem anúncio
  personalizado).
- **Receita *(est.)***: 30 mil × 5 dias = 150 mil dias-jogador; 1,2 intersticiais + 0,3 recompensados por dia →
  ≈ US$ 0,0024 por dia-jogador ≈ R$ 2,0 mil; mais 1% comprando "Remover anúncios" (30 mil × 1% × R$ 7,99 × 0,85 ≈
  R$ 2,0 mil) → **≈ R$ 4 mil** na base (pessimista ~R$ 1,3 mil; otimista ~R$ 13 mil).

### Modelo D — Híbrido (B + anúncios leves para quem não comprou)

- **Prós**: soma um pouco de receita de anúncios à da Edição Completa; qualquer compra remove os anúncios.
- **Contras**: todos os custos de privacidade do modelo C; anúncios reduzem a vontade de comprar e as avaliações;
  dobra o trabalho de testes.
- **Esforço**: alto.
- **Privacidade/Play Store**: alto (igual ao C).
- **Receita *(est.)***: B (≈ R$ 11,5 mil) + anúncios só em quem não pagou (≈ R$ 1,5–2 mil) − perda de conversão
  (≈ 10%, *est.*) → **≈ R$ 12–12,5 mil** na base. Ganho pequeno diante do custo.

### Quadro resumo

| Modelo | Receita base 1.º ano *(est.)* | Esforço | Privacidade/loja | Offline | Risco para a diversão |
| --- | --- | --- | --- | --- | --- |
| A — Pago | ~R$ 10 mil (muito incerto) | Baixo | Mínimo | Total | Nenhum |
| **B — Grátis + Edição Completa** | **~R$ 11,5 mil** | Médio | Baixo | Total | Baixo |
| C — Anúncios + remover | ~R$ 4 mil | Médio/alto | Alto | Não rende offline | Médio |
| D — Híbrido | ~R$ 12 mil | Alto | Alto | Parcial | Médio |

**Assinatura** (ex.: "Impérios+" mensal) foi descartada: o jogo não tem serviço contínuo (servidor, conteúdo semanal)
que justifique cobrança todo mês, e jogadores rejeitam assinatura em jogo offline.

---

## 4. O que vender e o que nunca vender

### 4.1 Divisão proposta grátis × Edição Completa

| Item | Grátis | Edição Completa |
| --- | --- | --- |
| Tutorial, Como jogar, todas as regras | ✔ | ✔ |
| Mapa Original (24 regiões), padrão e sorteado | ✔ | ✔ |
| Terrenos só visuais e **com efeitos** | ✔ | ✔ |
| 1 a 5 rivais, todos os estilos | ✔ | ✔ |
| Dificuldades Muito fácil, Fácil, Médio, Difícil | ✔ | ✔ |
| Durações 15 e 30 eras; Ritmo Normal/Rápido; vitória Clássica/Conquista | ✔ | ✔ |
| **As 12 medalhas** atuais | ✔ (todas conquistáveis) | ✔ |
| Desafio do dia (futuro) | ✔ | ✔ |
| Mapas **2×, 3× e 4×** (com Grande Descoberta e Maravilha da Humanidade) | 1 partida de teste | ✔ |
| Duração **Sem limite** e **Outra** (10–150) | — | ✔ |
| Dificuldade **Lendário** | — | ✔ |
| **Várias partidas salvas** (ex.: 3 espaços) | 1 espaço | ✔ |
| **Estatísticas**: histórico de partidas e gráficos da partida | resumo simples | ✔ |
| **Temas do tabuleiro** (ex.: "Pergaminho", "Noite") e nome/cor do seu império | tema padrão | ✔ |
| Cenários/campanhas futuros | 1–2 cenários de amostra | ✔ (inclusos) |

Notas:
- Nada pago muda números do jogo. Mapas grandes, Sem limite e Lendário valem igual para você e para os rivais — são
  modos, não vantagens. O `game-designer` confirma que nenhuma opção grátis fica pior por causa da divisão.
- **Medalhas continuam todas grátis.** Se no futuro houver medalhas dos mapas grandes, elas aparecem como extras,
  sem mudar o contador "N/12" das atuais.
- Se o jogador perder a compra (reembolso), **a partida em curso termina normalmente**; só não abre partida nova com
  opção paga. Nenhum save é apagado ou travado.

### 4.2 Nunca vender

- Ouro, Força, Obras, Ciência, defesa extra, ordens mais baratas, rivais mais fracos ou qualquer número das regras.
- "Desfazer era", "tentar de novo a batalha", ver o estilo escondido dos rivais, pular eras.
- Medalhas, ou atalhos para medalhas.
- Caixas-surpresa (loot boxes), sorteios pagos, moedas virtuais (gemas, coroas) que escondem o preço em reais.
- Energia/vidas que limitam quantas partidas se joga por dia.
- Tutorial, acessibilidade, save, correções de bugs.
- Dados do jogador (nada é vendido nem compartilhado).

### 4.3 Como oferecer (regras de ética)

- Sem contagem regressiva falsa, sem "só hoje" inventado, sem texto de culpa ("Não, prefiro perder").
- Fechar a oferta é tão fácil quanto abrir (✕, Esc, Voltar do Android).
- Preço sempre em reais, com o valor final, igual ao da Play Store.
- Cartão no resultado no máximo 1 vez por dia, nunca depois de derrota na primeira semana de jogo, nunca na 1.ª
  partida. Promoções reais só pelas ferramentas de promoção do Play Console.
- "Restaurar compra" sempre visível na tela da Edição Completa.

---

## 5. Preços sugeridos (R$)

| Produto | Preço | Observação |
| --- | --- | --- |
| **Edição Completa** (compra única, não consumível) | **R$ 14,99** | Preço "cheio" de jogo de estratégia pequeno no Brasil |
| Promoção de lançamento | R$ 9,99 por 2 semanas | Real e anunciada pela loja, sem cronômetro falso |
| Alternativa se a conversão for baixa | R$ 9,99 fixo | Testar com experimento de preço do Play Console |
| Pacote de cenários futuro (só se a decisão for vender à parte) | R$ 4,99 | Para quem não tem a Edição Completa |
| Pacote de temas (opcional, futuro) | R$ 3,99 | Só cosmético |
| "Apoiar o desenvolvedor" (opcional) | R$ 4,99 / R$ 9,99 | Só um "obrigado" e um tema exclusivo; nada de jogo |
| *(Só no modelo C/D)* Remover anúncios | R$ 7,99 | Não recomendado no lançamento |

Faixas da Play Store: o Google aceita preços livres em reais; os sugeridos seguem os valores mais comuns em jogos no
Brasil (R$ 4,99 · 9,99 · 14,99 · 19,99). Com a taxa de 15%, a Edição Completa rende ≈ **R$ 12,74** por venda
(antes de impostos).

---

## 6. Roteiro em fases

### Fase 0 — Decisões (antes de qualquer código)

- Usuário decide os itens da seção 9 e registra em `docs/decisoes.md`.
- `monetizacao`: ajusta esta proposta às decisões.
- Usuário: conta de desenvolvedor Google Play (taxa única de US$ 25), perfil de pagamentos e dados fiscais.

### Fase 1 — Antes do lançamento (preparar o app e a compra)

| Parte | Quem |
| --- | --- |
| Confirmar que a divisão grátis/pago não mexe em regras nem impressões digitais; definir a "partida de teste" num mapa grande; 1–2 cenários de amostra | `game-designer` |
| Empacotar o jogo como app Android (Capacitor), trocar o armazenamento por `@capacitor/preferences` como já previsto | `arquiteto` |
| Módulo de compras em `src/platform/` (ex.: `purchases.js`) com Google Play Billing por um plugin do Capacitor **sem servidor de terceiros** (evitar serviços que coletam dados); cache local do desbloqueio, confirmação quando houver rede, restaurar compra, reembolso | `arquiteto` |
| "Trava" das opções pagas só em `src/app` e `src/ui` (nunca em `src/core`/`src/ai`); teste de estrutura que confirme isso | `arquiteto` + `qa-testes` |
| Várias partidas salvas e estatísticas (são parte do que se vende) | `arquiteto` + `mobile-ux` |
| Telas: "Edição Completa" (estilo Atlas: o que vem, preço, comprar, restaurar), cadeados em Personalizar com explicação, cartão discreto no resultado, botão na tela inicial e no menu ☰, mensagens de erro de compra em pt-BR | `mobile-ux` |
| Evitar confusão de nome: o cabeçalho de desenvolvimento "Versão completa · laboratórios" (só `dev.html`) não pode se chamar igual ao produto | `mobile-ux` |
| Testes: compra, cancelamento, compra pendente (ex.: Pix aguardando), sem internet, restaurar em outro aparelho, reembolso com partida paga em curso, saves antigos, impressões digitais **39190b06** / **5c97e2c2** iguais, nada de oferta no tutorial/1.ª partida/durante a era, acessibilidade das telas novas nos 3 celulares | `qa-testes` |
| Política de privacidade curta em pt-BR ("o jogo não coleta dados; compras são processadas pelo Google Play") | `monetizacao` redige, usuário aprova |

### Fase 2 — Lançamento

- Play Console: ficha da loja em pt-BR (descrição clara do que é grátis e do que é pago), capturas, classificação
  etária (questionário IARC), público-alvo **13+** (fora da Política de Famílias), formulário de Segurança dos Dados.
- **Teste fechado** antes da produção (contas pessoais novas precisam de um número mínimo de testadores por 14 dias —
  hoje 12; confirmar no Play Console). `qa-testes` acompanha os relatos.
- Promoção de lançamento R$ 9,99 por 2 semanas (ferramenta de promoções da loja).
- Versão web (GitHub Pages): conforme a decisão do usuário (seção 9).

### Fase 3 — Depois do lançamento (1–6 meses)

| Parte | Quem |
| --- | --- |
| Ler os números do Play Console a cada 2 semanas (seção 7) e propor ajustes | `monetizacao` |
| "Desafio do dia" grátis (retenção) e mais medalhas | `game-designer` + `mobile-ux` |
| Campanha/cenários (ex.: 8–10 cenários com objetivos) — inclusos na Edição Completa | `game-designer` (conteúdo e balanceamento) + `mobile-ux` (telas) |
| Temas do tabuleiro novos | `mobile-ux` |
| Experimento de preço (R$ 14,99 × R$ 9,99) se a conversão ficar abaixo da meta | `monetizacao` + usuário |
| Testes de regressão a cada conteúdo novo | `qa-testes` |

### Fase 4 — Opcional, só com dados e nova decisão

- Se a retenção for boa e a conversão baixa: avaliar anúncios recompensados opcionais (ex.: "veja um vídeo para jogar
  mais uma partida de teste num mapa grande"), nunca intersticiais no meio da partida. Exige SDK, consentimento e nova
  declaração de dados — nova decisão do usuário.
- Avaliar versão para iOS só se o Android passar da meta otimista.

---

## 7. Métricas e metas

Todas vêm do **Play Console** (sem SDK de análise no jogo): instalações, retenção, compras, reembolsos, avaliações,
falhas (Android vitals).

| Métrica | Meta nos 90 dias *(est.)* | Se ficar abaixo |
| --- | --- | --- |
| Retenção D1 | ≥ 35% | Rever tutorial e 1.ª partida (`mobile-ux`) |
| Retenção D7 | ≥ 12% | Desafio do dia, mais objetivos (`game-designer`) |
| Retenção D30 | ≥ 5% | Cenários/campanha, mais medalhas |
| Conversão (compradores ÷ instalações) | ≥ 3% | Mais clareza na oferta, partida de teste, experimento de preço R$ 9,99 |
| Receita por instalação (≈ LTV) | ≥ R$ 0,38 | Igual à conversão |
| ARPDAU (receita ÷ jogadores ativos por dia) | acompanhar; referência ~R$ 0,08 *(est.)* | Só indicativo neste modelo |
| Avaliação média na loja | ≥ 4,4 | Ler comentários; se citarem "parte grátis curta", liberar mais |
| Reembolsos | < 5% das compras | Ver se a descrição do que é pago está clara |
| Falhas/ANR (Android vitals) | abaixo dos limites do Google | `arquiteto` + `qa-testes` |
| Sessões por dia por jogador ativo | ≥ 1,3 | Desafio do dia |

O que **não** dá para medir sem coletar dados (ex.: quantos chegam à 2.ª partida, quantos abrem a tela da Edição
Completa). Se o usuário quiser esses números, seria preciso um SDK de análise — o que muda a declaração de privacidade
(decisão da seção 9).

---

## 8. Riscos

| Risco | Como reduzir |
| --- | --- |
| **Versão web grátis completa** tira o motivo de comprar | Decidir o futuro do GitHub Pages (seção 9) |
| Código aberto: a trava pode ser burlada | Aceitar; o público honesto é a maioria. Não gastar com proteção pesada |
| Parte grátis parecer "jogo cortado" e gerar avaliações ruins | Grátis inclui medalhas, efeitos, 4 dificuldades e o mapa Original inteiro; descrição transparente na loja |
| Integração de Billing com Capacitor quebrar no futuro | Plugin isolado em `src/platform`; testes de compra no teste fechado e a cada atualização |
| Compra pendente (Pix/boleto) ou sem rede | Desbloqueio só quando o Google confirma; mensagem clara "Aguardando pagamento" |
| Reembolso com partida paga em andamento | Deixar terminar a partida; nunca apagar save |
| Pouca descoberta na loja (nicho) | Ficha bem feita, vídeo curto, pedir avaliação só depois de uma vitória (pela API oficial da Play) |
| Pressão para criar conteúdo pago sem parar | Conteúdo futuro incluso na Edição Completa; ritmo que o projeto aguenta |
| Mudança de regras da Play Store (taxas, testadores, políticas) | Rever a ficha e as declarações a cada atualização |
| Mexer em regras sem querer ao travar opções | Trava fora de `src/core`/`src/ai`; impressões digitais nos testes |
| Impostos e câmbio | Consultar contador antes de ativar pagamentos |

---

## 9. Decisões que o usuário precisa tomar

1. **Modelo**: aprovar o **B — grátis + Edição Completa, sem anúncios** (ou escolher A, C ou D).
2. **Divisão grátis/pago**: aprovar a tabela 4.1 — em especial se **mapas 2×–4×, Sem limite e Lendário** ficam na
   Edição Completa, e se os **terrenos com efeitos** continuam grátis.
3. **Preço**: R$ 14,99 (recomendado) ou R$ 9,99; com ou sem promoção de lançamento a R$ 9,99 por 2 semanas.
4. **Nome do produto**: "Edição Completa" (sugestão) ou outro.
5. **Conteúdo futuro** (cenários, temas): incluso para quem comprou (recomendado) ou vendido em pacotes à parte.
6. **Partida de teste grátis** num mapa grande: sim (recomendado) ou não; quantas (1 sugerida).
7. **Versão web no GitHub Pages**: continua completa e grátis; vira demonstração (só o grátis); ou sai do ar quando o
   app for lançado.
8. **Anúncios**: confirmar **nenhum** no lançamento.
9. **Dados**: confirmar **nenhum SDK de análise** (só os números do Play Console).
10. **Público-alvo na Play Store**: 13 anos ou mais (recomendado, evita a Política de Famílias).
11. **Botão "Apoiar o desenvolvedor"**: sim ou não.
12. **Conta e pagamentos**: conta Google Play pessoal ou de empresa; quem cuida dos dados fiscais.
13. **Liberar a fase 1** para `arquiteto`, `mobile-ux`, `game-designer` e `qa-testes` depois das decisões acima
    (registrar em `docs/decisoes.md`).
