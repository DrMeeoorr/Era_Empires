# Idiomas do Impérios

Regras de idioma da interface do jogador e glossário-base. Decisão registrada em `docs/decisoes.md` (23/11/2026).
O agente `tradutor` mantém este arquivo (glossário) e os dicionários; o `mobile-ux` cria o seletor de idioma.

## 1. Idiomas suportados

| Código  | Nome no seletor (nativo) | Números (`Intl`) | Observações |
|---------|--------------------------|------------------|-------------|
| `pt-BR` | Português (Brasil)       | `1.234,5`        | **Origem e reserva** (fallback): chave que falta em outro idioma aparece em pt-BR. |
| `en`    | English                  | `1,234.5`        | Inglês neutro/americano. |
| `pt-PT` | Português (Portugal)     | `1234,5` · `12 345,5` | Norma do pt-PT: sem separador com só 4 algarismos. |
| `it`    | Italiano                 | `1234,5` · `12.345,5` | Norma do italiano: idem. |
| `de`    | Deutsch                  | `1.234,5`        | Tratamento por "du". |
| `fr`    | Français                 | `1 234,5`        | Espaço fino como separador de milhar; tratamento por "vous". |

A lista e os nomes nativos estão em `SUPPORTED_LANGUAGES` (`src/i18n/index.js`). O nome de cada idioma no seletor
aparece **sempre na própria língua** (não se traduz).

## 2. Qual idioma o jogo usa

No arranque (`initLanguage`, chamado por `src/ui/boot.js` antes de desenhar qualquer tela), por prioridade:

1. **`?lang=xx` no endereço** — para testes, capturas e revisão do tradutor (`index.html?lang=de`,
   `dev.html?lang=fr`). Aceita as mesmas formas que o aparelho (`?lang=pt-pt`, `?lang=en-GB`). **Não é gravado.**
   Código não suportado é ignorado.
2. **Escolha do jogador gravada no aparelho** (`setLanguage`), na chave `imperios-idioma` do armazenamento
   (`src/platform/storage.js`). É uma preferência do aparelho, **independente do save da partida**: não entra em
   `serializeGame`, não é apagada por "Nova partida" nem pela recuperação de save danificado, e vale para a versão do
   jogador e para a de desenvolvimento.
3. **Idioma do aparelho** (`navigator.languages`, na ordem; o primeiro suportado ganha):
   - `pt-PT` → pt-PT; qualquer outro português (`pt`, `pt-BR`, `pt-AO`, `pt-MZ`…) → **pt-BR**;
   - `en-*`, `it-*`, `de-*`, `fr-*` → `en`, `it`, `de`, `fr` (pelas duas primeiras letras).
   O padrão do aparelho **não é gravado** (se o jogador mudar o idioma do celular, o jogo acompanha até ele escolher
   um no seletor).
4. Nenhum suportado → **pt-BR**.

`languageSource` informa de onde veio o idioma atual (`url`, `saved`, `device`, `session`, `default`).

## 3. Trocar de idioma

- `setLanguage(code)` troca na hora: atualiza `<html lang>`, o título da aba, o HTML estático (`data-i18n…`), avisa
  quem desenha a tela (`onLanguageChange` e o evento `imperios:language` em `window`) e grava a escolha.
  O arranque já liga `onLanguageChange` a `renderAll()` (partida). Telas que montam texto em JS (tela inicial, Nova
  partida, medalhas, tutorial, relatório) devem registrar o seu próprio `onLanguageChange` ao passarem a usar `t()`.
- **Trocar no meio da partida não muda nada no jogo**: só a exibição. Não regrava o save, não muda `state`, não muda
  sementes nem a ordem dos sorteios. A impressão digital das simulações (`npm run fingerprint`, hoje `39190b06`) tem
  de ser a mesma em qualquer idioma (verificado em `tests/i18n.test.js`).
- O motor (`src/core`, `src/ai`) **não importa** `src/i18n` (regra de ouro de `tests/structure.test.js`). Os textos
  que o motor guarda (registro de eventos, motivos de recusa, resultado) continuam como estão; a tradução deles é
  feita **só na exibição** (como já faz `uiText()` para o pt-BR).

