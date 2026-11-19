// Fluxos completos pela interface: partida curta, salvar/recarregar e tutorial.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, concludeEraUI, horizontalOverflow, screenshot, MOBILE_SCREENS, KEYS, choosePlan } = require("./helpers");
const { playTutorial, waitStep } = require("./tutorial-helpers");

const PIXEL = MOBILE_SCREENS[0][1];
let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

/** Nova partida → 15 eras (curta) → Começar. */
async function startShortGame(page, { eras = 15 } = {}) {
  await page.locator("#homeStart").click();
  await page.locator(`#homeEraPresets [data-eras="${eras}"]`).click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1 && !!state.pending);
}

/** Tenta dar uma ordem de ataque a um território vizinho, se houver poder suficiente. */
async function tryOrderAttack(page) {
  const idx = await page.evaluate(() => {
    const m = configApplied.military, mil = P(state).military;
    const t = eligibleTargets(state, "player").find((t) => mil + 1e-9 >= m.conquestCost + territoryDefense(state, t.i, configApplied));
    return t ? t.i : null;
  });
  if (idx === null) return false;
  await page.locator(`[data-territory="${idx}"]`).click();
  const btn = page.locator("#attack");
  // UX Fase 2: o território abre a folha de ataque; se não der para atacar, fecha a folha (Esc) e segue.
  if (await btn.isDisabled()) { await page.keyboard.press("Escape"); return false; }
  await btn.click();
  return true;
}

test("partida curta completa: Nova partida → Começar → investir → concluir até à tela de resultado", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startShortGame(page);
  assert.equal(await page.evaluate(() => state.maxEras), 15);
  let orders = 0, guard = 0;
  while (!(await page.evaluate(() => !!state.result))) {
    assert.ok(guard++ < 20, "a partida não terminou dentro do limite de eras");
    // Investe pelo plano e confirma que a interface mostra o orçamento todo distribuído.
    await page.locator('[data-plan="balanced"]').click();
    const left = await page.evaluate(() => P(state).treasury - readAlloc().reduce((a, b) => a + b, 0));
    assert.ok(Math.abs(left) < 0.01, `plano Equilibrado deixou ${left} por investir`);
    if (await tryOrderAttack(page)) orders++;
    const before = await page.evaluate(() => ({ era: state.era, inv: state.investments.filter((i) => i.owner === "player").length }));
    await concludeEraUI(page);
    const afterEra = await page.evaluate(() => ({ era: state.era, inv: state.investments.filter((i) => i.owner === "player").length, ended: !!state.result }));
    if (!afterEra.ended) assert.equal(afterEra.era, before.era + 1);
    assert.ok(afterEra.inv > before.inv, "os investimentos da era não foram registados");
  }
  const r = await page.evaluate(() => ({ r: state.result, era: state.era, max: state.maxEras }));
  assert.ok(r.r.era <= r.max, "a partida passou do limite de eras");
  assert.ok(["victory", "draw"].includes(r.r.type));
  // Tela de resultado.
  const banner = page.locator("#resultBanner");
  await banner.waitFor({ state: "visible" });
  const txt = await banner.innerText();
  assert.match(txt, /Vitória!|Empate|Derrota/);
  assert.match(txt, /Era \d+/);
  await page.locator("#newGameAfterEnd").waitFor({ state: "visible" });
  assert.ok(await page.locator("#actionEnded").isVisible(), "barra inferior não indica partida encerrada");
  assert.deepEqual(await horizontalOverflow(page), []);
  await screenshot(page, "resultado-pixel7");
  console.log(`  partida curta: ${r.r.type} na era ${r.r.era}, ${orders} ordens de ataque dadas`);
  // "Jogar de novo" começa outra partida na era 1.
  await page.locator("#newGameAfterEnd").click();
  await page.waitForFunction(() => !state.result && state.era === 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test("salvar e recarregar: o progresso continua depois de recarregar a página", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.locator("#homeStart").click();
  await page.locator('#homeOpponents [data-ai="2"]').click();
  await page.locator("#setupStart").click();
  await page.evaluate(() => (state.ui.skipReport = true));
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-plan="attack"]').click();
    await concludeEraUI(page);
  }
  // Deixa uma ordem de ataque pendente (poder reservado) antes de recarregar.
  const ordered = await tryOrderAttack(page);
  const saved = await page.evaluate(() => JSON.stringify(state));
  const before = JSON.parse(saved);
  assert.equal(before.era, 4);
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  // Tela inicial oferece "Continuar partida (era 4 de 30)".
  const cont = page.locator("#homeContinue");
  await cont.waitFor({ state: "visible" });
  assert.match(await cont.innerText(), /era 4 de 30/);
  const after = await page.evaluate(() => JSON.parse(JSON.stringify(state)));
  assert.deepEqual(after, before, "o estado recarregado difere do estado guardado");
  assert.equal(await page.evaluate(() => configApplied.map.aiCount), 2);
  if (ordered) assert.equal(after.orders.length >= 1, true, "ordem pendente perdida ao recarregar");
  await cont.click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden);
  assert.match(await page.locator("#metrics").innerText(), /4\s*\/\s*30/);
  // A partida continua jogável depois de recarregar.
  await page.locator('[data-plan="balanced"]').click();
  await concludeEraUI(page);
  assert.equal(await page.evaluate(() => state.era), 5);
  assert.deepEqual(errors, []);
  await context.close();
});

