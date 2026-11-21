// "Impressão digital" das simulações com semente fixa (SEED).
// Calcula um código curto (hash FNV-1a) a partir de 27 partidas e simulações: se QUALQUER número de
// qualquer era mudar, o código muda. Serve para provar que uma refatoração não alterou o jogo.
// Referência atual: 39190b06 — rodada 4 de balanceamento (20/11/2026): saque das Obras e da Ciência limitado a 20%
// (antes até 50%) e a Força guardada (não usada em ordens) soma à defesa, ÷ raiz das regiões. Mudam todos os
// subcódigos menos sim_infrastructure.
// Antes: 8ba37eca — rodada 2 de balanceamento (20/11/2026): o Científico decide atacar já com o desconto
// da Ciência (muda todos os match_* e fixed, onde há lugares do Científico) e o reflexo de defesa dos rivais contra
// o jogador humano (só nas simulações com jogador: mudam sim_balanced e sim_military; sim_infrastructure e
// sim_technology ficam iguais).
// Antes disso: a911f8cd — rodada de balanceamento de 20/11/2026: nova ordem das posições iniciais no mapa de 24
// regiões (Arvela, Zênite, Esmera, Torva, Musgo, Ombral); mudam só os subcódigos match_4_* e match_6_*.
// E antes: e82cdda4 (rebalanceamento: Obras dão defesa, Ciência barateia ataques, Ciência rende após 2 eras, Difícil/Hardcore atacam o líder).
// As dificuldades não entram nestas partidas (só IAs), por isso o ouro do Médio/Difícil (rodada 4: 1,00/1,03) e
// "regiões livres primeiro" não as mudam. A semente nova a cada partida também não: estas partidas usam SEED fixo.
//
// Uso direto: node tests/fingerprint.js        (imprime os dois códigos — terreno só visual e com efeitos — e os subcódigos)
// Na suíte:   tests/fingerprint.test.js (faz parte do `npm test`).
"use strict";

const EXPECTED = "39190b06";
// Segunda impressão digital: as mesmas partidas com os terrenos COM EFEITOS (mapa padrão e sorteado).
// Muda se mudar a tabela dos terrenos (src/core/terrain.js) ou a forma como a IA os escolhe.
// Atual: 5c97e2c2 — rodada 4 de balanceamento (20/11/2026): saque até 20% e Força guardada que defende (mudam todos
// os subcódigos).
// Antes: 4010a086 — rodada 2 de balanceamento (20/11/2026): o Científico decide atacar já com o desconto da Ciência
// (mudam todos os subcódigos; o reflexo de defesa não entra, porque estas partidas são só de IAs).
// Antes disso: bda662ed — rodada de balanceamento de 20/11/2026: mapa padrão com Jaspe ↔ Rochedo (todos os fx_padrao_*) e
// nova ordem das posições iniciais (fx_sorteado_4/6 e fx_fixed). Antes disso: 75da3210.
const EXPECTED_EFFECTS = "5c97e2c2";

/** Corre dentro da página do jogo. Devolve {tests, all, parts}. */
function fingerprintInPage() {
  const h = (str) => { let x = 0x811c9dc5; for (const ch of str) { x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16).padStart(8, "0"); };
  const t = runTests();
  const profs = LAB_PROFILES.map((x) => x[0]);
  const parts = {};
  for (const civCount of [2, 4, 6])
    for (const mode of ["slow", "fast"]) {
      const c = clone(DEFAULTS); c.map.aiCount = civCount - 1;
      const recs = [];
      for (let g = 0; g < 4; g++) {
        const m = runMatch(c, { mode, profiles: profs, civCount, seed: fixedGameSeed(SEED, g), game: g });
        recs.push({ r: m.result, tl: m.state.timeline, o: m.state.owners });
      }
      parts[`match_${civCount}_${mode}`] = h(JSON.stringify(recs));
    }
  { const c = clone(DEFAULTS); parts.fixed = h(JSON.stringify(runFixedGame(c, { eras: 60, mode: "slow", profiles: profs, civCount: 3, seed: SEED, game: 1 }))); }
  for (const st of ["balanced", "military", "infrastructure", "technology"]) {
    const c = clone(DEFAULTS);
    parts["sim_" + st] = h(JSON.stringify(simulate(st, 40, c, null, undefined, null, "slow").history));
  }
  return { tests: t.pass + "/" + t.total, pass: t.pass, total: t.total, all: h(JSON.stringify(parts)), parts };
}

/** Corre dentro da página do jogo: partidas só de IAs com os terrenos com efeitos. Devolve {all, parts}. */
function fingerprintEffectsInPage() {
  const h = (str) => { let x = 0x811c9dc5; for (const ch of str) { x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16).padStart(8, "0"); };
  const profs = LAB_PROFILES.map((x) => x[0]);
  const parts = {};
  for (const type of ["padrao", "sorteado"])
    for (const civCount of [2, 4, 6])
      for (const mode of ["slow", "fast"]) {
        const c = clone(DEFAULTS); c.map.aiCount = civCount - 1;
        const recs = [];
        for (let g = 0; g < 3; g++) {
          const m = runMatch(c, { mode, profiles: profs, civCount, seed: fixedGameSeed(SEED, g), game: g, terrain: { type, seed: 1000 + g, effects: true } });
          recs.push({ r: m.result, tl: m.state.timeline, o: m.state.owners, t: m.state.terrain });
        }
        parts[`fx_${type}_${civCount}_${mode}`] = h(JSON.stringify(recs));
      }
  { const c = clone(DEFAULTS); parts.fx_fixed = h(JSON.stringify(runFixedGame(c, { eras: 40, mode: "slow", profiles: profs, civCount: 4, seed: SEED, game: 1, terrain: { type: "sorteado", seed: 77, effects: true } }))); }
  return { all: h(JSON.stringify(parts)), parts };
}

module.exports = { EXPECTED, EXPECTED_EFFECTS, fingerprintInPage, fingerprintEffectsInPage };

if (require.main === module) {
  const { launch, openGame } = require("./helpers");
  (async () => {
    const browser = await launch();
    try {
      const { page, errors } = await openGame(browser, { dev: true });
      const out = await page.evaluate(fingerprintInPage);
      console.log(JSON.stringify(out, null, 1));
      console.log(out.all === EXPECTED ? `OK: impressão digital ${out.all} igual à referência.` : `DIFERENTE: ${out.all} (referência ${EXPECTED}).`);
      const fx = await page.evaluate(fingerprintEffectsInPage);
      console.log(JSON.stringify(fx, null, 1));
      console.log(fx.all === EXPECTED_EFFECTS ? `OK: impressão digital com terrenos com efeitos ${fx.all} igual à referência.` : `DIFERENTE (terrenos com efeitos): ${fx.all} (referência ${EXPECTED_EFFECTS}).`);
      if (errors.length) console.log("ERROS", errors);
      process.exitCode = out.all === EXPECTED && fx.all === EXPECTED_EFFECTS && !errors.length ? 0 : 1;
    } finally { await browser.close(); }
  })();
}
