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
- **Mapa padrão** (tabela fixa, na ordem das regiões):
  Campina: Arvela, Cardo, Esmera, Ivara, Urzal, Vau, Zênite · Floresta: Gralha, Musgo, Ombral, Velar ·
  Colinas: Dorna, Jaspe, Pedral · Montanha: Quartzo, Rochedo, Xisto · Deserto: Hélia, Salgar ·
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
