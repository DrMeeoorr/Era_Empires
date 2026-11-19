// Dificuldade e tutorial não podem "vazar" valores para outras partidas nem para "Configurações".
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, MOBILE_SCREENS, dismissModals, menuClick } = require("./helpers");
const { waitStep } = require("./tutorial-helpers");

const PIXEL = MOBILE_SCREENS[0][1];
let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

const aiVals = (page) => page.evaluate(() => [configApplied.economy.aiIncomeMultiplier, configApplied.economy.aiIncomeMultiplier1v1, configApplied.military.aiAggression, configApplied.military.aiTarget]);
const DEFAULT_AI = [1, -1, 75, "neutralFirst"];

/** Pela tela de configuração: escolhe dificuldade/IAs/eras/modo e começa. */
async function startVia(page, { diff, ai, eras, fast = false }) {
  if (await page.locator("#homeScreen").isHidden()) await menuClick(page, "#returnHome");
  await page.locator("#homeStart").click();
  if (diff) await page.locator(`#homeDifficulty [data-diff="${diff}"]`).click();
  if (ai) await page.locator(`#homeOpponents [data-ai="${ai}"]`).click();
  if (eras) await page.locator(`#homeEraPresets [data-eras="${eras}"]`).click();
  await page.locator(fast ? "#modeFast" : "#modeSlow").click();
  await page.locator("#setupStart").click();
  const confirm = page.locator('#modalRoot button:has-text("Nova partida")');
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
}

test("applyDifficulty('config') volta aos valores das Configurações depois de outra dificuldade", async () => {
  const { context, page } = await openGame(browser);
  const r = await page.evaluate(() => {
    const out = {};
    for (const k of ["dificil", "hardcore", "muitofacil", "medio"]) { applyDifficulty(k); applyDifficulty("config"); out[k] = [configApplied.economy.aiIncomeMultiplier, configApplied.economy.aiIncomeMultiplier1v1, configApplied.military.aiAggression, configApplied.military.aiTarget]; }
    // Entre duas dificuldades também não sobra nada: Médio define aiIncomeMultiplier1v1, Difícil tem de o repor.
    applyDifficulty("medio"); applyDifficulty("dificil"); out.medioDificil = configApplied.economy.aiIncomeMultiplier1v1;
    return out;
  });
  await context.close();
  for (const k of ["dificil", "hardcore", "muitofacil", "medio"]) assert.deepEqual(r[k], DEFAULT_AI, k + " vazou para Configurações");
  assert.equal(r.medioDificil, -1);
});

// "⚙ Configurações" só aparece com ?dev=1 (na versão do jogador a opção fica escondida).
test("pela interface (?dev=1): Difícil → Configurações não herda agressividade/alvo do Difícil (também depois de recarregar)", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL, dev: true });
  await startVia(page, { diff: "dificil", ai: 2 });
  assert.deepEqual(await aiVals(page), [1, -1, 100, "cheapest"]);
  await page.reload();
  await page.waitForFunction(() => typeof state !== "undefined" && !!state);
  await startVia(page, { diff: "config", ai: 2 });
  assert.deepEqual(await aiVals(page), DEFAULT_AI);
  assert.equal(await page.evaluate(() => currentDifficulty), "config");
  assert.deepEqual(errors, []);
  await context.close();
});

test("valores aplicados nos laboratórios com 'Configurações' sobrevivem a uma partida no Hardcore", async () => {
  const { context, page, errors } = await openGame(browser, { dev: true });
  await page.locator("#homeLab").click();
  await page.locator('[data-param="military.aiAggression"]').fill("40");
  await page.locator('[data-param="military.aiAggression"]').dispatchEvent("change");
  await page.locator("#applyConfig").click();
  assert.equal((await aiVals(page))[2], 40);
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = false; });
  await startVia(page, { diff: "hardcore" });
  assert.deepEqual(await aiVals(page), [1.03, -1, 100, "cheapest"]);
  await startVia(page, { diff: "config" });
  assert.deepEqual(await aiVals(page), [1, -1, 40, "neutralFirst"]);
  assert.deepEqual(errors, []);
  await context.close();
});

test("tutorial não grava Fácil/1 IA/30 eras/modo lento nas escolhas do jogador", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startVia(page, { diff: "medio", ai: 3, eras: 15, fast: true });
  const prevOpp = await page.evaluate(() => opponentChoices.slice());
  // Começa o tutorial a partir da tela inicial.
  await menuClick(page, "#returnHome");
  await page.locator("#homeTutorial").click();
  const ok = page.locator('#modalRoot button:has-text("Começar tutorial")');
  if (await ok.count()) await ok.click();
  await waitStep(page, 1);
  assert.deepEqual(await page.evaluate(() => ({ d: currentDifficulty, ai: configApplied.map.aiCount, eras: configApplied.endgame.maxEras, mode: gameMode })), { d: "facil", ai: 1, eras: 30, mode: "slow" });
  assert.deepEqual(await page.evaluate(() => opponentChoices.slice()), prevOpp, "o tutorial alterou os estilos de rival escolhidos");
  // "Pular tutorial": a partida guiada continua (Fácil); recarregar mantém as escolhas anteriores guardadas.
  await page.locator('#tutBox [data-tut="skip"]').click();
  await dismissModals(page);
  await page.reload();
  await page.waitForFunction(() => typeof state !== "undefined" && !!state);
  // A tela de configuração mostra as escolhas de antes do tutorial.
  await page.locator("#homeStart").click();
  const shown = await page.evaluate(() => ({
    ai: document.querySelector("#homeOpponents [data-ai].selected")?.dataset.ai,
    eras: document.getElementById("homeMaxEras").value,
    diff: document.querySelector("#homeDifficulty [data-diff].selected")?.dataset.diff,
    fast: document.getElementById("modeFast").classList.contains("selected"),
  }));
  assert.deepEqual(shown, { ai: "3", eras: "15", diff: "medio", fast: true });
  await page.locator("#setupBack").click();
  // "Jogar de novo" no fim da partida do tutorial: a nova partida usa as escolhas de antes do tutorial.
  assert.deepEqual(await page.evaluate(() => ({ d: currentDifficulty, ai: configApplied.map.aiCount })), { d: "facil", ai: 1 }, "a partida do tutorial devia continuar no Fácil");
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = true; });
  await page.evaluate(() => { while (!state.result) playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
  await page.waitForTimeout(150);
  await dismissModals(page);
  await page.locator("#newGameAfterEnd").click();
  await page.waitForFunction(() => !state.result && state.era === 1);
  assert.deepEqual(await page.evaluate(() => ({ d: currentDifficulty, ai: configApplied.map.aiCount, eras: configApplied.endgame.maxEras, mode: gameMode, civs: state.civs.length })), { d: "medio", ai: 3, eras: 15, mode: "fast", civs: 4 });
  assert.deepEqual(await aiVals(page), [1.03, 1, 75, "neutralFirst"]);
  assert.deepEqual(errors, []);
  await context.close();
});
