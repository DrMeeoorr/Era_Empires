// Maravilha da Humanidade na interface (mapas 2×–4×): texto em Personalizar, faixa do topo junto da Grande Descoberta
// (mesma altura), aviso na divisão do ouro quando Obras não é a maior fatia, bloco do Placar, aviso de rival no resumo
// da era e as telas de vitória (só Maravilha e Maravilha + Grande Descoberta) e de derrota. No Original nada aparece.
// Os estados "perto da meta" e "meta alcançada" são forçados no estado da partida (só para testar a interface).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, openCustomize, concludeEraUI, dismissModals, horizontalOverflow, MOBILE_SCREENS } = require("./helpers");

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());
const PIXEL7 = { ...MOBILE_SCREENS[0][1], reducedMotion: "reduce" };
const SMALL = { ...MOBILE_SCREENS[2][1], reducedMotion: "reduce" };
const grow = (page, id, n) => page.evaluate(([id, n]) => {
  for (let i = 0; i < state.owners.length && state.owners.filter((o) => o === id).length < n; i++) if (state.owners[i] === "neutral") state.owners[i] = id;
  renderAll();
}, [id, n]);

test("Original: sem Maravilha no topo, no Placar, na divisão do ouro nem em Personalizar", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.equal(await page.locator("#mapSizeGd").isVisible(), false);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => !document.getElementById("game").hidden);
  await page.evaluate(() => setAlloc([80, 40, 22]));
  assert.equal(await page.locator("#statDiscovery").isVisible(), false);
  assert.doesNotMatch(await page.locator("#infraPrev").innerText(), /Maravilha/);
  assert.equal(await page.locator("#wonderHint").isVisible(), false);
  assert.doesNotMatch(await page.locator("#victoryPanel").innerHTML(), /Maravilha/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("4×: regra em Personalizar, faixa com as duas corridas, aviso das Obras, Placar, resumo e vitória pela Maravilha", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
  await page.locator("#homeStart").click();
  await page.locator('#homeOpponents [data-ai="3"]').click();
  await openCustomize(page);
  await page.locator('[data-map-size="4"]').click();
  assert.match(await page.locator("#mapSizeGd").innerText(), /Maravilha da Humanidade: junte 12\.000 pontos de Obras, contando só as eras em que Obras é o seu maior investimento, com pelo menos 16 regiões\. Os rivais atacam/);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => state.owners.length === 96);

  // Faixa: as duas corridas numa linha só (não ocupa mais altura que a da Grande Descoberta sozinha).
  const hud = page.locator("#statDiscovery");
  assert.ok(await hud.isVisible());
  assert.equal(await hud.locator(".gd-part").count(), 2);
  assert.ok((await hud.boundingBox()).height <= 32, "a faixa das corridas devia ter uma linha só");
  await page.evaluate(() => { P(state).wonderInvested = 9300 / 0.2; state.civs[1].wonderInvested = 7000 / 0.2; });
  await grow(page, "player", 18);
  const wd = page.locator('#statDiscovery [data-race="wonder"]');
  assert.match(await wd.innerText(), /78%/);
  assert.match(await wd.innerText(), /18\/16/);
  assert.match(await hud.getAttribute("aria-label"), /Maravilha da Humanidade: 9\.300 de 12\.000 pontos de Obras \(78%\); regiões 18 de 16, mínimo atingido/);
  assert.deepEqual(await horizontalOverflow(page), []);

  // Divisão do ouro: o aviso muda a cada mudança nos valores.
  await page.evaluate(() => setAlloc([80, 40, 22]));
  assert.match(await page.locator("#infraPrev").innerText(), /fora da Maravilha/);
  assert.match(await page.locator("#wonderHint").textContent(), /Nesta era as Obras não contam para a Maravilha/);
  await page.evaluate(() => setAlloc([30, 80, 32]));
  assert.doesNotMatch(await page.locator("#infraPrev").innerText(), /Maravilha/);
  assert.match(await page.locator("#wonderHint").textContent(), /contam para a Maravilha/);
  await page.evaluate(() => setAlloc([40, 40, 20]));   // empate não conta
  assert.match(await page.locator("#infraPrev").innerText(), /fora da Maravilha/);

  // Placar: bloco próprio com uma barra por império.
  const panel = await page.locator("#victoryPanel").innerText();
  assert.match(panel, /Maravilha da Humanidade: 12\.000 pontos de Obras \+ 16 regiões/);
  assert.equal(await page.locator("#victoryPanel [data-wd]").count(), 4);

  // Resumo da era: rival passou de 50% e o jogador passou de 50%.
  await page.evaluate(() => { const b = eraSnapshot(); state.civs[2].wonderInvested = 6500 / 0.2; showEraSummary(b); });
  await page.locator("#eraSummary").waitFor();
  assert.match(await page.locator("#eraSummary").innerText(), /Ocre está construindo uma Maravilha/);
  await dismissModals(page);
  await page.evaluate(() => { const b = eraSnapshot(); b.gd.wonder.player = 0.4; showEraSummary(b); });
  assert.match(await page.locator("#eraSummary").innerText(), /Você passou da metade da Maravilha da Humanidade[\s\S]*rivais vão reagir/);
  await dismissModals(page);

  // Meta alcançada: vitória pela Maravilha; o 3.º número mostra os pontos de Obras.
  await page.evaluate(() => { P(state).wonderInvested = 12500 / 0.2; });
  await grow(page, "player", 21);
  await concludeEraUI(page);
  await page.waitForFunction(() => !!state.result);
  assert.deepEqual(await page.evaluate(() => state.result.reasons.player), ["wonder"]);
  const res = await page.locator("#resultScreen").innerText();
  assert.match(res, /Vitória pela Maravilha da Humanidade!/);
  assert.match(res, /pontos de Obras/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("2×: vitória pela Grande Descoberta e pela Maravilha na mesma era; derrota quando um rival constrói a Maravilha", async () => {
  {
    const { context, page, errors } = await openGame(browser, { contextOptions: SMALL });
    await page.evaluate(() => { configApplied.map.aiCount = 1; configApplied.map.mapSize = 2; startNewGame(); document.getElementById("homeScreen").hidden = true; showView("game"); });
    // 360×640: a faixa e o mapa cabem (o mapa grande continua com pelo menos 150 px).
    assert.ok((await page.locator(".map-box").boundingBox()).height >= 149);
    await page.evaluate(() => { P(state).wonderInvested = 6500 / 0.2; P(state).invested.technology = 12500 / 0.2; });
    await grow(page, "player", 11);
    await concludeEraUI(page);
    await page.waitForFunction(() => !!state.result);
    assert.deepEqual((await page.evaluate(() => state.result.reasons.player)).slice().sort(), ["discovery", "wonder"]);
    assert.match(await page.locator("#resultScreen").innerText(), /Vitória pela Grande Descoberta e pela Maravilha!/);
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
    await page.evaluate(() => { configApplied.map.aiCount = 2; configApplied.map.mapSize = 2; startNewGame(); document.getElementById("homeScreen").hidden = true; showView("game"); });
    const ocre = await page.evaluate(() => { state.civs[2].wonderInvested = 6500 / 0.2; return state.civs[2].id; });
    await grow(page, ocre, 9);
    await concludeEraUI(page);
    await page.waitForFunction(() => !!state.result);
    const res = await page.locator("#resultScreen").innerText();
    assert.match(res, /Derrota: Ocre construiu a Maravilha da Humanidade/);
    assert.match(res, /venceu pela Maravilha da Humanidade/);
    assert.deepEqual(errors, []);
    await context.close();
  }
});