## 4. O que se traduz e o que não

Traduz-se: tudo o que o jogador vê na versão do jogador — telas, botões, `aria-label`/`title`, toasts, modais,
tutorial, Como jogar, relatórios, medalhas, nomes mostrados das dificuldades/estilos/terrenos/vitórias, título da aba.

**Não** se traduz:
- **Laboratórios e ferramentas** (só com `?dev=1` / `dev.html`): Configurações, Testes funcionais, Balanceamento,
  Validação das IAs, Experimentos, Exportar. Continuam em pt-BR, inclusive os números (`fmtBR`/`moneyBR` em
  `src/ui/format.js`; os laboratórios já importam essas versões).
- **Chaves internas e valores salvos**: `hardcore`, `muitofacil`, `medio`, `sorteado`, `padrao`, `technologist`,
  `economist`, ids das civilizações, nomes guardados no estado (`civ.name = "Rubro"`), `LAB_PROFILES`,
  `DIFFICULTIES[*].name` usados pelos laboratórios. Para mostrar traduzido, a interface converte a chave interna
  em `t("…")` na hora de desenhar; o save continua igual em todos os idiomas.
- Nada que entre na impressão digital das simulações ou nos snapshots de regressão.
- Os nomes nativos dos idiomas no seletor.

## 5. Nomes próprios (decisão)

| O quê | Decisão | Motivo |
|-------|---------|--------|
| **Regiões** (Arvela … Zênite) | **Iguais em todos os idiomas**, inclusive a grafia (Zênite também em pt-PT). | São nomes inventados de lugares; mudar quebraria a memória do mapa entre idiomas, capturas e conversas entre jogadores, e não há tradução "certa". |
| **Rivais** (Rubro, Ocre, Anil, Violeta, Turquesa) | **Traduzidos como cores** (tabela abaixo). Símbolos ▲ ● ◆ ■ ✚ iguais. | O nome é a cor da bandeira: em outro idioma "Rubro" não diria nada; a cor traduzida mantém a ligação nome ↔ cor que foi o motivo da escolha (Opção A "Cores"). No save fica o nome pt-BR (chave); a tradução é só na exibição. |
| **"Você"** (o jogador ★) | **Traduzido**. | É um pronome, não um nome. |
| **IMPÉRIOS** (nome do jogo) | **Traduzido**: EMPIRES (en, fr), IMPÉRIOS (pt-PT), IMPERI (it), IMPERIEN (de). | É uma palavra comum, não uma marca registrada; o jogador deve entender o nome na loja e na tela inicial. A Play Store aceita título por idioma na ficha da loja. A fonte Marcellus SC tem todos os caracteres. Em alemão, "Imperien" (plural de Imperium) é reconhecível e curto, e evita o ambíguo "Reiche" (= "os ricos"). *Ponto a confirmar antes da publicação*: o nome do app instalado (ícone) é único por pacote; se o usuário quiser um só nome de app, usar "Impérios" no ícone e o nome traduzido só dentro do jogo e na ficha da loja. |

Nomes dos rivais (revisado pelo tradutor em 23/11/2026; em uso nos dicionários):

| pt-BR | en | pt-PT | it | de | fr |
|-------|----|-------|----|----|----|
| Rubro ▲ | Crimson | Rubro | Cremisi | Karmin | Carmin |
| Ocre ● | Ochre | Ocre | Ocra | Ocker | Ocre |
| Anil ◆ | Indigo | Anil | Indaco | Indigo | Indigo |
| Violeta ■ | Violet | Violeta | Viola | Violett | Violet |
| Turquesa ✚ | Turquoise | Turquesa | Turchese | Türkis | Turquoise |
| Você ★ | You | Você | Tu | Du | Vous |

