// Laboratório "Configurações" (?dev=1): leitura e validação dos campos.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, MOBILE_SCREENS } = require("./helpers");

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

test("Configurações — campo numérico vazio é recusado com erro visível e mantém o valor anterior", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: MOBILE_SCREENS[0][1], dev: true });
  await page.locator("#homeLab").click();
  const field = page.locator('[data-param="economy.baseIncome"]');
  for (const bad of ["", "   "]) {
    await field.fill(bad);
    await page.locator("#applyConfig").click();
    const r = await page.evaluate(() => ({
      applied: configApplied.economy.baseIncome, edited: configEdited.economy.baseIncome,
      status: document.getElementById("labStatus").className, msg: document.getElementById("labStatus").textContent,
    }));
    assert.equal(r.applied, 22, `campo ${JSON.stringify(bad)} virou receita base ${r.applied} (devia recusar e manter 22)`);
    assert.equal(r.edited, 22, "o valor em edição também não pode virar 0");
    assert.match(r.status, /error/);
    assert.match(r.msg, /Receita base/);
  }
  // "Salvar configuração JSON" e "Reiniciar com configuração atual" também recusam.
  await page.locator("#restartWithConfig").click();
  assert.equal(await page.evaluate(() => configApplied.economy.baseIncome), 22);
  assert.match(await page.locator("#labStatus").getAttribute("class"), /error/);
  // Com um número válido volta a funcionar.
  await field.fill("25");
  await page.locator("#applyConfig").click();
  assert.equal(await page.evaluate(() => configApplied.economy.baseIncome), 25);
  assert.match(await page.locator("#labStatus").getAttribute("class"), /success/);
  assert.deepEqual(errors, []);
  await context.close();
});
