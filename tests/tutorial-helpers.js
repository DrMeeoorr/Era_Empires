// Passos do tutorial jogados pela interface (partilhado pelos testes de fluxo e de bugs conhecidos).
"use strict";
const assert = require("node:assert/strict");
const { dismissModals, concludeEraUI, choosePlan } = require("./helpers");

/** Lê o passo atual do balão do tutorial ("Tutorial 3/10"). */
const tutStep = (page) =>
  page.evaluate(() => {
    const b = document.getElementById("tutBox");
    if (!b || b.hidden) return null;
    const m = b.innerText.match(/Tutorial (\d+)\/(\d+)/);
    return m ? { n: +m[1], of: +m[2], text: b.innerText } : { mini: true, text: b.innerText };
  });
const waitStep = (page, n) =>
  page.waitForFunction((n) => (document.getElementById("tutBox")?.innerText || "").includes(`Tutorial ${n}/`), n, { timeout: 5000 });

/**
 * Joga o tutorial pela interface, a partir do convite da primeira visita.
 * stopBefore: número do passo em que parar (o balão desse passo já está visível).
 * onStep(n): chamado quando o balão do passo n aparece (ex.: para medir ou capturar a tela).
 */
async function playTutorial(page, { stopBefore = Infinity, onStep = async () => {} } = {}) {
  const next = () => page.locator('#tutBox [data-tut="next"]').click();
  const invite = page.locator('#modalRoot button:has-text("Jogar o tutorial")');
  await invite.waitFor({ state: "visible", timeout: 3000 });
  await invite.click();
  await waitStep(page, 1);
  await onStep(1);
  assert.equal((await tutStep(page)).of, 10);
  assert.deepEqual(await page.evaluate(() => ({ d: currentDifficulty, ai: state.civs.length - 1, mode: state.mode })), { d: "facil", ai: 1, mode: "slow" });
  // 1 e 2: só texto.
  await next();
  await waitStep(page, 2);
  await onStep(2);
  await next();
  await waitStep(page, 3);
  await onStep(3);
  if (stopBefore <= 3) return;
  // 3: concluir antes de investir é bloqueado com aviso.
  await page.locator("#advance").click();
  await page.locator("#tutBox .tut-warn").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => state.era), 1, "o tutorial deixou concluir a era antes de investir");
  await choosePlan(page, "attack");
  await waitStep(page, 4);
  await onStep(4);
  // 4: concluir a era.
  await page.locator("#advance").click();
  await waitStep(page, 5);
  await onStep(5);
  assert.equal(await page.evaluate(() => state.era), 2);
  // 5: concluir sem dar a ordem é bloqueado; depois ordem ao território 9.
  await page.locator("#advance").click();
  await page.locator("#tutBox .tut-warn").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => state.era), 2);
  await page.locator('[data-territory="8"]').click();
  await page.locator("#attack").click();
  await waitStep(page, 6);
  await onStep(6);
  // 6: resolver as ordens → conquista garantida e relatório da era.
  await page.locator("#advance").click();
  await page.locator("#eraSummary").waitFor({ timeout: 3000 });
  await dismissModals(page);
  await waitStep(page, 7);
  await onStep(7);
  assert.equal(await page.evaluate(() => state.owners[8]), "player", "o território 9 não foi conquistado");
  if (stopBefore <= 7) return;
  // 7 → espera pela era 4 (balão reduzido), jogando livremente.
  await next();
  await page.waitForFunction(() => /volta na era 4/.test(document.getElementById("tutBox").innerText));
  while ((await page.evaluate(() => state.era)) < 4) {
    await choosePlan(page, "balanced");
    await concludeEraUI(page);
  }
  await waitStep(page, 8);
  await onStep(8);
  await next();
  await page.waitForFunction(() => /era 5/.test(document.getElementById("tutBox").innerText));
  while ((await page.evaluate(() => state.era)) < 5) {
    await choosePlan(page, "balanced");
    await concludeEraUI(page);
  }
  // 9: ataque roteirizado da IA, sempre repelido.
  await waitStep(page, 9);
  await onStep(9);
  const atk = await page.evaluate(() => ({ idx: state.tutorial.attackIdx, owner: state.owners[state.tutorial.attackIdx], text: document.getElementById("tutBox").innerText }));
  assert.equal(atk.owner, "player", "o ataque roteirizado do tutorial tomou um território do jogador");
  assert.match(atk.text, /foi repelid[oa]|Os rivais também atacam/);
  await next();
  await waitStep(page, 10);
  await onStep(10);
  if (stopBefore <= 10) return;
  await next();
}

module.exports = { tutStep, waitStep, playTutorial };