Em pt-BR os rivais são masculinos ("o Rubro"); nos outros idiomas os nomes aparecem **sem artigo** e concordam no
masculino ("Carmin a été éliminé", "Cremisi è stato eliminato", "Karmin wurde ausgelöscht"). Em pt-PT os nomes ficam
iguais aos do pt-BR. O jogador como objeto da frase: en "you", it "te", de "dir", fr/pt "vous"/"você" (`civ.youObj`).

## 6. Glossário (final — revisado pelo tradutor em 23/11/2026)

Um termo = uma tradução, em todo o jogo. Maiúscula inicial quando é nome de recurso/modo, como no pt-BR.

| pt-BR | en | pt-PT | it | de | fr |
|-------|----|-------|----|----|----|
| Ouro | Gold | Ouro | Oro | Gold | Or |
| Força | Might | Força | Forza | Stärke | Force |
| Obras | Works | Obras | Opere | Bauten | Travaux |
| Ciência | Science | Ciência | Scienza | Forschung | Science |
| era | era | era | era | Ära | ère |
| região | region | região | regione | Region | région |
| rival / rivais | rival / rivals | rival / rivais | rivale / rivali | Rivale / Rivalen | rival / rivaux |
| Domínio (vitória por 70% do mapa) | Domination | Domínio | Dominio | Vorherrschaft | Domination |
| Supremacia | Supremacy | Supremacia | Supremazia | Vormacht | Suprématie |
| Clássica (vitória) | Classic | Clássica | Classica | Klassisch | Classique |
| Grande Descoberta | Great Discovery | Grande Descoberta | Grande Scoperta | Große Entdeckung | Grande Découverte |
| Maravilha da Humanidade | Wonder of Humanity | Maravilha da Humanidade | Meraviglia dell'Umanità | Wunder der Menschheit | Merveille de l'Humanité |
| **Dificuldades** | | | | | |
| Muito fácil | Very easy | Muito fácil | Molto facile | Sehr leicht | Très facile |
| Fácil | Easy | Fácil | Facile | Leicht | Facile |
| Médio | Medium | Médio | Medio | Mittel | Moyen |
| Difícil | Hard | Difícil | Difficile | Schwer | Difficile |
| Lendário | Legendary | Lendário | Leggendario | Legendär | Légendaire |
| **Estilos das IAs** | | | | | |
| Equilibrado | Balanced | Equilibrado | Equilibrato | Ausgewogen | Équilibré |
| Militar | Military | Militar | Militare | Militärisch | Militaire |
| Agressivo | Aggressive | Agressivo | Aggressivo | Aggressiv | Agressif |
| Construtor | Builder | Construtor | Costruttore | Baumeister | Bâtisseur |
| Científico | Scientific | Científico | Scientifico | Forscher | Scientifique |
| Adaptativo | Adaptive | Adaptativo | Adattivo | Flexibel | Adaptatif |
| Aleatório | Random | Aleatório | Casuale | Zufällig | Aléatoire |
| **Terrenos** | | | | | |
| Campina | Plains | Campina | Pianura | Ebene | Plaine |
| Floresta | Forest | Floresta | Foresta | Wald | Forêt |
| Colinas | Hills | Colinas | Colline | Hügel | Collines |
| Montanha | Mountain | Montanha | Montagna | Gebirge | Montagne |
| Deserto | Desert | Deserto | Deserto | Wüste | Désert |
| Pântano | Swamp | Pântano | Palude | Sumpf | Marais |
| Tundra | Tundra | Tundra | Tundra | Tundra | Toundra |
| **Outros** | | | | | |
| Jogar | Play | Jogar | Gioca | Spielen | Jouer |
| Nova partida | New game | Nova partida | Nuova partita | Neues Spiel | Nouvelle partie |
| Ritmo: Normal / Rápido | Pace: Normal / Fast | Ritmo: Normal / Rápido | Ritmo: Normale / Veloce | Tempo: Normal / Schnell | Rythme : Normal / Rapide |
| Sem limite | Unlimited | Sem limite | Senza limite | Unbegrenzt | Sans limite |
| Medalhas | Medals | Medalhas | Medaglie | Medaillen | Médailles |
| Idioma | Language | Idioma | Lingua | Sprache | Langue |

