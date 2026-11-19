// Executa os testes funcionais internos do jogo (defineTests / runTests) e falha se algum falhar.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame } = require("./helpers");

// Número mínimo de testes internos: se diminuir, alguém apagou testes.
const MIN_INTERNAL_TESTS = 140;

let browser, ctx;
before(async () => {
  browser = await launch();
  ctx = await openGame(browser);
});
after(async () => browser && browser.close());

test("todos os testes internos (runTests) passam", async () => {
  const r = await ctx.page.evaluate(() => {
    const r = runTests();
    const reg = testRegistry();
    const failed = reg.filter((t) => !ftResults.get(t.id).ok).map((t) => `${t.id} · ${t.name} → ${ftResults.get(t.id).msg}`);
    return { ...r, ms: ftHistory[0].ms, failed };
  });
  console.log(`  testes internos: ${r.pass}/${r.total} aprovados em ${Math.round(r.ms)} ms`);
  assert.ok(r.total >= MIN_INTERNAL_TESTS, `Esperava pelo menos ${MIN_INTERNAL_TESTS} testes internos, há ${r.total}`);
  assert.deepEqual(r.failed, [], "Testes internos falharam:\n" + r.failed.join("\n"));
  assert.equal(r.pass, r.total);
  assert.deepEqual(ctx.errors, []);
});

test("testes internos têm identificadores únicos e todos pertencem a uma categoria conhecida", async () => {
  const r = await ctx.page.evaluate(() => {
    const reg = testRegistry();
    const cats = new Set(TEST_CATS.map(([c]) => c));
    return {
      ids: reg.map((t) => t.id),
      names: reg.map((t) => t.name),
      badCat: reg.filter((t) => !cats.has(t.cat)).map((t) => t.name),
    };
  });
  assert.equal(new Set(r.ids).size, r.ids.length, "ids repetidos");
  assert.equal(new Set(r.names).size, r.names.length, "nomes de testes repetidos");
  assert.deepEqual(r.badCat, []);
});

test("executar os testes internos não altera a partida em curso nem a configuração", async () => {
  const r = await ctx.page.evaluate(() => {
    const before = JSON.stringify({ state, configApplied, gameMode, currentDifficulty });
    runTests();
    return before === JSON.stringify({ state, configApplied, gameMode, currentDifficulty });
  });
  assert.ok(r, "runTests() alterou o estado global do jogo");
});