test("salvar e recarregar: depois de uma partida terminada, reabrir o jogo mantém as escolhas do jogador", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.locator("#homeStart").click();
  await page.locator("#modeFast").click();
  await page.locator('#homeOpponents [data-ai="3"]').click();
  await page.locator('[data-prof="1"]').selectOption("military");
  await page.locator('#homeEraPresets [data-eras="15"]').click();
  await page.locator("#homeConquest").click();
  await page.locator('#homeDifficulty [data-diff="dificil"]').click();
  await page.locator("#setupStart").click();
  const read = () => page.evaluate(() => ({
    ai: configApplied.map.aiCount, eras: configApplied.endgame.maxEras, supremacy: configApplied.endgame.supremacyEnabled,
    difficulty: currentDifficulty, mode: gameMode, style: opponentChoices[1],
  }));
  const chosen = await read();
  assert.deepEqual(chosen, { ai: 3, eras: 15, supremacy: false, difficulty: "dificil", mode: "fast", style: "military" });
  await page.evaluate(() => { while (!state.result) playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  assert.equal(await page.evaluate(() => !!state.result), false, "partida terminada foi retomada");
  assert.deepEqual(await read(), chosen);
  assert.equal(await page.evaluate(() => state.civs.length), 4, "a partida nova já usa as 3 IAs escolhidas");
  assert.deepEqual(errors, []);
  await context.close();
});

test("salvar e recarregar: partida do tutorial terminada volta às escolhas de antes do tutorial", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.locator("#homeStart").click();
  await page.locator('#homeOpponents [data-ai="2"]').click();
  await page.locator('#homeEraPresets [data-eras="15"]').click();
  await page.locator('#homeDifficulty [data-diff="dificil"]').click();
  await page.locator("#setupStart").click();
  await page.evaluate(() => { startTutorial(); while (!state.result) playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  const r = await page.evaluate(() => ({ ai: configApplied.map.aiCount, eras: configApplied.endgame.maxEras, difficulty: currentDifficulty, result: !!state.result, tutorial: !!state.tutorial }));
  assert.deepEqual(r, { ai: 2, eras: 15, difficulty: "dificil", result: false, tutorial: false });
  assert.deepEqual(errors, []);
  await context.close();
});

test("salvar e recarregar: partida terminada não é retomada e save corrompido não quebra o jogo", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  // Partida terminada: força o fim rápido por simulação e grava.
  await page.evaluate(() => {
    while (!state.result) playEra({ military: 0, infrastructure: 0, technology: 0 });
    saveGame();
  });
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  assert.equal(await page.evaluate(() => !!state.result), false, "partida terminada foi retomada");
  assert.equal(await page.locator("#homeContinue").isVisible(), false);
  // Save corrompido / formato desconhecido.
  for (const raw of ["{lixo", JSON.stringify({ v: 99, state: {} }), JSON.stringify({ v: 1, state: { civs: "x" } })]) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEYS.save, raw]);
    await page.reload();
    await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
    assert.deepEqual(await page.evaluate(() => ({ era: state.era, result: state.result })), { era: 1, result: null }, "save inválido: " + raw);
  }
  assert.deepEqual(errors, []);
  await context.close();
});

for (const [name, opts] of [MOBILE_SCREENS[0], MOBILE_SCREENS[2]]) {
  test(`tutorial do início ao fim (${name})`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: opts, offerTutorial: true });
    await playTutorial(page, { stopBefore: 10 });
    await screenshot(page, `tutorial-final-${name}`);
    await page.locator('#tutBox [data-tut="next"]').click();
    // Fim: balão fechado, proteções do tutorial desligadas, partida continua.
    await page.waitForFunction(() => document.getElementById("tutBox").hidden);
    const end = await page.evaluate(() => ({ done: state.tutorial.done, avoid: state.aiAvoid, forced: state.forcedAttack, skipIdle: state.ui.skipIdleWarning, result: state.result }));
    assert.deepEqual(end, { done: true, avoid: null, forced: null, skipIdle: false, result: null });
    await choosePlan(page, "balanced");
    await concludeEraUI(page);
    assert.equal(await page.evaluate(() => state.era), 6);
    assert.deepEqual(await horizontalOverflow(page), []);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("tutorial: 'Pular tutorial' termina o tutorial e a partida continua", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL, offerTutorial: true });
  await page.locator('#modalRoot button:has-text("Jogar o tutorial")').click();
  await waitStep(page, 1);
  await page.locator('#tutBox [data-tut="skip"]').click();
  await page.locator('#modalRoot :text("Tutorial terminado")').waitFor();
  await dismissModals(page);
  assert.equal(await page.evaluate(() => state.tutorial.done && state.aiAvoid === null), true);
  assert.equal(await page.locator("#tutBox").isVisible(), false);
  // Recarregar não volta a oferecer o tutorial.
  await page.reload();
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#modalRoot :text("Primeira vez")').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("tutorial: recarregar a página a meio retoma o tutorial no mesmo passo", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL, offerTutorial: true });
  await playTutorial(page, { stopBefore: 7 });
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  const cont = page.locator("#homeContinue");
  await cont.waitFor({ state: "visible" });
  assert.match(await cont.innerText(), /era 3/);
  await cont.click();
  await waitStep(page, 7);
  assert.equal(await page.evaluate(() => state.owners[8]), "player");
  assert.deepEqual(errors, []);
  await context.close();
});
