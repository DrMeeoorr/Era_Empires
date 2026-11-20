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
