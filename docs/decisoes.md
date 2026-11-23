# Decisões do projeto Impérios

Registro das decisões do usuário. Todos os agentes devem seguir.

## 19/11/2026 — Revisão do arquiteto
- Aprovado: escapeHtml (segurança), recuperação de save corrompido, aviso quando o save falha.
- Aprovado: corrigir o "vazamento" de dificuldade (applyDifficulty) e o tutorial gravando Fácil para sempre.
- Aprovado: tirar `inv.returns` do save (o usuário não usa esse detalhe nos arquivos exportados).
- Aprovado: versão do jogador provisória — laboratórios, "Exportar" e "Versão completa" escondidos; visíveis com `?dev=1`.
- Plano de migração em 14 passos aceito como referência; Vite em duas fases (mudar o GitHub Pages para Actions ainda precisa de aprovação).

## 19/11/2026 — Revisão do mobile-ux
- Direção visual: **Alternativa A — "Tabuleiro de conquista"** (protótipo: https://claude.ai/artifact/XPcPVtLcgB9FmpihLycFmU).
- Idioma/público: **português do Brasil** (números no formato 1.234,5).
- Nomes aprovados:
  - **Ouro** no lugar de "u."; **Força** no lugar de "Poder militar".
  - **Obras** no lugar de "Infraestrutura"; **Ciência** no lugar de "Tecnologia".
  - **Regiões com nome** no lugar dos números 01–24.
  - **Rivais com nome próprio** (ex.: "Rubro") no lugar de "IA · Adaptativa".
- Implementação em fases: começar pela **Fase 1** (correções rápidas) só depois que o arquiteto terminar; o usuário revisa antes das Fases 2 e 3.

## 19/11/2026 — Revisão do qa-testes
- Corrigir os 3 bugs encontrados:
  1. Balão do tutorial cobre o Placar em celulares menores → `mobile-ux` (junto com a Fase 1).
  2. Campo numérico vazio nas Configurações vira 0 → `arquiteto`.
  3. Reabrir o jogo depois de uma partida terminada esquece rivais/eras/dificuldade → `arquiteto`.
- Ativar GitHub Actions rodando `npm test` em cada push e pull request.
- Reforçar os testes internos fracos (sem mudar regras do jogo).

## Pendências levantadas pelo arquiteto (19/11/2026)
- Na versão do jogador, a dificuldade padrão deve ser "Médio" e a opção "⚙ Configurações" / "Definido nas Configurações" deve ficar só com `?dev=1` → entra na Fase 1 do `mobile-ux` (já prevista na revisão de UX).
- Na partida do tutorial, "Reiniciar" e "Jogar de novo" usam as escolhas de antes do tutorial (comportamento atual aceito até nova decisão).

## 19/11/2026 — Textos pt-BR e nomes
- Textos do jogador em pt-BR com Ouro/Força/Obras/Ciência: implementados (textos do motor convertidos só na exibição, via `uiText()`).
- Estilos das IAs (nomes vistos pelo jogador): **Equilibrado, Militar, Agressivo, Construtor** (antes Infraestrutura), **Científico** (antes Tecnológico), **Adaptativo** (antes Adaptativa). Aprovado.
- Rivais — **Opção A "Cores"**: Rubro ▲, Ocre ●, Anil ◆, Violeta ■, Turquesa ✚; o jogador é "Você" ★. O estilo aparece como etiqueta secundária ("▲ Rubro · Adaptativo").
- Regiões — lista aprovada, em ordem de leitura do mapa 6×4:
  Arvela, Brumas, Cardo, Dorna, Esmera, Fenda, Gralha, Hélia, Ivara, Jaspe, Lumen, Musgo,
  Névoa, Ombral, Pedral, Quartzo, Rochedo, Salgar, Torva, Urzal, Vau, Velar, Xisto, Zênite.
  No mapa: **nome + número pequeno**.

## 20/11/2026 — Redesenho das telas iniciais (mobile-ux)
- **Tela inicial: direção C "Aurora"** — céu, sol nascendo e colinas das eras com as bandeiras dos impérios.
  Botão principal **"Jogar"**; com partida salva, **"Continuar · Era N"** (com "de 30 · Médio · 1 rival" embaixo) e
  **"Nova partida"** como secundário. **"Tutorial"** e **"Como jogar"** lado a lado. Cabe sem rolar, inclusive em 360×640.
- **Demais telas: direção A "Atlas"** — convite do tutorial, Nova partida (configurar) com **Personalizar** e Como jogar.
  As duas direções usam a mesma paleta, os mesmos botões e os mesmos ícones SVG.
- **Fonte própria: sim** — Marcellus SC (licença OFL, ~15 KB, guardada no próprio jogo, sem internet; licença em
  `assets/fonts/OFL.txt`) só no nome IMPÉRIOS (também na tela inicial) e nos títulos. Textos comuns: fonte do sistema.
- Nomes aprovados:
  - "Começar" → **"Jogar"**.
  - "Modo lento/rápido" → **"Ritmo: Normal / Rápido"**.
  - "Clássico" → **"Clássica"** (vitória).
  - "Hardcore" → **"Lendário"** (só o nome mostrado; a chave interna `hardcore` e os saves continuam iguais).
- Configurar: só **Dificuldade** e **Rivais** à vista, com os padrões (Médio, 1 rival, 30 eras); o resto (duração,
  ritmo, vitória, estilo de cada rival, posição inicial aleatória) fica em **"Personalizar"**, sem tirar nenhuma opção.
- Versão do jogador sem textos de laboratório ("MVP", "Funciona offline · sem instalação…"); título da aba: "Impérios".

## 20/11/2026 — Terrenos no mapa (mobile-ux, 3 rodadas de protótipo)
- **7 terrenos, só visuais por enquanto** (nenhuma regra muda; impressão digital continua e82cdda4):
  Campina, Floresta, **Colinas** (dois morros sobrepostos, terracota, sem árvore), Montanha, Deserto, Pântano, Tundra.
  Arte própria em SVG (sem imagens externas), com forma diferente para cada terreno (não depende só da cor).
- **Mapa padrão** (tabela fixa, na ordem das regiões; atualizada na rodada de balanceamento de 20/11/2026 — Jaspe ↔ Rochedo):
  Campina: Arvela, Cardo, Esmera, Ivara, Urzal, Vau, Zênite · Floresta: Gralha, Musgo, Ombral, Velar ·
  Colinas: Dorna, Pedral, Rochedo · Montanha: Jaspe, Quartzo, Xisto · Deserto: Hélia, Salgar ·
  Pântano: Brumas, Névoa, Torva · Tundra: Fenda, Lumen.
  Pedral (Colinas) e Torva (Pântano), regiões iniciais com 3+/4+ rivais, ficam como estão: o `game-designer` decide depois.
- **Dono**: fronteira grossa só em volta de cada império (lisa para você, listrada para os rivais, com contorno escuro)
  + bandeirinha com o símbolo em cada região; o símbolo continua ao lado do número; região livre = só o terreno.
- **Ataque**: "pode atacar" = brilho interno + selo de espadas; região escolhida = contorno branco e o resto do mapa
  escurecido enquanto a folha de ataque está aberta; ordem dada = dourado sólido + espadas cheias + "⚔ ordem".
  O tracejado dourado saiu. A cor do Ocre ficou como estava.
- A folha da região mostra o terreno (ícone + nome). Legenda: donos + "Pode atacar" + botão **"ⓘ Terrenos"** (folha
  com os 7). Os 7 terrenos também no Como jogar (tela inicial e folha "?").
- **Opção "Mapa"** em Nova partida → Personalizar: **"Padrão · sempre igual"** (padrão de fábrica) /
  **"Sorteado · novo a cada partida"**; com Sorteado, os resumos mostram "mapa sorteado". O tutorial usa sempre o
  mapa padrão e devolve a escolha do jogador depois.
- **Regras do sorteio**: Campina 5–8 (e pelo menos 1 por império), Floresta 3–5, Colinas 2–5, Montanha 2–4,
  Deserto 1–3, Pântano 2–4, Tundra 1–3; regiões iniciais sempre Campina; Tundra só nas 2 linhas de cima e Deserto
  só nas 2 de baixo; cada região inicial com pelo menos 2 vizinhas de Campina/Floresta/Colinas e no máximo 1 de
  Montanha; se não der, nova tentativa com a semente seguinte.
- **Save**: guarda o tipo de mapa, a semente própria (sorteada à parte, nunca o sorteio das batalhas) e a lista dos
  24 terrenos (`state.terrain`); saves antigos abrem com o mapa padrão.

## 20/11/2026 — Terrenos com efeitos (game-designer)
- **Opção "Terrenos"** em Nova partida → Personalizar: **"Só visual · regras de sempre"** (padrão para jogador novo)
  / **"Com efeitos · cada terreno muda o jogo"**; com efeitos, os resumos mostram "terrenos com efeito". O tutorial
  usa sempre Só visual e devolve a escolha do jogador depois. Saves antigos abrem como Só visual.
- Só visual = o jogo de antes, byte a byte (impressão digital **e82cdda4**). Com efeitos tem impressão digital
  própria: **75da3210** (`tests/fingerprint-effects.test.js`).
- **Tabela final** (2 vantagens + 1 desvantagem; aprovada a variante "Tundra com Ciência"):
  Campina +20% ouro, +5% Obras, −2 defesa · Floresta +10% Obras, +2 defesa, −20% ouro ·
  Colinas +10% Força, +2 defesa, −20% ouro · Montanha +4 defesa, +20% ouro, −10% Ciência ·
  Deserto +10% Ciência, +20% ouro, −2 defesa · Pântano +20% Ciência, atacar custa +20%, −20% ouro ·
  **Tundra +15% Ciência, +2 defesa, −20% ouro**.
  A Tundra trocou "+10% Força" por Ciência e "ataques contra +20%" por "+2 defesa" (para não ficar igual ao
  Pântano); com +10% Ciência ela ficava fraca (índice 0,87), com +15% fica no meio (0,95).
- Regras: o ouro vale para o que a região rende; as % de Obras/Força/Ciência somam por região desse terreno que o
  império tem (Força nos pontos de cada novo investimento militar); **a proteção do terreno (defesa e custo de
  ataque) vale só para quem ocupa**; **a região inicial conta como Campina** (ouro, defesa e Obras).
- IA: valor do alvo = ouro do terreno + afinidade do estilo (Construtor: Campina/Floresta; Científico:
  Deserto/Pântano/Tundra; Militar/Agressivo: só Colinas; Adaptativo: um pouco de todos menos Montanha).
- Aceitos: estratégia Equilibrada um pouco acima da meta (pior perfil 61% na v7; 67% na tabela final), Médio mais
  fácil com efeitos. Ficam para depois: empate Médio × Difícil no modo Só visual, Pedral (região inicial fraca),
  sem troca Xisto ↔ Velar.

## 20/11/2026 — Rodada de balanceamento (game-designer) — aprovada
Medida com ~54 mil partidas por modo (semente fixa); o repositório deu exatamente os números da proposta.
1. **Médio com terrenos com efeito**: rivais **+3% de ouro** (1,06 com 2+ rivais; 1,03 no 1×1). Só com efeitos;
   fica gravado na partida (`state.aiIncomeEffects`). A estratégia Equilibrada cai de 66% para 59% no pior caso.
2. **Mapa padrão**: **Jaspe ↔ Rochedo** (Jaspe = Montanha, Rochedo = Colinas). Com efeitos, Arvela × Zênite no 1×1
   só de IAs passa de 61/39 para 51/49.
3. **Posições iniciais** (ambos os modos): **Arvela, Zênite, Esmera, Torva, Musgo, Ombral** (Pedral saiu). Pior região
   com 4/5/6 impérios: Só visual 9/4/8% → 18/9/6%; com efeitos (padrão) 10/5/10% → 20/14/11%.
4. **Difícil e Lendário com 2+ rivais no Só visual**: rivais vão **primeiro às regiões livres**, atacando sempre; no 1×1
   e com efeitos mantêm a coligação contra o líder. **Difícil: 1,05 de ouro com 2+ rivais** nos dois modos (1×1
   continua 1,03). Só visual, jogador-IA (1/2/3 rivais): Médio 74/27/26, Difícil 29/11/16, Lendário 8/4/10.
- Impressões digitais novas: Só visual **a911f8cd** (antes e82cdda4; mudam só as partidas de 4 e 6 impérios, pelas
  posições) e Com efeitos **bda662ed** (antes 75da3210).
- Saves: partidas em curso continuam abrindo com as posições, os terrenos e a receita dos rivais com que começaram;
  a nova regra de alvos do Difícil/Lendário (Só visual, 2+ rivais) vale a partir da era seguinte.
- **Ficam para a próxima rodada**: estratégia **Agressiva no Só visual** (já ~58–67% no pior caso, acima da meta) e o
  estilo **Científico** (o mais fraco; com efeitos, como jogador-IA no Médio, 21%).

## 20/11/2026 — Rodada 2 de balanceamento (game-designer) — aprovada
Medida com ~54 mil partidas por modo (semente fixa); o repositório deu exatamente os números da proposta (0 diferenças).
1. **Reflexo de defesa**: o rival que faz fronteira com o jogador humano, quando o exército do jogador é maior que o
   dele, ganha **+15 pontos de Militar** nessa era, tirados de Obras e Ciência na proporção de cada uma. Não dispara em
   partidas só de IAs. Cada estilo mantém a sua prioridade principal.
2. **Científico decide atacar já com o desconto da Ciência** (alternativa A; os outros estilos continuam pelo custo
   cheio). Com efeitos, o Científico como jogador-IA no Médio passa de 21% para 30%.
- Efeito (Médio, pior caso por estratégia): Só visual Agressiva 67% → 52%, Militar 60% → 54%; com efeitos Equilibrada
  59% → 50%. Jogador-IA (1/2/3 rivais), Só visual: Médio 74/27/26 → 73/27/21, Difícil 29/11/16 → 22/10/11,
  Lendário 8/4/10 → 4/3/6.
- **Aceito: Difícil e Lendário ficam mais duros**, sem compensação (o ouro das dificuldades não muda).
- Impressões digitais novas: Só visual **8ba37eca** (antes a911f8cd) e Com efeitos **4010a086** (antes bda662ed).
- Saves: nada novo é gravado; partidas em curso passam a usar a IA nova a partir da era seguinte.
- **Pendências para depois**:
  - Médio no 1×1 ainda vencível quase sempre atacando todas as eras (exigiria mexer numa regra de base, como a perda
    de 20% do exército por era).
  - Zênite domina as partidas só de IAs no Só visual (3 a 6 impérios).

## 20/11/2026 — Rodada 4 de balanceamento ("só Ataque", game-designer) — aprovada
Problema: atacar em todas as eras ganhava demais com 2 ou 3 rivais (Médio 81/69%, Difícil 40/39%). Aprovado pelo
usuário, nos **dois modos de terreno** (Só visual e Com efeitos):
1. **Sorteio novo a cada partida: sim.** Cada partida nova tem a sua semente de batalha (`state.rngSeed`), guardada no
   save; saves antigos mantêm a sua. Laboratórios, testes de regressão e impressões digitais continuam com a semente
   fixa; o tutorial também (o roteiro é sempre igual).
2. **Regra A — saque limitado a 20%**: cada conquista leva no máximo 20% das Obras e da Ciência do rival (antes até 50%).
3. **Regra B — Força guardada defende**: cada ponto de Força que você não usa em ataques soma 1 à defesa das suas
   regiões, repartido como a defesa das Obras (÷ raiz do número de regiões). A Força reservada em ordens não conta.
   Vale para o custo mostrado ao jogador e para as decisões dos rivais. A folha da região mostra "Força guardada +X".
4. **Ajuste pequeno do ouro dos rivais com 2+ rivais** (A + B deixaram o Médio e o Difícil com 2–3 rivais duros
   demais): Médio 1,03 → **1,00** (com efeitos 1,06 → **1,03**), Difícil 1,05 → **1,03**. 1×1 e Lendário iguais.
- **Não aprovado**: E (rivais que reagem ao jogador) e rival "Aleatório" como padrão no Difícil/Lendário (continua
  Adaptativo). **Descartados por agora**: logística, manutenção do exército, chance de vitória variável, limite de
  ordens por era.
- Medido com ~100 mil partidas (semente fixa); o repositório deu os mesmos números do protótipo (0 diferenças).
  "Só Ataque" (todas as eras, mirando o rival; 1/2/3 rivais, os dois modos juntos): Médio 99/81/72 → 99/56/42,
  Difícil 81/48/42 → 69/34/23, Lendário 57/31/23 → 43/18/14. Pior estilo de rival no Médio: 64% → 42% (meta ≤60%).
  Jogador-IA, Só visual: Médio 74/27/25 → 69/24/11, Difícil 24/11/13 → 28/9/7, Lendário 5/3/7 → 7/2/1; com efeitos
  (mapa padrão): Médio 73/45/32 → 61/40/21, Difícil 28/7/7 → 29/10/10, Lendário 9/3/3 → 10/3/4. Muito fácil continua
  ~97–100%. Partidas de 15 eras: quase todas decididas por pontos na última era (93%), empate 4–6%.
- Impressões digitais novas: Só visual **39190b06** (antes 8ba37eca) e Com efeitos **5c97e2c2** (antes 4010a086).
- Saves em curso: passam a usar o saque de 20% e a Força guardada a partir da era seguinte; mantêm a semente, o ouro
  dos rivais e os multiplicadores com efeitos com que começaram (estão no save).
- **Pendências para depois**: Médio com 3 rivais no Só visual ficou mais duro para o jogador-IA (11%; quem ataca todas as eras
  fica entre 33 e 50%); Zênite continua a dominar as partidas só de IAs no Só visual (3 a 6 impérios: Arvela 2–13%,
  Zênite 39–64%); estilo Científico/estratégia de Ciência continuam as mais fracas.

## 20/11/2026 — Desafios e medalhas (mobile-ux) — aprovado (opção D da revisão do Difícil)
Aprovado pelo usuário **só esta opção de interface** (não Fronteira viva nem Conselheiro), **só medalhas, sem prêmio
que mude regras**, entregue junto com a rodada 4. Nenhuma regra, número ou IA mudou (impressões digitais continuam
**39190b06** / **5c97e2c2**).
- **Lista final (12)**, critérios lidos só do estado da partida:
  Primeiros passos (terminar o tutorial até o último passo; pular não conta) · Primeira coroa (vencer) ·
  Muralha (repelir 3 ataques de rivais às suas regiões na mesma partida) · Construtor (vencer com mais ouro investido em
  Obras do que em Militar e em Ciência) · Sábio (idem com Ciência) · Diplomata (vencer sem tomar região de rival) ·
  Relâmpago (vencer por domínio ou eliminação até a era 18) · Hegemonia (vencer por supremacia) · Contra a maré
  (vencer no Difícil/Lendário com 3+ rivais) · Explorador (vencer num mapa sorteado) · Terra natal (vencer com
  terrenos com efeito) · Sobrevivente (ter 5 regiões, cair para 2 ou menos e voltar a ter 5).
- **Onde**: "Nova medalha" no resumo da era (ou aviso curto se o resumo estiver desligado); faixa compacta na tela de
  resultado (medalhas da partida ou "Próximo desafio") que abre a tela **Medalhas**; tela Medalhas (estilo Atlas) pelo
  botão "Medalhas N/12" na tela inicial e no menu ☰, com conquistadas e bloqueadas (critério sempre visível).
  O "desafio da era" opcional ficou como "Próximo desafio" na tela de resultado (só quando a partida não deu medalha).
- **Tutorial**: só dá "Primeiros passos" (incentiva terminar o tutorial); a vitória na partida do tutorial não dá
  medalhas. **Laboratórios** e a dificuldade "Configurações" não dão medalhas.
- **Gravação**: chave própria por versão (`imperios-jogador-medalhas` / `imperios-dev-medalhas`), via
  `src/platform/storage.js`; dados danificados são ignorados. Cada medalha é "nova" só uma vez no aparelho.
- A folha de uma região sua mostra "Defesa X · Força guardada +Y" com os números em destaque e a explicação numa linha
  à parte (só apresentação).

## 21/11/2026 — Fim por domínio e duração "Sem limite" (game-designer) — aprovado
Problema medido: o domínio (17/24 ≈ 70%) encerrava na hora; quem chegava primeiro vencia 98–100%; a opção de 50 eras
já terminava, em média, por volta da era 26; não havia modo sem limite.
1. **"E — Domínio com escolha do jogador"**: quando o **jogador** chega a 70% antes da última era, aparece
   **"Você domina o mapa!"** com **"Vencer agora"** e **"Continuar até a era N"** (ajuda: "Continuando, você ainda
   vence por domínio no fim se mantiver 70%"). Continuando, a partida segue; no limite, com 70% vence por domínio,
   senão decidem os pontos (eliminação e supremacia continuam a valer no caminho). **A pergunta só volta se o
   jogador cair abaixo de 70% e subir de novo.** Se outra vitória acontece na mesma era (ex.: supremacia), o
   domínio conta junto, como antes. **Rival a 70% termina na hora.** Partidas só de IAs, laboratórios e saves antigos
   (sem `state.dominion`): comportamento de antes; impressões digitais iguais (**39190b06** / **5c97e2c2**).
   - **Esc / Voltar = "Vencer agora"** (opção segura: garante a vitória já conquistada; continuar é a escolha que
     arrisca e pede um toque de propósito). Foco inicial em "Vencer agora"; botões de 48 px ou mais.
   - A escolha fica no save (`state.dominion`); recarregar a meio da pergunta mostra-a de novo ao tocar em
     "Continuar". A tela de resultado mostra "Vitória por domínio do mapa!" e, quando foi no fim, "Você manteve N de
     24 regiões até a última era"; o resumo da era lembra "Você domina o mapa · mantenha 17 regiões até a era N".
2. **"Sem limite" substitui "50 · longa"** na Duração (Personalizar), com o texto "Termina por domínio, eliminação
   ou supremacia" (Conquista: "Termina por domínio ou eliminação"). **Teto de segurança de 100 eras**, decidido por
   pontos (dito de forma discreta nas regras completas e no Placar; no topo aparece "Era N/∞").
   - **Supremacia no Sem limite: conta a partir da era 15** (a mesma era de uma partida padrão de 30 eras). Medido:
     começar na era 10 ou na 15 dá o mesmo resultado; a 15 mantém a supremacia como vitória "da fase final".
   - **No Sem limite, o domínio do jogador vence na hora** (sem pergunta: não há fim para onde continuar).
   - Saves antigos de 50 eras continuam de 50; a opção "Outra" (10–150) continua. Gravado em `state.unlimited`.
3. **Medalhas: nada muda.** Relâmpago (domínio ou eliminação até a era 18) vale a era em que a vitória acontece:
   vencer agora na era 12 conta; continuar e vencer por domínio na era 30 não; numa partida de 15 eras, conta.

## 22/11/2026 — Tamanhos de mapa (game-designer + mobile-ux) — aprovado
Opção **Mapa: Original, 2×, 3×, 4×** (área do original) em Nova partida → Personalizar; campo `config.map.mapSize`
(1–4, padrão 1), gravado em `state.mapSize`. **Original idêntico** (impressões **39190b06** / **5c97e2c2**); saves
antigos = Original; o tutorial usa sempre o Original. O número de rivais continua à escolha do jogador.
- **Grades**: 6×4 (24), 8×6 (48), 10×7 (70, o retângulo mais próximo de 72 com a forma do original), 12×8 (96); mesma
  vizinhança. 72 nomes novos sem repetir (os 24 de sempre ficam nos mesmos índices). Mapa padrão de terrenos em
  mosaico do 6×4; o sorteado escala as quantidades pelo número de regiões.
- **Regras escaladas** (só nos tamanhos 2–4; k = regiões/24 = 2 / 2,92 / 4):
  - custo administrativo ÷ k (sem isto a terra deixava de render a partir de ~23 regiões);
  - territórios ÷ k na pontuação e no ICE (mesmas referências do mapa de 24);
  - passo das ordens extra na mesma era ÷ k no 1×1 e ÷ √k com 2+ rivais (ver abaixo);
  - teto do Sem limite **100 + 25 por tamanho acima** (100 / 125 / 150 / 175): com 100, algumas partidas 4× chegavam
    ao teto (a mais longa medida agora: 98 eras no 4× com 5 rivais);
  - meta de domínio (70%) e trava da supremacia (≤ 25% livres) mantidas: já são proporções.
- **Rivais recomendados** (aviso na tela, nunca obrigatório): Original 1+, 2× 2+, 3× 2+, 4× 3+. Com 2+ rivais, reagir
  à situação rende +17 a +35 pontos sobre a melhor divisão fixa e há 2–4 melhores respostas por estilo; com 1 rival
  no 3×/4× há uma só receita e 72–95 ordens de ataque por partida (repetitivo).
- **Equilibrado dominava o 1×1 nos mapas maiores** (causa: a expansão pelas regiões livres demorava, o contacto só
  vinha por volta da era 30 e as economias que se acumulam — Ciência e Obras — disparavam: receita 10× maior que a do
  Militar na era 40). Correção: ordens extra mais baratas (a 2.ª ordem da era custa ×1,5 no 2× e ×1,25 no 4× no 1×1).
  Partidas só de IAs, Médio, Sem limite (vitórias % por estilo; Original 1×1: faixa 46, Equilibrado 36):

  | Mapa, rivais | Antes: Equil. / Militar / Agress. / Científico / Construtor / Adapt. (faixa) | Depois (faixa) |
  | --- | --- | --- |
  | 2×, 1 | 64 / 38 / 30 / 68 / 34 / 66 (38) | 46 / 62 / 58 / 44 / 18 / 72 (54) |
  | 3×, 1 | 86 / 28 / 22 / 72 / 42 / 50 (64) | 66 / 52 / 58 / 38 / 22 / 64 (44) |
  | 4×, 1 | 90 / 18 / 16 / 62 / 60 / 54 (74) | 50 / 54 / 60 / 48 / 28 / 60 (32) |
  | 2×, 3 | 31 / 18 / 33 / 24 / 8 / 38 (30) | 25 / 39 / 34 / 14 / 18 / 21 (25) |
  | 3×, 3 | 41 / 5 / 31 / 31 / 13 / 29 (36) | 25 / 29 / 38 / 28 / 13 / 19 (25) |
  | 4×, 3 | 40 / 11 / 26 / 29 / 15 / 29 (29) | 33 / 28 / 38 / 14 / 8 / 31 (30) |
  | 4×, 5 | 22 / 16 / 16 / 14 / 13 / 19 (9) | 8 / 18 / 33 / 0 / 13 / 29 (33) |

  Com 2+ rivais, ÷ k deixava o Agressivo forte demais (faixa 36–43); ÷ √k fica perto do Original (3 rivais: 26).
- **Posições iniciais com 4–6 impérios** nos mapas maiores: a regra "o mais afastado possível" punha um império no
  centro (2–6% de vitória). Agora há posições escolhidas, perto da borda (`START_ORDERS_BIG`). Diferença entre a
  melhor e a pior posição (partidas só de IAs, posições rodadas entre os lugares, 240 partidas): 2× 45/44/41 →
  17/10/17; 3× 37/35/35 → 16/10/23; 4× 37/26/33 → 22/15/22 (4/5/6 impérios; medido já com a regra final das ordens). Original, para comparar: 28/35/36.
- **Jogador × IAs (Médio, Sem limite)**, melhor divisão fixa / quem reage / divisão ingênua 34/33/33, duração média e
  tempo estimado (25 s por era + 5 s por ordem): Original 1 rival 85/95/58%, 27 eras, ~12 min; 2× 1 rival 75/94/56%,
  31 eras, ~16 min; 2× 2 rivais 31/65/11%, 36 eras, ~18 min; 3× 2 rivais 38/65/23%, 40 eras, ~22 min; 4× 3 rivais
  38/51/26%, 46 eras, ~26 min. Nenhuma partida travou nem chegou ao teto.
- **Pendências**: o Construtor fica fraco com 3–5 rivais nos mapas maiores (5–18%) e o Científico no 4× com 5 rivais
  (0–2%); partidas 4× passam de 20 minutos.

## 22/11/2026 — Ciência no fim de jogo: saque reduzido + Grande Descoberta (game-designer) — opções 1 e 2 aprovadas; números para revisão
Problema medido: nos mapas maiores o Científico vencia 0–14% com 3–5 rivais. Por volta da era 40 a Ciência já é a
maior receita de **todos** os estilos (o bônus de receita bate no teto por volta da era 25 e o desconto de ataque
por volta da era 15); o fim decide-se por Força, e cada região tomada levava 20% de toda a Ciência.
Só nos mapas 2×–4× (o Original não muda: impressões **39190b06** / **5c97e2c2**):
1. **Saque de Ciência ÷ k^0,25** (`military.techPillageMapExponent` 0,25; ÷1,19 no 2×, ÷1,41 no 4×). Medidos e
   recusados: ÷k e ÷√k (Científico 40–55% com 3 rivais); teto do bônus de receita +0,25 por tamanho
   (`technology.revenueBonusCapPerSize`, deixado em 0: com ele o Científico ia a 51% no 4× com 3 rivais).
2. **Grande Descoberta**: vence quem tiver **pontos de Ciência ≥ 6000 × k** e **≥ ⌈5 × k⌉ regiões** (2×: 12.000 / 10;
   3×: 17.500 / 15; 4×: 24.000 / 20). Pontos = ouro investido em Ciência pelo próprio império × 0,2: o progresso
   saqueado **não conta** (contando, quem conquistava ganhava a corrida — Agressivo/Militar venciam 55–80% das
   Grandes Descobertas). **Reação das IAs**: rival acima de 50% da meta com mais pontos → +20 Militar e ataque a ele
   primeiro; IA perto da meta com poucas regiões → +20 Militar. **No Original fica desligada** (opção nos
   laboratórios): ligada com os mesmos números, o Científico ia a 38/43/42% (1/3/5 rivais) e a faixa entre estilos
   piorava com 3–5 rivais (26 → 34, 23 → 39); precisaria de calibração própria.

Partidas só de IAs, Médio, Sem limite (Científico % · faixa entre estilos · duração média / mais longa · finais por
Grande Descoberta):

| Mapa, rivais (justo) | Antes | Depois |
| --- | --- | --- |
| 2×, 1 (50) | 44 · 54 · 33 / 53 | 60 · 48 · 33 / 52 · 8% |
| 3×, 1 (50) | 38 · 44 · 34 / 52 | 56 · 40 · 34 / 49 · 9% |
| 4×, 1 (50) | 48 · 32 · 36 / 57 | 64 · 46 · 35 / 48 · 13% |
| 2×, 3 (25) | 14 · 25 · 41 / 71 | 31 · 26 · 37 / 52 · 41% |
| 3×, 3 (25) | 28 · 25 · 42 / 79 | 40 · 30 · 39 / 51 · 51% |
| 4×, 3 (25) | 14 · 30 · 45 / 67 | 40 · 38 · 41 / 60 · 61% |
| 2×, 5 (17) | 10 · 18 · 41 / 69 | 24 · 15 · 37 / 50 · 44% |
| 3×, 5 (17) | 5 · 23 · 44 / 85 | 15 · 7 · 39 / 51 · 48% |
| 4×, 5 (17) | 0 · 33 · 46 / 83 | 17 · 11 · 41 / 56 · 47% |

Jogador × IAs (melhor divisão fixa · melhor plano fixo com Ciência ≥ 40% · ganho de quem reage): 2× 2 rivais
31 · 28 · +33 → 29 · 24 · +22; 3× 2 rivais 38 · 25 · +27 → 39 · 18 · +19; 3× 3 rivais 25 · 9 · +35 → 25 · 15 · +25;
4× 3 rivais 38 · 27 · +14 → 36 · 24 · +6. Um plano de Ciência **que reforça a Força quando faltam regiões** chega a
46–59% nesses cenários (o melhor plano; a receita a vigiar).
- **Fora da meta (para o usuário decidir)**: Científico um pouco acima no 1×1 do 4× (64%, meta 35–60) e com 3 rivais no 3×/4× (40%,
  meta 15–35); faixa pior no 4× com 1 e 3 rivais (32 → 46, 30 → 38); a Grande Descoberta decide cerca de metade das
  partidas com 3–5 rivais; o Construtor continua fraco (6–22%).

## 22/11/2026 — Maravilha da Humanidade (vitória por Obras) e Força militar mantida (game-designer) — aprovado
Problema: o Construtor vencia 8–14% com 3–5 rivais nos mapas maiores (14–28% no 1×1): as Obras rendem durante 12 eras
e acabam, ele tem a menor Força e, quando vencia, era quase sempre pela Grande Descoberta.
- **Maravilha da Humanidade** (só mapas 2×–4×; no Original desligada, opção `endgame.wonder`): vence quem tiver
  **pontos de Maravilha ≥ 3000 × k** e **≥ ⌈4 × k⌉ regiões** (2×: 6.000 / 8; 3×: 8.750 / 12; 4×: 12.000 / 16).
  Pontos = ouro investido em Obras **só nas eras em que Obras foi a maior fatia** do investimento do império × 0,2 (sem
  essa condição o Equilibrado, com economia maior, acumulava tanto como o Construtor); o saque não conta. Reação das
  IAs igual à da Grande Descoberta (esta tem prioridade quando as duas corridas estão ativas).
- Partidas só de IAs, Médio, Sem limite (média de 2 lotes de sementes; Construtor % / Científico % · menor entre
  Militar e Agressivo · faixa · finais domínio/Grande Descoberta/Maravilha):

  | Mapa, rivais | Antes | Depois |
  | --- | --- | --- |
  | 2×, 1 | 14 / 63 · 48 · 52 · 89/10/– | 26 / 61 · 46 · 37 · 82/8/8 |
  | 3×, 1 | 28 / 61 · 40 · 41 · 88/11/– | 35 / 59 · 40 · 33 · 78/8/12 |
  | 4×, 1 | 22 / 65 · 39 · 45 · 82/16/– | 34 / 58 · 38 · 32 · 76/10/11 |
  | 2×, 3 | 10 / 32 · 20 · 26 · 60/38/– | 22 / 26 · 20 · 18 · 55/26/14 |
  | 3×, 3 | 10 / 44 · 16 · 36 · 48/50/– | 18 / 36 · 15 · 24 · 49/35/12 |
  | 4×, 3 | 8 / 39 · 20 · 32 · 44/54/– | 14 / 32 · 21 · 21 · 42/44/9 |
  | 2×, 5 | 14 / 23 · 14 · 14 · 57/42/– | 18 / 22 · 12 · 16 · 50/28/18 |
  | 3×, 5 | 13 / 17 · 16 · 8 · 50/47/– | 21 / 15 · 12 · 10 · 48/28/21 |
  | 4×, 5 | 12 / 19 · 15 · 13 · 52/48/– | 22 / 15 · 14 · 14 · 50/26/22 |

  A partida mais longa continua a acabar perto da era 60 (teto 125–175). Jogador × IAs, melhor plano fixo com Obras
  ≥ 50% (distância ao melhor): 2× 2 rivais 29% (0) → 51% (é o melhor plano); 3× 3 rivais 17% (−8) → 19% (−2); 4× 1
  rival 51% (−20) → 64% (−6); 4× 3 rivais 19% (−18) → 21% (−14).
- **Força militar mantida** (não aprovado reduzir): com a Maravilha, desgaste 0,2 → 0,3, Força por investimento ×0,8
  ou custo de conquista +0,2 por era levavam o Científico a 64–96% no 1×1 e o Militar/Agressivo a 3–9% com 3–5 rivais
  (faixa até 74); Força ×0,9 com a meta da Grande Descoberta 8000 também deixava o Científico em 70–71% no 1×1.
- Original com a Maravilha ligada (sem a Grande Descoberta): quase nada muda (Construtor 25/16/12 → 24/18/12% com
  1/3/5 rivais) — fica desligada.
- **Pendências**: Construtor ainda abaixo de 35% no 1×1 do 2× (26%) e 14% no 4× com 3 rivais; domínio decide 76–82%
  dos 1×1; no 2× com 2 rivais o plano de Obras virou a melhor receita do jogador (reagir −9).

## 23/11/2026 — Opções de idioma: regras e base técnica (game-designer) — aprovado aplicar
- Idiomas: **pt-BR** (origem e reserva), **en**, **pt-PT**, **it**, **de**, **fr**. Regras completas e glossário-base em
  `docs/idiomas.md`; dicionários em `src/i18n/` (o `tradutor` extrai e traduz os textos; o `mobile-ux` cria o seletor).
- Idioma padrão: `?lang=xx` (testes, não grava) › escolha gravada no aparelho (`imperios-idioma`, fora do save da
  partida) › idioma do aparelho (pt-PT → pt-PT; outros pt → pt-BR; en/it/de/fr pelas duas letras) › pt-BR.
- Trocar de idioma (também no meio da partida) muda só a exibição: a partida, o save e a impressão digital das
  simulações (`39190b06`) não mudam. Laboratórios (`?dev=1`), chaves internas e valores salvos não se traduzem.
- Nomes próprios: **regiões iguais em todos os idiomas**; **rivais traduzidos como cores** (Crimson, Ochre, Indigo,
  Violet, Turquoise…); **"Você" traduzido**; **IMPÉRIOS traduzido** — EMPIRES (en, fr), IMPÉRIOS (pt-PT), IMPERI (it),
  IMPERIEN (de). A confirmar antes da publicação: se o nome do app no ícone fica único ("Impérios").
- Números no formato de cada idioma (`Intl`); o pt-BR continua 1.234,5.
