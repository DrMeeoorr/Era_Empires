// Tipos de vitória escolhidos em Personalizar (config.endgame.victories): chaves por tipo, Descoberta/Maravilha só nos
// mapas 2×–4×, aviso quando só sobram eliminação e pontos, resumos, e a partida respeitando a escolha (Placar, topo,
// Como jogar). O padrão (tudo ligado) é o jogo de sempre.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, openCustomize, assertClickable, horizontalOverflow, MOBILE_SCREENS } = require("./helpers");

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());
const PIXEL7 = { ...MOBILE_SCREENS[0][1], reducedMotion: "reduce" };
const SMALL = { ...MOBILE_SCREENS[2][1], reducedMotion: "reduce" };
const sw = (page, k) => page.locator(`#victoryTypes [data-victory="${k}"]`);

test("Personalizar: padrão com tudo ligado; no Original Descoberta e Maravilha ficam desabilitadas; alvos de 48 px", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: SMALL });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.match(await page.locator("#victoryTypesSummary").innerText(), /^Domínio · Supremacia$/);
  await page.locator("#victoryTypes > summary").click();
  for (const k of ["dominion", "supremacy"]) { assert.equal(await sw(page, k).isChecked(), true); assert.equal(await sw(page, k).isDisabled(), false); }
  for (const k of ["discovery", "wonder"]) {
    assert.equal(await sw(page, k).isDisabled(), true, `${k} devia estar desabilitada no Original`);
    assert.match(await page.locator(`[data-vtxt="${k}"]`).innerText(), /Só em mapas 2×, 3× e 4×/);
  }
  assert.match(await page.locator("#victoryAlways").innerText(), /Sempre valem: eliminar todos os rivais e pontos no fim/);
  for (const k of ["dominion", "supremacy"]) {
    const box = await assertClickable(page, `[data-vrow="${k}"]`, k);
    assert.ok(box.height >= 47.5, `${k}: ${box.height} px`);
  }
  // Supremacia anda junto com Clássica/Conquista.
  await page.locator('[data-vrow="supremacy"]').click();
  assert.equal(await page.locator("#homeConquest").getAttribute("aria-pressed"), "true");
  await page.locator("#homeClassic").click();
  assert.equal(await sw(page, "supremacy").isChecked(), true);
  // Tudo desligado: aviso curto.
  assert.equal(await page.locator("#victoryNoneTip").isVisible(), false);
  await page.locator('[data-vrow="dominion"]').click();
  await page.locator('[data-vrow="supremacy"]').click();
  assert.match(await page.locator("#victoryNoneTip").innerText(), /A partida termina por eliminação ou pontos no fim/);
  assert.match(await page.locator("#homeVictoryDesc").innerText(), /^Só eliminação dos rivais\./);
  assert.match(await page.locator("#customizeSummary").innerText(), /vitória por conquista · sem Domínio/);
  assert.deepEqual(await horizontalOverflow(page), []);
  assert.deepEqual(errors, []);
  await context.close();
});

test("3× sem Domínio e sem Maravilha: estado da partida, topo, Placar, resumo e Como jogar respeitam a escolha", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  await page.locator('[data-map-size="3"]').click();
  await page.locator("#victoryTypes > summary").click();
  assert.equal(await sw(page, "discovery").isDisabled(), false);
  await page.locator('[data-vrow="dominion"]').click();
  await page.locator('[data-vrow="wonder"]').click();
  assert.match(await page.locator("#victoryTypesSummary").innerText(), /^Supremacia · Descoberta$/);
  assert.match(await page.locator("#setupSummary").innerText(), /sem Domínio · sem Maravilha/);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => state.owners.length === 70);
  const st = await page.evaluate(() => ({ v: state.victories, gd: !!state.greatDiscovery, wd: !!state.wonder }));
  assert.deepEqual(st.v, { dominion: false, supremacy: true, discovery: true, wonder: false });
  assert.equal(st.gd, true); assert.equal(st.wd, false);
  // Topo: terras sem o mínimo da maioria; faixa só com a Grande Descoberta.
  assert.doesNotMatch(await page.locator("#statTerr").innerText(), /\//);
  assert.equal(await page.locator('#statDiscovery [data-race="wonder"]').count(), 0);
  assert.equal(await page.locator('#statDiscovery [data-race="discovery"]').count(), 1);
  // Placar: sem a maioria territorial e sem a Maravilha; diz o que está desligado.
  const panel = await page.locator("#victoryPanel").innerText();
  assert.doesNotMatch(panel, /Maioria territorial/);
  assert.doesNotMatch(panel, /Maravilha da Humanidade:/);
  assert.match(panel, /Desligadas nesta partida: Domínio, Maravilha da Humanidade/);
  assert.match(panel, /Grande Descoberta:/);
  assert.match(await page.locator("#matchInfo").textContent(), /sem Domínio · sem Maravilha/);
  // Como jogar: some Domínio e Maravilha.
  const shown = await page.evaluate(() => [...document.querySelectorAll(".pg-win>div")].filter((e) => !e.hidden).map((e) => e.querySelector("b").textContent));
  assert.deepEqual(shown, ["Eliminação", "Supremacia", "Pontos", "Grande Descoberta"]);
  assert.equal(await page.evaluate(() => document.querySelector('[data-wd-rule]').closest("[data-victory-only]").hidden), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test("padrão: partida sem o campo de tipos de vitória e Como jogar com todos os tipos", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
  await page.locator("#homeStart").click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => state.era === 1 && !document.getElementById("game").hidden);
  assert.equal(await page.evaluate(() => state.victories), undefined);
  assert.match(await page.locator("#statTerr").innerText(), /\/17/);
  assert.match(await page.locator("#victoryPanel").innerText(), /Maioria territorial/);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".pg-win>div")].filter((e) => e.hidden).length), 0);
  assert.deepEqual(errors, []);
  await context.close();
});
