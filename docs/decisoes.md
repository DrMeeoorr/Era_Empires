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
