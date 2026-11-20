// Versão do jogador (padrão, a publicada) e versão de desenvolvimento (?dev=1).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, assertClickable, concludeEraUI, horizontalOverflow, screenshot, MOBILE_SCREENS, menuClick, KEYS, GAME_URL, DEV_URL } = require("./helpers");

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
  await page.evaluate((key) => {
    configApplied = clone(DEFAULTS); configApplied.map.aiCount = 2; currentDifficulty = "config";
    const s = newGame(); s.difficulty = "config";
    localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: 1, gameMode: "slow", config: configApplied, state: s, opponentChoices: ["config", "config", "config"], difficulty: "config", aiBase: pickAiDifficulty(DEFAULTS) }));
  }, KEYS.save);
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

// ── Duas páginas: index.html (jogador) e dev.html (desenvolvimento) ──

test("versão do jogador não baixa os laboratórios: nada de src/labs/, labs.css nem do HTML das abas", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const urls = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name));
  const own = urls.filter((u) => /\/(src|styles)\//.test(u)).map((u) => new URL(u).pathname);
  assert.ok(own.some((u) => u.endsWith("/src/main-player.js")), "main-player.js não foi carregado: " + own.join(", "));
  assert.deepEqual(own.filter((u) => /\/src\/labs\/|labs\.css|main-dev|debug-dev/.test(u)), [], "o jogador baixou código dos laboratórios");
  assert.equal(await page.evaluate(() => typeof runTests), "undefined", "runTests existe na versão do jogador");
  for (const sel of [".tabs", "#lab", "#tests", "#balanceLab", "#aiLab", ".footer", "#exportHistory", "#homeCompare", "#homeLab", ".eyebrow", '[data-diff="config"]'])
    assert.equal(await page.locator(sel).count(), 0, `${sel} existe no HTML do jogador`);
  assert.deepEqual(errors, []);
  await context.close();
});

test("index.html?dev=1 (links antigos) abre dev.html, a versão de desenvolvimento", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.goto(GAME_URL + (GAME_URL.includes("?") ? "&" : "?") + "dev=1#x");
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  const u = new URL(page.url());
  assert.ok(u.pathname.endsWith("/dev.html"), "não foi para dev.html: " + page.url());
  assert.equal(u.search, "", "o ?dev=1 devia sair do endereço");
  assert.equal(u.hash, "#x");
  assert.equal(await page.evaluate(() => DEV_MODE), true);
  assert.equal(await page.evaluate(() => typeof runTests), "function");
  assert.deepEqual(errors, []);
  await context.close();
});

test("saves: a partida da chave antiga passa para a do jogador; jogador e dev guardam em chaves separadas", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  // Partida antiga (antes da separação) na era 4, guardada na chave antiga.
  const old = await page.evaluate(() => {
    configApplied = clone(DEFAULTS); configApplied.map.aiCount = 2;
    const s = newGame(); for (let i = 0; i < 3; i++) { finishEra(s, configApplied, { playerAllocation: { military: 5, infrastructure: 5, technology: 5 } }); beginEra(s, configApplied); }
    return JSON.stringify({ v: 1, savedAt: 1, gameMode: "slow", config: configApplied, state: s, opponentChoices: ["adaptive", "adaptive"], difficulty: "medio" });
  });
  await page.evaluate(([k, l, v]) => { localStorage.removeItem(k); localStorage.setItem(l, v); }, [KEYS.save, KEYS.legacySave, old]);
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  assert.equal(await page.evaluate(() => state.era), 4, "a partida antiga não foi retomada");
  const keys = await page.evaluate((k) => ({ player: localStorage.getItem(k.save), legacy: localStorage.getItem(k.legacySave), dev: localStorage.getItem(k.saveDev) }), KEYS);
  assert.equal(keys.player, old, "a partida não foi copiada para a chave do jogador");
  assert.equal(keys.legacy, null, "a chave antiga devia sair depois de copiada");
  assert.equal(keys.dev, null);
  assert.match(await page.locator("#homeContinue").innerText(), /^Continuar · Era 4\b/);
  // A versão de desenvolvimento (mesma origem) começa a sua própria partida e não mexe na do jogador.
  await page.goto(DEV_URL);
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  assert.equal(await page.evaluate(() => state.era), 1, "dev.html abriu a partida do jogador");
  await page.evaluate(async () => { for (let i = 0; i < 2; i++) playEra({ military: 1, infrastructure: 1, technology: 1 }); await saveGame(); });
  const after = await page.evaluate((k) => ({ player: localStorage.getItem(k.save), dev: localStorage.getItem(k.saveDev) }), KEYS);
  assert.equal(after.player, old, "dev.html alterou a partida do jogador");
  assert.equal(JSON.parse(after.dev).state.era, 3);
  // Se já há partida na chave nova, a antiga não a substitui.
  await page.goto(GAME_URL);
  await page.evaluate(([l]) => localStorage.setItem(l, "{lixo"), [KEYS.legacySave]);
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
  assert.equal(await page.evaluate(() => state.era), 4);
  assert.deepEqual(errors, []);
  await context.close();
});
