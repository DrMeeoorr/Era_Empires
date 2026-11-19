// "Impressão digital" das simulações com semente fixa (SEED).
// Calcula um código curto (hash FNV-1a) a partir de 27 partidas e simulações: se QUALQUER número de
// qualquer era mudar, o código muda. Serve para provar que uma refatoração não alterou o jogo.
// Referência atual: e82cdda4 (após o rebalanceamento: Obras dão defesa, Ciência barateia ataques, Ciência rende após 2 eras, Difícil/Hardcore atacam o líder).
//
// Uso direto: node tests/fingerprint.js        (imprime o código e os subcódigos de cada grupo)
// Na suíte:   tests/fingerprint.test.js (faz parte do `npm test`).
"use strict";

const EXPECTED = "e82cdda4";

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

module.exports = { EXPECTED, fingerprintInPage };

if (require.main === module) {
  const { launch, openGame } = require("./helpers");
  (async () => {
    const browser = await launch();
    try {
      const { page, errors } = await openGame(browser);
      const out = await page.evaluate(fingerprintInPage);
      console.log(JSON.stringify(out, null, 1));
      console.log(out.all === EXPECTED ? `OK: impressão digital ${out.all} igual à referência.` : `DIFERENTE: ${out.all} (referência ${EXPECTED}).`);
      if (errors.length) console.log("ERROS", errors);
      process.exitCode = out.all === EXPECTED && !errors.length ? 0 : 1;
    } finally { await browser.close(); }
  })();
}