Notas de escolha: en "Might" (curto, comum em jogos de estratégia) em vez de "Strength"/"Military power"; de
"Forschung" em vez de "Wissenschaft" (mais curto para botões e chips), "Forscher"/"Flexibel" para caber nas etiquetas
de estilo; fr "Travaux" (como em "travaux publics") para Obras.

| **Termos da interface (acrescentados na tradução)** | | | | | |
| Terrenos (título, botão ⓘ) | Terrain | Terrenos | Terreni | Gelände | Terrains |
| Força guardada | reserve Might | Força guardada | Forza di riserva | Stärke-Reserve | Force en réserve |
| Placar | Scoreboard | Classificação | Classifica | Rangliste | Classement |
| Conquista (modo de vitória) | Conquest | Conquista | Conquista | Eroberung | Conquête |
| Eliminação | Elimination | Eliminação | Eliminazione | Auslöschung | Élimination |
| Militar (área de investimento) | Military | Militar | Militare | Militär | Militaire |
| Concluir era | End era | Concluir era | Concludi l'era | Ära beenden | Terminer l'ère |
| Como jogar | How to play | Como jogar | Come si gioca | Spielanleitung | Comment jouer |
| Personalizar | Customize | Personalizar | Personalizza | Anpassen | Personnaliser |
| Mapa Padrão / Sorteado | Standard / Random | Padrão / Sorteado | Standard / Sorteggiata | Standard / Ausgelost | Standard / Au hasard |
| Só visual / Com efeitos | Visual only / With effects | Só visual / Com efeitos | Solo visivi / Con effetti | Nur optisch / Mit Effekten | Visuels / Avec effets |
| Planos: Equilibrado, Ataque, Economia, Ciência, Limpar | Balanced, Attack, Economy, Science, Clear | (= pt-BR) | Equilibrato, Attacco, Economia, Scienza, Pulisci | Ausgewogen, Angriff, Wirtschaft, Forschung, Leeren | Équilibré, Attaque, Économie, Science, Effacer |
| saque | plunder | saque | bottino | Beute | butin / pillage |
| Ordem (de ataque) | order | ordem | ordine | Befehl | ordre |
| Medalhas | Medals | Medalhas | Medaglie | Medaillen | Médailles |
| Tutorial | Tutorial | Tutorial | Tutorial | Tutorial | Tutoriel |

Tratamento: en neutro; pt-PT "você"/impessoal ("Ainda tem…", "Toque numa…"); it "tu"; de "du"; fr "vous".
Ordinais (`format.ordinal`, `ord()` em `src/ui/format.js`): pt "1.º" (fem. "1.ª"), en "1st/2nd/3rd", it "1º", de "1.",
fr "1er/2e". Em fr usa-se espaço fino (`\u202f`) antes de `: ; ! ? %` e dentro de « ».

## 7. Como usar no código (`src/i18n/index.js`)

- **Texto**: `t("home.play")`, com marcadores `t("common.rivals", {n: 3})` → "3 rivais". Nunca montar frases juntando
  pedaços traduzidos (a ordem das palavras muda entre idiomas).
- **Plural**: no dicionário, `{one: "{n} rival", other: "{n} rivais"}`; a forma vem de `params.count` ou `params.n`
  (`Intl.PluralRules` do idioma; em francês 0 é singular). Use também `zero`/`few`/`many` se um idioma precisar;
  `other` é sempre a reserva.
- **Números**: parâmetros numéricos são formatados no idioma (até 2 casas); para outra precisão passe o texto já
  formatado com `fmt(n, d)` (`src/ui/format.js`, que segue o idioma) ou `formatNumber(n, d)`. `money(n)` e
  `goldShort(n)` usam as chaves `format.gold` / `format.goldShort`.
- **HTML estático** (`dev.html`; `index.html` é gerado com `npm run build:jogador`):
  `data-i18n="chave"` (texto), `data-i18n-html="chave"` (HTML vindo só do dicionário, nunca de dados do jogador),
  `data-i18n-attr="aria-label:common.back;title:outra.chave"` (atributos). O texto escrito no HTML continua a ser o
  pt-BR. `applyI18n(elemento)` aplica a um pedaço de HTML criado depois.
