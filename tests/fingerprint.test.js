// A impressão digital das simulações com semente fixa tem de continuar igual à referência.
// Se este teste falhar, alguma mudança alterou o resultado de partidas (regras, IA ou aleatoriedade).
// Ver tests/fingerprint.js.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame } = require("./helpers");
const { EXPECTED, fingerprintInPage } = require("./fingerprint");

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

test(`impressão digital das simulações com SEED fixo continua ${EXPECTED}`, async () => {
  const { context, page, errors } = await openGame(browser);
  const out = await page.evaluate(fingerprintInPage);
  await context.close();
  assert.deepEqual(errors, []);
  assert.equal(out.pass, out.total, `testes internos: ${out.tests}`);
  assert.equal(out.all, EXPECTED, "impressão digital mudou; subcódigos: " + JSON.stringify(out.parts));
});
