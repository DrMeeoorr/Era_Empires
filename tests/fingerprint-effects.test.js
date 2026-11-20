// Segunda impressão digital: as partidas só de IAs com os terrenos COM EFEITOS (mapa padrão e sorteado) têm de dar
// sempre o mesmo código. Muda se mudar a tabela dos terrenos, a forma como a IA os escolhe ou alguma regra.
// A primeira (terreno só visual, a911f8cd desde 20/11/2026; antes e82cdda4) está em tests/fingerprint.test.js. Ver tests/fingerprint.js.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame } = require("./helpers");
const { EXPECTED, EXPECTED_EFFECTS, fingerprintEffectsInPage } = require("./fingerprint");

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

test(`impressão digital com terrenos com efeitos continua ${EXPECTED_EFFECTS} (e é outra que a do jogo só visual)`, async () => {
  const { context, page, errors } = await openGame(browser, { dev: true });
  const a = await page.evaluate(fingerprintEffectsInPage);
  const b = await page.evaluate(fingerprintEffectsInPage);
  await context.close();
  assert.deepEqual(errors, []);
  assert.equal(a.all, b.all, "com a mesma semente, duas execuções deviam dar o mesmo código");
  assert.notEqual(a.all, EXPECTED);
  assert.equal(a.all, EXPECTED_EFFECTS, "impressão digital com efeitos mudou; subcódigos: " + JSON.stringify(a.parts));
});
