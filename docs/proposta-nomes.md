# Proposta — nomes das regiões e dos rivais

> **Status: aprovada (Opção A "Cores" + nome e número pequeno no mapa) e implementada na versão do jogador em 19/11/2026.**
> Diferenças da proposta: a cor do rival 5 (Turquesa) passou a `#3cb8e0` (mais azul e mais clara que o verde-jade do jogador);
> no Placar a variação usa ↑/↓ (o ▲ é o símbolo do Rubro); na legenda do mapa, Livre e "Pode atacar" usam quadrados (o ● é do Ocre).
> Base: decisões de 19/11/2026 ("Regiões com nome no lugar dos números 01–24" e "Rivais com nome próprio").

## 1. Regiões (24 nomes)

Tema: terras de um império antigo, com fantasia leve (relevo, plantas, pedras, clima). Nenhum é cidade,
país ou marca conhecida. Todos têm **no máximo 7 letras**, para caber em uma linha no quadrado do mapa
em um celular de 360 px (cada quadrado tem cerca de 50 px de largura).

**Ideia principal: no mapa, os nomes seguem a ordem alfabética, da esquerda para a direita e de cima para baixo.**
Assim o jogador encontra "Jaspe" ou "Rochedo" tão fácil quanto encontrava o "10" ou o "17". Só a letra V se repete.

| | col. 1 | col. 2 | col. 3 | col. 4 | col. 5 | col. 6 |
|---|---|---|---|---|---|---|
| **linha 1** | Arvela (01) | Brumas (02) | Cardo (03) | Dorna (04) | Esmera (05) | Fenda (06) |
| **linha 2** | Gralha (07) | Hélia (08) | Ivara (09) | Jaspe (10) | Lumen (11) | Musgo (12) |
| **linha 3** | Névoa (13) | Ombral (14) | Pedral (15) | Quartzo (16) | Rochedo (17) | Salgar (18) |
| **linha 4** | Torva (19) | Urzal (20) | Vau (21) | Velar (22) | Xisto (23) | Zênite (24) |

Hoje o jogador começa em Arvela (01) e o 1.º rival em Zênite (24). No tutorial, o alvo do jogador é o
território 9: passaria a ser **Ivara**.

### Como ficaria no mapa 6×4

Hoje cada quadrado mostra: número grande ("09") + dono pequeno ("livre", "Seu", "IA") + "Def. 3" quando é alvo.

- **Opção recomendada — só o nome:** o nome ocupa o lugar do número (em negrito, ~11 px); embaixo, o
  **símbolo do dono** (★ você, ▲ ◆ ● ■ ✚ rivais, nada se for livre) e, se for alvo, "Def. 3".
  O número some do mapa, mas continua no rótulo de acessibilidade ("Ivara, região 9, livre") para quem usa leitor de tela.
- **Opção alternativa — nome + número pequeno:** "Ivara" em cima e "9" bem pequeno no canto. Ajuda na
  transição, mas soma mais um texto em um quadrado já apertado no celular de 360 px.

Nos textos (painel de ataque, relatório da era, registro de eventos): "Ataque bem-sucedido: **Ivara** (livre)" no
lugar de "território 9". Como esses textos são guardados pelo motor, a troca deve ser feita na hora de
mostrar (como já foi feito para "u." → "de ouro"), para manter a impressão digital `5917a5c2`.

## 2. Rivais (até 5) e o jogador

Cada um tem **nome + símbolo + cor**, para que dê para distinguir mesmo sem ver a cor (daltonismo, tela
ao sol). As cores são as que o jogo já usa no mapa (`CIV_COLORS`). Os símbolos são formas simples, que
aparecem iguais em qualquer Android: ★ ▲ ◆ ● ■ ✚.

### Opção A — "Cores/brasões" (recomendada)

| Lugar | Nome | Cor (`CIV_COLORS`) | Símbolo |
|---|---|---|---|
| Jogador | **Você** | `#2c9d87` verde-jade | ★ |
| Rival 1 | **Rubro** | `#bd5268` vermelho | ▲ |
| Rival 2 | **Ocre** | `#c98a2e` âmbar | ● |
| Rival 3 | **Anil** | `#5b7fd6` azul | ◆ |
| Rival 4 | **Violeta** | `#9a5cc4` roxo | ■ |
| Rival 5 | **Turquesa** | `#3fa3a8` azul-esverdeado | ✚ |

- Iniciais diferentes (R, O, A, V, T), nomes curtos (até 8 letras).
- O nome já diz a cor: a legenda quase não é necessária ("o Rubro atacou" → procurar o vermelho com ▲).
- "Ocre" no lugar de "Âmbar"/"Dourado" para não confundir com o **Ouro** (moeda) nem com o **contorno dourado** (alvos).

### Opção B — "Reinos"

| Lugar | Nome | Cor | Símbolo |
|---|---|---|---|
| Jogador | **Você** | verde-jade | ★ |
| Rival 1 | **Carmésia** | vermelho | ▲ |
| Rival 2 | **Aurélia** | âmbar | ● |
| Rival 3 | **Bóreas** | azul | ◆ |
| Rival 4 | **Vésper** | roxo | ■ |
| Rival 5 | **Talassa** | azul-esverdeado | ✚ |

- Mais clima de "império", mas o jogador precisa decorar qual cor é de quem (Bóreas é azul?), e os
  nomes são mais longos para o mapa e o Placar.

### Recomendação: **Opção A (Cores/brasões)**

É a que se entende mais rápido na primeira partida (meta: menos de 2 minutos), cabe melhor nos
espaços curtos do celular e segue o exemplo "Rubro" que já está nas decisões.

### Onde aparece o estilo da IA (Agressivo, Científico…) hoje e depois

| Lugar | Hoje | Com nome próprio |
|---|---|---|
| Legenda do mapa | "● IA · Adaptativo" | "▲ Rubro · Adaptativo" (ou "· estilo oculto") |
| Quadrado do mapa | "IA" | só o símbolo ▲ |
| Placar | "1.º IA 550" | "1.º ▲ Rubro 550" |
| Condições de vitória | "IA · Adaptativo  17 / 17" | "▲ Rubro · Adaptativo  17 / 17" |
| Configurar partida | "IA 1 [estilo ▾]" | "▲ Rubro [estilo ▾]" |
| Relatório da era / registro de eventos | "IA conquistou: território 18" | "Rubro conquistou: Rochedo" |
| Resultado | "Estilos dos rivais: IA — Adaptativo (sorteado)" | "Rubro jogou como **Adaptativo** (sorteado)" |

O **nome** passa a ser a identidade do rival; o **estilo** fica como etiqueta pequena e secundária.

### Pontos de atenção para a implementação (depois de aprovado)

- O nome "IA"/"IA 2" também aparece em textos que entram na impressão digital (decisões das IAs nas
  simulações). Para manter `5917a5c2`, os nomes novos devem ser dados **só nas partidas do jogador**
  (em `newGame()`), sem mudar `newCiv()` nem as simulações dos laboratórios.
- A cor do rival 5 (`#3fa3a8`) é parecida com a do jogador (`#2c9d87`). O símbolo (✚ × ★) resolve a
  distinção, mas vale considerar outra cor para o rival 5 na Fase 2/3.
- Nos gráficos, o jogador aparece em **dourado** (`CHART_COLORS[0]`) e no mapa em **verde**. Com nomes e
  símbolos, convém usar a mesma cor nos dois (fica para a Fase 2/3, porque é mudança visual).
- Hoje o jogo permite até 3 rivais na tela de configuração (o motor aceita 5); a tabela já cobre os 5.
