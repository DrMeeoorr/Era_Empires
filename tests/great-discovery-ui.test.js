// Grande Descoberta na interface (mapas 2×–4×): texto em Personalizar, faixa do seu progresso no topo, barras no
// Placar, aviso quando um rival passa da metade da meta e a tela de vitória. No Original nada disto aparece.
// Os estados "perto da meta" e "meta alcançada" são forçados no estado da partida (só para testar a interface).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, openCustomize, concludeEraUI, dismissModals, horizontalOverflow, MOBILE_SCREENS } = require("./helpers");

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());
const PIXEL7 = { ...MOBILE_SCREENS[0][1], reducedMotion: "reduce" };

test("Original: sem faixa da Grande Descoberta e sem o texto em Personalizar", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.equal(await page.locator("#mapSizeGd").isVisible(), false);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => !document.getElementById("game").hidden);
  assert.equal(await page.locator("#statDiscovery").isVisible(), false, "no Original a faixa não aparece");
  assert.doesNotMatch(await page.locator("#victoryPanel").innerHTML(), /Grande Descoberta/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("4×: Personalizar explica a regra, faixa no topo, Placar, aviso de rival e vitória pela Grande Descoberta", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
  await page.locator("#homeStart").click();
  await page.locator('#homeOpponents [data-ai="3"]').click();
  await openCustomize(page);
  await page.locator('[data-map-size="4"]').click();
  const rule = await page.locator("#mapSizeGd").innerText();
  assert.match(rule, /Grande Descoberta: junte 24\.000 pontos de Ciência .*pelo menos 20 regiões\. Os rivais atacam/);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => state.owners.length === 96);

  // Faixa do topo: começa em 0 e mostra as regiões que faltam.
  const hud = page.locator("#statDiscovery");
  assert.ok(await hud.isVisible(), "a faixa da Grande Descoberta devia aparecer");
  assert.match(await hud.getAttribute("aria-label"), /0 de 24\.000 pontos de Ciência.*regiões 1 de 20, faltam 19/);
  const box = await hud.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 413, "a faixa cabe na largura da tela");

  // Perto da meta: 23.100 pontos e 18 regiões; Rubro com 13.000 (passou da metade).
  await page.evaluate(() => {
    P(state).invested.technology = 23100 / 0.2; state.civs[1].invested.technology = 13000 / 0.2;
    for (let i = 0; i < state.owners.length && state.owners.filter((o) => o === "player").length < 18; i++) if (state.owners[i] === "neutral") state.owners[i] = "player";
    renderAll();
  });
  // Nos mapas 2×–4× a faixa mostra as duas corridas lado a lado (% e regiões); os números exatos ficam no leitor de tela.
  const gdPart = page.locator('#statDiscovery [data-race="discovery"]');
  assert.match(await gdPart.innerText(), /96%/);
  assert.match(await gdPart.innerText(), /18\/20/);
  assert.match(await hud.getAttribute("aria-label"), /Grande Descoberta: 23\.100 de 24\.000 pontos de Ciência \(96%\).*faltam 2/);
  assert.deepEqual(await horizontalOverflow(page), []);
  const panel = await page.locator("#victoryPanel").innerText();
  assert.match(panel, /Grande Descoberta: 24\.000 pontos de Ciência \+ 20 regiões/);
  assert.match(panel, /18 de 20 regiões · faltam 2/);
  assert.equal(await page.locator("#victoryPanel [data-gd]").count(), 4, "uma barra por império");

  // Aviso: Ocre passa da metade nesta era → resumo da era em tela cheia.
  await page.evaluate(() => { const b = eraSnapshot(); state.civs[2].invested.technology = 12500 / 0.2; showEraSummary(b); });
  await page.locator("#eraSummary").waitFor();
  assert.match(await page.locator("#eraSummary").innerText(), /Ocre está a caminho da Grande Descoberta/);
  await dismissModals(page);
  // O jogador passando da metade: aviso de que os rivais vão reagir.
  await page.evaluate(() => { const b = eraSnapshot(); b.gd.discovery.player = 0.4; showEraSummary(b); });
  assert.match(await page.locator("#eraSummary").innerText(), /Você passou da metade da Grande Descoberta[\s\S]*rivais vão reagir/);
  await dismissModals(page);

  // Meta alcançada com 21 regiões: no fim da era vence pela Grande Descoberta.
  await page.evaluate(() => {
    P(state).invested.technology = 24500 / 0.2;
    for (let i = 0; i < state.owners.length && state.owners.filter((o) => o === "player").length < 21; i++) if (state.owners[i] === "neutral") state.owners[i] = "player";
    renderAll();
  });
  await concludeEraUI(page);
  await page.waitForFunction(() => !!state.result);
  assert.ok((await page.evaluate(() => state.result.reasons.player)).includes("discovery"));
  const res = await page.locator("#resultScreen").innerText();
  assert.match(res, /Vitória pela Grande Descoberta!/);
  assert.match(res, /24\.500\s*pontos de Ciência/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("3×: derrota quando um rival faz a Grande Descoberta", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
  await page.evaluate(() => { configApplied.map.aiCount = 2; configApplied.map.mapSize = 3; startNewGame(); document.getElementById("homeScreen").hidden = true; showView("game"); });
  await page.evaluate(() => {
    const r = state.civs[1]; r.invested.technology = 18000 / 0.2;
    for (let i = 0; i < state.owners.length && state.owners.filter((o) => o === r.id).length < 16; i++) if (state.owners[i] === "neutral") state.owners[i] = r.id;
    renderAll();
  });
  await concludeEraUI(page);
  await page.waitForFunction(() => !!state.result);
  const res = await page.locator("#resultScreen").innerText();
  assert.match(res, /Derrota: Rubro fez a Grande Descoberta/);
  assert.match(res, /venceu pela Grande Descoberta/);
  assert.deepEqual(errors, []);
  await context.close();
});
