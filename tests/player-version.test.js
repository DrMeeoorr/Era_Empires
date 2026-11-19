// Versão do jogador (padrão, a publicada) e versão de desenvolvimento (?dev=1).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, assertClickable, concludeEraUI, horizontalOverflow, screenshot, MOBILE_SCREENS, menuClick } = require("./helpers");

const PIXEL = MOBILE_SCREENS[0][1];
const DEV_ONLY = [
  ["#homeCompare", "botão Balanceamento (tela inicial)"],
  ["#homeLab", "botão Configurações (tela inicial)"],
  [".eyebrow", "cabeçalho 'Versão completa · laboratórios'"],
  [".footer", "rodapé técnico (laboratórios, exportações)"],
  ["#exportHistory", "botão Exportar"],
  ['.tab[data-view="lab"]', "aba Configurações"],
  ['.tab[data-view="tests"]', "aba Testes funcionais"],
  ['.tab[data-view="balanceLab"]', "aba Balanceamento"],
  ['.tab[data-view="aiLab"]', "aba Validação das IAs"],
];
const LAB_VIEWS = ["lab", "tests", "balanceLab", "aiLab"];

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

test("versão do jogador (sem ?dev=1): nada de laboratórios, Exportar nem 'Versão completa'", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  assert.equal(await page.evaluate(() => DEV_MODE), false);
  await page.waitForTimeout(400);
  await screenshot(page, "jogador-inicial-pixel7");
  for (const sel of ["#homeCompare", "#homeLab"]) assert.equal(await page.locator(sel).isVisible(), false, sel);
  // Os botões do jogador continuam lá.
  for (const sel of ["#homeStart", "#homeTutorial", "#homeHowTo"]) await assertClickable(page, sel);
  await page.locator("#homeStart").click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  for (const [sel, label] of DEV_ONLY) {
    const n = await page.locator(sel).count();
    for (let i = 0; i < n; i++) assert.equal(await page.locator(sel).nth(i).isVisible(), false, `${label} visível na versão do jogador`);
  }
  assert.equal(await page.locator(".tabs").isVisible(), false, "barra de abas visível");
  for (const v of LAB_VIEWS) assert.equal(await page.locator("#" + v).isVisible(), false, `vista ${v} visível`);
  assert.equal(await page.getByText("Versão completa", { exact: false }).first().isVisible(), false);
  assert.equal(await page.getByText("laboratório", { exact: false }).filter({ visible: true }).count(), 0, "texto 'laboratório' visível");
  // O jogo funciona normalmente com tudo isso escondido.
  await page.evaluate(() => (state.ui.skipReport = true));
  for (let i = 0; i < 2; i++) { await page.locator('[data-plan="balanced"]').click(); await concludeEraUI(page); }
  assert.equal(await page.evaluate(() => state.era), 3);
  assert.deepEqual(await horizontalOverflow(page), []);
  await screenshot(page, "jogador-jogo-pixel7");
  assert.deepEqual(errors, []);
  await context.close();
});

test("versão de desenvolvimento (?dev=1): laboratórios, Exportar e 'Versão completa' aparecem como antes", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL, dev: true });
  assert.equal(await page.evaluate(() => DEV_MODE), true);
  await page.waitForTimeout(400);
  for (const sel of ["#homeCompare", "#homeLab"]) await assertClickable(page, sel);
  await page.locator("#homeLab").click();
  assert.ok(await page.locator("#lab").isVisible(), "a aba Configurações não abriu");
  for (const [sel, label] of DEV_ONLY.filter(([s]) => !s.startsWith("#home"))) assert.ok(await page.locator(sel).first().isVisible(), `${label} escondido em ?dev=1`);
  for (const v of LAB_VIEWS) {
    await page.locator(`.tab[data-view="${v}"]`).click();
    assert.ok(await page.locator("#" + v).isVisible(), `vista ${v} não abriu`);
  }
  await page.locator('.tab[data-view="game"]').click();
  // ?dev=1 continua depois de recarregar (o endereço mantém-se).
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  assert.equal(await page.evaluate(() => DEV_MODE), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test("versão do jogador: dificuldade padrão Médio, sem '⚙ Configurações' nem estilo 'Definido nas Configurações'", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  assert.equal(await page.evaluate(() => currentDifficulty), "medio");
  await page.locator("#homeStart").click();
  await page.locator("#setupScreen").waitFor({ state: "visible" });
  assert.equal(await page.locator('#homeDifficulty [data-diff].selected').getAttribute("data-diff"), "medio");
  assert.equal(await page.locator('#homeDifficulty [data-diff="config"]').isVisible(), false, "chip Configurações visível");
  assert.equal(await page.locator('#homeProfiles option[value="config"]').count(), 0, "estilo 'Definido nas Configurações' disponível");
  assert.equal(await page.locator('#homeProfiles select').first().inputValue(), "adaptive");
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  assert.deepEqual(await page.evaluate(() => [currentDifficulty, state.difficulty]), ["medio", "medio"]);
  assert.deepEqual(errors, []);
  await context.close();
});

test("versão do jogador: save antigo com dificuldade 'config' e rivais 'config' abre e continua sem erro", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.evaluate(() => {
    configApplied = clone(DEFAULTS); configApplied.map.aiCount = 2; currentDifficulty = "config";
    const s = newGame(); s.difficulty = "config";
    localStorage.setItem("imperios-completo-partida", JSON.stringify({ v: 1, savedAt: 1, gameMode: "slow", config: configApplied, state: s, opponentChoices: ["config", "config", "config"], difficulty: "config", aiBase: pickAiDifficulty(DEFAULTS) }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  assert.equal(await page.evaluate(() => currentDifficulty), "config", "a partida salva perdeu a dificuldade");
  await page.locator("#homeContinue").click().catch(() => {});
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = true; renderAll(); });
  await page.locator('[data-plan="balanced"]').click();
  await concludeEraUI(page);
  assert.equal(await page.evaluate(() => state.era), 2);
  // A próxima partida nova (pela tela de configuração) usa Médio e estilos visíveis.
  await menuClick(page, "#returnHome");
  await page.locator("#homeStart").click();
  assert.equal(await page.locator('#homeDifficulty [data-diff].selected').getAttribute("data-diff"), "medio");
  assert.equal(await page.locator('#homeProfiles select').first().inputValue(), "adaptive");
  assert.deepEqual(errors, []);
  await context.close();
});