- **Chaves**: estáveis, agrupadas por tela (`app.*`, `home.*`, `setup.*`, `game.*`, `map.*`, `report.*`,
  `tutorial.*`, `medals.*`, `help.*`, `terrain.*`, `format.*`, `settings.*`). O pt-BR é a fonte; os outros arquivos
  só têm chaves que existem no pt-BR e com os mesmos marcadores (verificado em `tests/i18n.test.js`).
- **Chave esquecida**: `t()` devolve a própria chave e a anota em `missingKeys` (sem erro no console).
- **Campos de valor**: `fmtInput`/`parseAmount` (`src/ui/format.js`) usam o separador decimal do idioma (ponto em en,
  vírgula nos outros); aceitam também a outra forma, e trocar o idioma a meio regrava os campos sem mudar o valor.
- **Textos do motor**: `engineText()` (`src/ui/labels.js`) reconhece cada frase do motor (registo, recusas, resultado) e
  monta-a com as chaves `log.*`, `refuse.*`, `result.*`, `reason.*`; em pt-BR continua a usar `uiText()`. Frase nova no
  motor sem regra em `ENGINE_RULES` aparece em pt-BR (não quebra) — acrescentar a regra e as chaves.
- **Nomes mostrados**: rivais por `civDisplayName()`/`rivalDisplayName()`, estilos por `playerProfileName()`,
  dificuldades por `diffName()`, terrenos por `terrainName()`, medalhas por `medalName()`/`medalGoal()`.
- **Plural com zero**: `{zero:"…", one:"…", other:"…"}` — "zero" vale para o número 0 em qualquer idioma (o Intl trata
  0 como singular em pt-BR e fr).

## 8. Dúvidas de tradução (para o usuário decidir)

1. **Força → en "Might"** (glossário-base) — alternativa "Strength"/"Power". "Força guardada" ficou "reserve Might".
2. **Obras → fr "Travaux"** e **de "Bauten"**: soam um pouco técnicos; alternativas fr "Ouvrages"/"Constructions",
   de "Bauwerke". A "Maravilha" conta "Baupunkte"/"points de Travaux".
3. **Ciência → de "Forschung"** (mais curto que "Wissenschaft"): o estilo "Científico" ficou "Forscher" (substantivo),
   que no resumo aparece em maiúscula entre parênteses ("3 Rivalen (Forscher)").
4. **Domínio × Supremacia em alemão**: "Vorherrschaft" (70% do mapa) e "Vormacht" (supremacia) são quase sinónimos
   para um leitor alemão; alternativa: "Gebietsherrschaft" para o domínio.
5. **Placar** em pt-PT ficou "Classificação" (em Portugal "placar" não se usa; "marcador" é de desporto).
6. **"Você" em pt-PT**: mantido como nome do jogador no mapa (decisão de docs/idiomas.md), mas nas frases usei o
   tratamento impessoal ("Domina o mapa!"). Alternativa: "Tu" no mapa.
7. **Nome do jogo em it/de**: "IMPERI" / "IMPERIEN" conforme a decisão; confirmar antes da publicação (ícone).
8. **Nomes das medalhas**: traduzidos pelo sentido (Muralha → Bulwark / Muraglia / Bollwerk / Rempart; Contra a maré →
   Against the tide / Controcorrente / Gegen den Strom / À contre-courant). Confirmar se preferem nomes mais curtos.
9. **Dicas dos terrenos** ("Campos abertos", "Charco e juncos"…) foram adaptadas, não traduzidas palavra a palavra.
10. **Regiões com palavras portuguesas** (Musgo, Névoa, Pedral… e os 72 nomes dos mapas grandes) ficam iguais em todos
    os idiomas, como decidido; para quem não fala português são só nomes. "Jaspe é montanha, Musgo é floresta" na
    descrição do mapa ficou com os nomes originais.
