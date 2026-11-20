// Passos do tutorial jogados pela interface (partilhado pelos testes de fluxo, de nomes, de pt-BR e de bugs conhecidos).
// Tutorial da Fase 3: 5 passos de ação (investir → concluir → atacar → ver o resumo → como vencer).
"use strict";
const assert = require("node:assert/strict");
const { choosePlan } = require("./helpers");

/** Lê o passo atual do balão do tutorial ("Passo 3 de 5"). */
const tutStep = (page) =>
  page.evaluate(() => {
    const b = document.getElementById("tutBox");
    if (!b || b.hidden) return null;
    const m = b.innerText.match(/Passo (\d+) de (\d+)/);
    return m ? { n: +m[1], of: +m[2], text: b.innerText } : { text: b.innerText };
  });
const waitStep = (page, n) =>
  page.waitForFunction((n) => { const b = document.getElementById("tutBox"); return !!b && !b.hidden && b.innerText.includes(`Passo ${n} de`); }, n, { timeout: 5000 });
/** Espera o balão apontar para o elemento `sel` (o balão acompanha folhas e o resumo da era). */
const waitTarget = (page, sel) =>
  page.waitForFunction((sel) => { const f = document.querySelector(".tut-focus"), b = document.getElementById("tutBox"); return !!f && !b.hidden && f.matches(sel); }, sel, { timeout: 5000 });

/**
 * Joga o tutorial pela interface, a partir do convite da primeira visita.
 * stopBefore: número do passo em que parar (o balão desse passo já está visível).
 * onStep(n): chamado quando o balão aparece; n é o passo (1–5) ou "3b" (Atacar, na folha) e "4b" (resumo da era).
 */
async function playTutorial(page, { stopBefore = Infinity, onStep = async () => {} } = {}) {
  const invite = page.locator('#modalRoot button:has-text("Jogar o tutorial")');
  await invite.waitFor({ state: "visible", timeout: 3000 });
  await invite.click();
  await waitStep(page, 1);
  await onStep(1);
  assert.equal((await tutStep(page)).of, 5);
  assert.deepEqual(await page.evaluate(() => ({ d: currentDifficulty, ai: state.civs.length - 1, mode: state.mode, profile: A(state).profile, p: state.owners[7], ai9: state.owners[9] === A(state).id })), { d: "facil", ai: 1, mode: "slow", profile: "reference", p: "player", ai9: true });
  if (stopBefore <= 1) return;
  // 1: concluir antes de investir é bloqueado com aviso (a dica vira o aviso).
  await page.locator("#advance").click();
  await page.locator("#tutBox .tut-warn").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => state.era), 1, "o tutorial deixou concluir a era antes de investir");
  await choosePlan(page, "attack");
  await waitStep(page, 2);
  await waitTarget(page, "#advance");
  await onStep(2);
  if (stopBefore <= 2) return;
  // 2: concluir a era.
  await page.locator("#advance").click();
  await waitStep(page, 3);
  await waitTarget(page, '[data-territory="8"]');
  await onStep(3);
  assert.equal(await page.evaluate(() => state.era), 2);
  if (stopBefore <= 3) return;
  // 3: concluir sem dar a ordem é bloqueado; depois ordem a Ivara (9), com a dica a seguir para o botão Atacar.
  await page.locator("#advance").click();
  await page.locator("#tutBox .tut-warn").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => state.era), 2);
  await page.locator('[data-territory="8"]').click();
  await waitTarget(page, "#attack");
  await onStep("3b");
  await page.locator("#attack").click();
  await waitStep(page, 4);
  await waitTarget(page, "#advance");
  await onStep(4);
  if (stopBefore <= 4) return;
  // 4: resolver a ordem → conquista garantida e resumo da era, com a dica no botão "Era 3 →".
  await page.locator("#advance").click();
  await page.locator("#eraSummary").waitFor({ timeout: 3000 });
  await waitTarget(page, "#eraSummary .sum-next");
  await onStep("4b");
  assert.match(await page.locator("#eraSummary").innerText(), /Ivara conquistada/);
  await page.locator("#eraSummary .sum-next").click();
  await waitStep(page, 5);
  await waitTarget(page, "#scorePill");
  await onStep(5);
  assert.equal(await page.evaluate(() => state.owners[8]), "player", "Ivara (9) não foi conquistada");
  if (stopBefore <= 5) return;
  await page.locator('#tutBox [data-tut="next"]').click();
}

module.exports = { tutStep, waitStep, waitTarget, playTutorial };
