// Salvamento robusto: save danificado não pode travar o jogo; falha ao salvar tem de ser visível.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, MOBILE_SCREENS, KEYS } = require("./helpers");

const PIXEL = MOBILE_SCREENS[0][1];
const CORRUPT = KEYS.save + "-corrompido";
let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

/** Grava `raw` como save, recarrega e devolve o que aconteceu. */
async function reloadWith(page, raw) {
  await page.evaluate(([k, c, v]) => { localStorage.removeItem(c); localStorage.setItem(k, v); }, [KEYS.save, CORRUPT, raw]);
  await page.reload();
  await page.waitForFunction(() => typeof state !== "undefined" && !!state);
  await page.locator('#modalRoot :text("Não foi possível continuar a partida salva")').waitFor({ timeout: 3000 });
  return page.evaluate(([k, c]) => ({ era: state.era, result: state.result, save: localStorage.getItem(k), copy: localStorage.getItem(c), map: document.querySelectorAll("[data-territory]").length }), [KEYS.save, CORRUPT]);
}

test("save com civs:[] não quebra o jogo: cópia em '-corrompido', partida nova e aviso", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const raw = await page.evaluate(() => { const o = { v: 1, savedAt: 1, gameMode: "slow", config: configApplied, state: newGame(), opponentChoices, difficulty: "medio" }; o.state.civs = []; return JSON.stringify(o); });
  const r = await reloadWith(page, raw);
  assert.equal(r.era, 1);
  assert.equal(r.result, null);
  assert.equal(r.copy, raw, "a cópia do save danificado não foi guardada");
  assert.equal(r.save, null, "o save danificado continua na chave principal");
  assert.ok(r.map >= 4, "o mapa da partida nova não foi desenhado");
  // Reabrir de novo já não mostra o aviso (o save danificado saiu do caminho).
  await page.reload();
  await page.waitForFunction(() => typeof state !== "undefined" && !!state);
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#modalRoot :text("Não foi possível continuar")').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("save com estrutura válida mas que falha ao desenhar também é posto de lado", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const raw = await page.evaluate(() => {
    const s = newGame(); state = s;
    for (let i = 0; i < 3; i++) playEra({ military: 1, infrastructure: 1, technology: 1 });
    s.timeline.push({ era: s.era, civs: [null] });
    if (validateSavedState(s) !== null) throw Error("o cenário de teste devia passar na validação");
    return JSON.stringify({ v: 1, savedAt: 1, gameMode: "slow", config: configApplied, state: s, opponentChoices, difficulty: "medio" });
  });
  const r = await reloadWith(page, raw);
  assert.equal(r.era, 1);
  assert.equal(r.copy, raw);
  assert.ok(r.map >= 4);
  assert.deepEqual(errors, []);
  await context.close();
});

test("validateSavedState recusa estruturas perigosas e aceita uma partida normal", async () => {
  const { context, page } = await openGame(browser);
  const r = await page.evaluate(() => {
    const ok = () => { const s = newGame(); state = s; playEra({ military: 5, infrastructure: 5, technology: 5 }); return JSON.parse(JSON.stringify(s)); };
    const bad = {
      eraTexto: (s) => (s.era = "<img>"), maxEras: (s) => (s.maxEras = null), dono: (s) => (s.owners[0] = "fantasma"),
      ordem: (s) => (s.orders = [{ owner: "player", idx: "<b>" }]), nome: (s) => (s.civs[1].name = 5), tesouro: (s) => (s.civs[0].treasury = "1"),
      versao: (s) => (s.formatVersion = 99), registo: (s) => s.log.push({ era: 1, text: {} }), semJogador: (s) => s.civs.reverse(),
    };
    const out = { normal: validateSavedState(ok()) };
    for (const [k, f] of Object.entries(bad)) { const s = ok(); f(s); out[k] = validateSavedState(s); }
    return out;
  });
  await context.close();
  assert.equal(r.normal, null, "partida normal recusada: " + r.normal);
  for (const [k, v] of Object.entries(r)) if (k !== "normal") assert.ok(typeof v === "string" && v, `${k}: devia ser recusado`);
});

test("quando o navegador recusa gravar, o jogador vê um aviso; o aviso some quando volta a gravar", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.locator("#homeStart").click();
  await page.locator("#setupStart").click();
  const r = await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException("cheio", "QuotaExceededError"); };
    let failed;
    try { failed = saveGame(); } finally { Storage.prototype.setItem = orig; }
    const el = document.getElementById("saveWarning");
    const shown = { ret: failed, visible: !!el && !el.hidden && el.getBoundingClientRect().height > 0, text: el?.innerText || "" };
    const okRet = saveGame();
    return { ...shown, okRet, hiddenAfter: el.hidden };
  });
  assert.equal(r.ret, false);
  assert.ok(r.visible, "aviso de falha ao salvar não está visível");
  assert.match(r.text, /Não foi possível salvar/);
  assert.match(r.text, /cheio/);
  assert.equal(r.okRet, true);
  assert.equal(r.hiddenAfter, true, "o aviso devia desaparecer depois de salvar com sucesso");
  assert.deepEqual(errors, []);
  await context.close();
});
