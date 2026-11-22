# Avaliação: recursos online (ranking semanal durante eventos)

22/11/2026 · Revisão do código atual (`main` + propostas de temporada) · **Nada do jogo foi alterado.**

## 1. Resumo

- **É viável** e encaixa bem nas temporadas propostas (`docs/propostas-modo-temporada.md`), **desde que** o ranking
  seja de um **desafio com semente fixa** (todos jogam a mesma partida da semana) e que o servidor **refaça a partida**
  a partir das jogadas para conferir a pontuação.
- O motor já é quase pronto para isso: regras e IAs são JavaScript puro, sem tela, com sorteios por semente.
  No teste, **600 de 600** partidas gravadas no Node e refeitas no Chromium deram **o mesmo resultado** (vencedor,
  donos das regiões e pontuação).
- O jogo hoje é **100% offline, sem conta e sem servidor** — essa é a maior mudança, mais de produto e privacidade do
  que de código. O ranking deve ser **opcional**: quem não entra continua com o jogo idêntico ao de hoje.
- Recomendação: começar com um **"Desafio da Semana" com ranking verificado**, num backend pequeno
  (funções em JavaScript), **sem login obrigatório** (apelido + identificador anônimo do aparelho).

## 2. O que o código atual permite

| Ponto | Situação hoje | Consequência para o ranking |
|---|---|---|
| Regras e IAs (`src/core`, `src/ai`) | Sem DOM, rodam no Node (os 159 testes internos já rodam lá) | O servidor pode usar **o mesmo código** do jogo para refazer a partida |
| Sorteio das batalhas | `rand(seed)` em `src/core/rng.js`; semente em `state.rngSeed` | Determinístico ✔ |
| Partes com `Math.random` | Semente das batalhas, posição inicial, terreno sorteado e estilo "Aleatório" do rival (`src/app/session.js`) | No modo ranqueado essas 4 sementes/escolhas precisam vir **do desafio da semana**, não do aparelho |
| Ações do jogador | `orderAttack`/`cancelOrder` (mapa) + `playEra({military,infrastructure,technology})` + `chooseDominion` | Basta **gravar essa lista** — ~2 KB por partida |
| Pontuação | `finalScores` em `src/core/endgame.js` é **relativa aos rivais da partida** | Só é comparável entre jogadores **com a mesma partida inicial** → ranking por desafio, não global |
| Save | `localStorage` via `src/platform/storage.js` (JSON editável) | Não confiar no save; o servidor só aceita o registro de jogadas |
| Rede | Nenhum `fetch` no código; o jogo promete funcionar sem internet | Precisa de um módulo novo `src/platform/online.js`, isolado como o `storage.js` |
| Publicação | GitHub Pages (estático) + app Android planejado (Capacitor) | O cliente continua estático; o servidor é à parte (precisa de CORS para o site) |

## 3. Teste feito: a partida pode ser conferida por outro aparelho?

Programa em Node: um "jogador" aleatório jogou partidas de 1 a 3 rivais, mapas padrão e sorteado, terrenos com e
sem efeito, Médio, 30 eras. Gravei o estado inicial, a configuração e as ações; depois refiz a partida só com isso.

| Teste | Resultado |
|---|---|
| Gravado no Node → refeito no Node | **600/600** idênticas, até o último dígito |
| Gravado no Node (V8 do Node 22) → refeito no Chromium 157 | **600/600** com mesmo vencedor, mesmos donos das regiões e mesma pontuação (6 casas) |
| Comparação dígito a dígito no Chromium | 0/600 idênticas: diferenças só na **17ª casa decimal** (ex.: `0.24977920908563037` vs `…034`), já conhecidas (`tests/internal-node.test.js`, `Math.pow`) |
| Tamanho do registro | ~2 KB por partida (26 eras em média) |
| Custo para refazer | ~20–25 ms por partida no Node → 10 mil envios por semana ≈ 4 min de CPU |

**Conclusão:** a conferência funciona, mas o servidor deve comparar o **resultado** (vencedor, era, regiões,
pontuação arredondada), não um código do estado inteiro. Esse ruído de último dígito *poderia*, em casos raros, virar
uma batalha decidida no limite. Não aconteceu em 600 partidas. Para eliminar o risco de vez, há a opção de arredondar
alguns valores no motor, mas isso muda as impressões digitais (`39190b06`/`5c97e2c2`) e exige uma rodada do
game-designer. Proponho deixar para depois e medir com envios reais.

## 4. Riscos e como tratar

| Risco | Gravidade | Tratamento |
|---|---|---|
| **Pontuação inventada** (editar o save ou o envio) | Alta | Servidor refaz a partida com o motor; só vale o resultado dele |
| **Repetir até acertar** (a semente da semana é conhecida; recarregar o save antes de uma batalha) | Média | Opção A: **1 tentativa oficial** por semana, registrada no servidor ao começar (casa com o Desafio do Dia da proposta B). Opção B: aceitar "melhor de várias" como parte do desafio. Decisão de design |
| **Robôs** que jogam milhares de vezes offline para achar a melhor sequência | Média | Impossível impedir num jogo determinístico; a tentativa única (opção A) reduz muito o efeito |
| **Versão diferente das regras** entre aparelho e servidor | Média | Registro leva a versão das regras; regras **congeladas durante o evento**; servidor mantém o motor de cada versão ativa |
| **Diferença de ponto flutuante** entre motores | Baixa (0/600) | Comparar o resultado com tolerância; registrar divergências; arredondamento no motor se aparecer caso real |
| **Apelidos ofensivos** | Média | Lista de palavras bloqueadas + apelidos gerados ("Rubro 4821") como padrão |
| **Privacidade / LGPD / Play Store** | Média | Ver seção 6 |
| **Jogo sem internet** | Baixa | O envio fica na fila e sai quando houver rede; jogar nunca depende do servidor |

## 5. Opções de backend

| Opção | Confere a partida? | Esforço | Custo | Observação |
|---|---|---|---|---|
| **Google Play Games – Leaderboards** | **Não** (o cliente envia o número) | Baixo | Grátis | Só Android, exige conta Google e plugin Capacitor; sem conferência a fraude é fácil. Bom só como vitrine |
| **Firebase** (Firestore + Cloud Functions em Node) | **Sim** — roda `src/core` + `src/ai` como estão | Médio | Plano grátis cobre o início | Login anônimo pronto; App Check reduz envios de fora do app |
| **Supabase** (Postgres + Edge Functions em Deno) | Sim (V8, módulos ES) | Médio | Plano grátis | Ranking em SQL é simples |
| **Cloudflare Workers + D1** | Sim (V8) | Médio | Muito baixo | Muito rápido; menos pronto em autenticação |
| Servidor próprio | Sim | Alto | Variável | Não compensa nesta fase |

**Recomendação:** Firebase ou Supabase, com **função em JavaScript que importa os mesmos módulos do jogo**.
Assim o código das regras não é duplicado.

## 6. Produto, privacidade e loja

- **Opcional e explícito:** botão "Ranking da semana"; na primeira vez, pedir só um apelido. Sem e-mail ou conta
  Google no início.
- **Dados guardados:** identificador anônimo, apelido, registros de jogadas e resultados. Política de privacidade
  publicada e formulário **Segurança dos dados** da Play Store atualizados. LGPD: direito de apagar (botão "Apagar meus
  dados do ranking").
- **Público infantil:** se a classificação etária incluir menores de 13, apelidos livres e ranking público pedem mais
  cuidado (*Families Policy*). Apelidos gerados resolvem a maior parte.
- **Android:** a permissão de internet não aparece para o usuário (é "normal"), mas a promessa "funciona sem internet"
  deve continuar verdadeira para todo o resto.
- **Sem monetização ligada ao ranking**, como nas medalhas e temporadas: prêmios só de honra (moldura, título
  "Top 10 da semana").

## 7. Como seria o "Desafio da Semana" ranqueado

1. Toda segunda o servidor publica o desafio: sementes (batalhas, posição, terreno), rivais e estilos, dificuldade,
   decreto da temporada e versão das regras. Funciona também offline com uma tabela embutida no app (como na proposta
   de temporadas), mas o ranking só vale com o desafio do servidor.
2. O jogador toca em "Jogar desafio" → (opção A) o servidor registra a tentativa → a partida começa com tudo fixo.
3. O jogo grava cada ação no estado (`state.actions`), salvo junto com a partida.
4. No fim, envia `{desafio, versão, ações}`. O servidor refaz a partida, calcula o resultado e grava.
5. **Ordem do ranking:** vitória antes de derrota → era em que venceu (mais cedo é melhor) → pontuação final →
   horário do envio (desempate).
6. Tela de ranking: Top 50 + "sua posição" + amigos por código (opcional, fase 2).

### Mudanças no código (para quando for aprovado)

| Passo | Onde | Muda as regras? |
|---|---|---|
| Gravar ações do jogador (`state.actions`) | `src/app/session.js` (`playEra`, `chooseDominion`) e `src/ui/map.js` (ordens) → passar por funções da sessão | Não |
| `newGame({challenge})`: sementes e rivais vindos do desafio, sem `Math.random` | `src/app/session.js` | Não (partidas normais iguais) |
| Função `replayMatch(desafio, ações)` sem DOM + teste no Node e no navegador | `src/core/` + `tests/` | Não |
| `src/platform/online.js` (único lugar com `fetch`, como o `storage.js`) + fila offline | novo | Não |
| Telas: entrar, desafio, ranking | `src/ui/` (mobile-ux) | Não |
| Função do servidor + regras de acesso ao banco | repositório/pasta à parte | — |

Impressões digitais e os 159 testes internos não mudam, porque nada disso toca nas regras. Estimativa: ~2–3 semanas
de trabalho para uma primeira versão (1 semana de cliente, 1 de servidor, ~1 de telas e testes).

## 8. Decisões para o usuário

1. **Aceitar ter servidor e dados online?** (até hoje o projeto é 100% offline)
2. **Tentativa única por semana** (justo, mais tenso) ou **melhor de várias** (mais partidas, mais fácil de abusar)?
3. **Identidade:** apelido anônimo (recomendado) ou conta Google / Play Games?
4. **Backend:** Firebase ou Supabase (recomendados) — ou só Play Games Leaderboards, sem conferência?
5. **Ordem:** fazer primeiro as temporadas offline (A + D) e o ranking depois, ou junto com o Desafio do Dia (B)?

---
*Programas do teste de conferência: pasta temporária da sessão (`scratchpad/replay/`), fora do repositório.*
