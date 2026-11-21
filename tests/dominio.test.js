// Domínio com escolha e duração "Sem limite" (21/11/2026, aprovado pelo usuário).
// - Quando o JOGADOR chega a 70% antes da última era: "Vencer agora" (o fim de antes) ou "Continuar até a era N"
//   (vence por domínio no limite se mantiver 70%; senão, pontos). A pergunta só volta depois de cair abaixo de 70%.
// - Rival a 70%, partidas só de IAs e laboratórios: encerram na hora, como antes (impressões digitais iguais:
//   tests/fingerprint*.test.js).
// - "Sem limite" no lugar de "50 · longa": termina por domínio (vence na hora), eliminação ou supremacia (a partir da
//   era 15); teto de segurança de 100 eras decidido por pontos.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launch, openGame, openCustomize, horizontalOverflow, devices, KEYS } = require("./helpers");

const ROOT = path.resolve(__dirname, "..");
const load = (rel) => import(pathToFileURL(path.join(ROOT, "src", rel)).href);
const ZERO = { military: 0, infrastructure: 0, technology: 0 };

// Armazenamento falso para o Node (o jogo só fala com ele por src/platform/storage.js).
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

let S, C, SV, M;
before(async () => {
  [S, C, SV, M] = await Promise.all([load("app/session.js"), load("core/index.js"), load("app/save.js"), load("app/medals.js")]);
});

// Partida nova do jogador (como "Jogar"): eras, Conquista (sem supremacia) e Sem limite à escolha.
function game({ eras = 30, conquest = false, unlimited = false } = {}) {
  const c = C.clone(C.DEFAULTS); c.endgame.maxEras = unlimited ? C.UNLIMITED.maxEras : eras; c.endgame.supremacyEnabled = !conquest;
  S.setConfigApplied(C.normalizeConfig(c)); S.setCurrentDifficulty("medio"); S.applyDifficulty("medio"); S.setUnlimitedChoice(unlimited);
  S.setState(S.newGame());
  return S.state;
}
// Dá ao dono `id` exatamente `n` regiões (primeiro as livres, depois as dos outros, sem eliminar ninguém).
function give(s, id, n) {
  const cnt = () => C.countTerritories(s, id);
  for (let i = s.owners.length - 1; i >= 0 && cnt() > n; i--) if (s.owners[i] === id) s.owners[i] = "neutral";
  for (let i = 0; i < s.owners.length && cnt() < n; i++) if (s.owners[i] === "neutral") s.owners[i] = id;
  for (let i = 0; i < s.owners.length && cnt() < n; i++) { const o = s.owners[i]; if (o !== id && C.countTerritories(s, o) > 1) s.owners[i] = id; }
  return s;
}

test("Node: a pergunta aparece só para o jogador e só uma vez por subida a 70%", () => {
  const s = game();
  assert.deepEqual(s.dominion, { ask: null, declined: false, continued: false });
  s.aiAvoid = { player: true };
  give(s, "player", 17); S.playEra(ZERO);
  assert.equal(s.result, null, "não devia encerrar antes da escolha");
  assert.ok(C.dominionAsking(s) && s.dominion.ask === 1 && s.pending === null, "devia esperar pela escolha sem abrir a era 2");
  assert.equal(s.timeline.at(-1).end.dominionAsk, true);
  assert.throws(() => S.playEra(ZERO), /Falta escolher/);
  assert.throws(() => C.beginEra(s, S.configApplied), /Falta escolher/);
  assert.ok(S.chooseDominion(false));
  assert.ok(!C.dominionAsking(s) && s.pending?.era === 2 && s.dominion.declined && s.dominion.continued);
  for (let i = 0; i < 3; i++) { give(s, "player", 17); S.playEra(ZERO); assert.ok(!C.dominionAsking(s) && !s.result, `perguntou de novo na era ${s.era - 1}`); }
  give(s, "player", 16); S.playEra(ZERO);
  assert.equal(s.dominion.declined, false, "caiu abaixo de 70%: a pergunta devia voltar a valer");
  give(s, "player", 18); S.playEra(ZERO);
  assert.equal(s.dominion.ask, s.era, "subiu outra vez: devia perguntar de novo");
  assert.equal(S.chooseDominion(true), true);
  assert.equal(S.chooseDominion(true), false, "sem pergunta aberta não há resposta");
});

test("Node: \"Vencer agora\" encerra como antes (mesmo resultado, era e registos)", () => {
  const s = game();
  give(s, "player", 17);
  const old = JSON.parse(JSON.stringify(s)); delete old.dominion;   // a mesma partida sem a escolha = o jogo de antes
  S.playEra(ZERO); assert.ok(C.dominionAsking(s));
  S.chooseDominion(true);
  C.finishEra(old, S.configApplied, { playerAllocation: ZERO });
  assert.deepEqual(s.result, old.result);
  assert.deepEqual(s.result, { era: 1, type: "victory", winners: ["player"], reasons: { player: ["territorial"] } });
  assert.deepEqual(s.timeline.at(-1).end, old.timeline.at(-1).end);
  assert.deepEqual(s.history.at(-1).end.result, old.result);
  assert.equal(s.pending, null);
  assert.match(s.log[0].text, /vitória de Jogador por maioria territorial/);
  // Medalhas: Primeira coroa e Relâmpago (domínio até a era 18).
  assert.ok(M.metMedals(s).includes("coroa") && M.metMedals(s).includes("relampago"));
});

test("Node: \"Continuar\" vence por domínio no limite se mantiver 70%, senão decidem os pontos", () => {
  for (const [eras, keep] of [[15, true], [30, true], [15, false]]) {
    const s = game({ eras, conquest: true }); s.aiAvoid = { player: true };
    give(s, "player", 17); S.playEra(ZERO); S.chooseDominion(false);
    while (!s.result) {
      if (s.era === eras && !keep) give(s, "player", 16);
      S.playEra(ZERO); assert.ok(!C.dominionAsking(s), "não devia perguntar de novo");
    }
    assert.equal(s.result.era, eras);
    if (keep) {
      assert.deepEqual(s.result.reasons, { player: ["territorial"] }, JSON.stringify(s.result));
      assert.equal(s.result.dominionKept, true);
      assert.match(C.describeResult(s, s.result), /maioria territorial \(mantida até a última era\)/);
      // Relâmpago continua coerente: vale a era em que a vitória aconteceu (15 ≤ 18 sim; 30 não).
      assert.equal(M.metMedals(s).includes("relampago"), eras <= M.MEDAL_RULES.flashEra, `${eras} eras`);
      assert.ok(M.metMedals(s).includes("coroa"));
    } else {
      assert.ok(s.result.scores && Object.values(s.result.reasons).every((r) => r.length === 1 && r[0] === "score"), JSON.stringify(s.result.reasons));
      assert.ok(!s.result.dominionKept);
    }
  }
});

test("Node: rival a 70% vence na hora; partidas só de IAs e laboratórios não têm a escolha", () => {
  const s = game(); const ai = C.A(s).id;
  give(s, ai, 17); S.playEra(ZERO);
  assert.ok(!C.dominionAsking(s));
  assert.deepEqual(s.result?.reasons, { [ai]: ["territorial"] });
  // Estados dos laboratórios / partidas só de IAs: sem state.dominion → o fim de sempre.
  assert.equal(C.newState(C.DEFAULTS, { endRules: true }).dominion, undefined);
  const m = C.runMatch(C.DEFAULTS, { profiles: ["aggressive", "adaptive"], civCount: 2, seed: 7 });
  assert.equal(m.state.dominion, undefined);
  assert.ok(m.result && !m.state.timeline.some((e) => e.end?.dominionAsk));
  // Lugar do jogador controlado pela IA (simulações) com dominion: também encerra na hora.
  const t = game(); C.P(t).controller = "ai"; give(t, "player", 17); C.finishEra(t, S.configApplied, {});
  assert.deepEqual(t.result?.reasons?.player, ["territorial"]);
});

test("Node: Sem limite — 100 eras, domínio do jogador vence na hora, supremacia a partir da era 15", () => {
  const s = game({ unlimited: true });
  assert.ok(s.unlimited === true && s.maxEras === 100 && S.configApplied.endgame.maxEras === 100);
  assert.equal(C.supremacyMinEra(s, S.configApplied), 15);
  const std = game({ eras: 30 }); assert.equal(C.supremacyMinEra(std, S.configApplied), 15, "30 eras: também a era 15");
  assert.ok(!std.unlimited);
  const u = game({ unlimited: true }); give(u, "player", 17); S.playEra(ZERO);
  assert.ok(!C.dominionAsking(u)); assert.deepEqual(u.result?.reasons, { player: ["territorial"] });
  // Antes da era 15 a supremacia não conta; o teto de 100 eras decide por pontos.
  const w = game({ unlimited: true }); S.playEra(ZERO);
  assert.equal(w.supremacy.status, "notYet");
  w.era = 99; w.pending.era = 100; S.playEra(ZERO);
  assert.equal(w.result?.era, 100); assert.ok(w.result.scores, "no teto devia decidir por pontos");
  S.setUnlimitedChoice(false);
});

test("Node: save — a pergunta e o Sem limite ficam gravados; recarregar a meio da pergunta funciona; saves antigos", () => {
  const s = game(); give(s, "player", 17); S.playEra(ZERO);
  const raw = SV.serializeGame();
  for (const win of [true, false]) {
    const r = SV.parseSavedGame(raw); assert.equal(r.status, "ok");
    S.setState(r.game.state); assert.ok(C.dominionAsking(S.state), "a pergunta perdeu-se no save");
    S.chooseDominion(win);
    if (win) assert.deepEqual(S.state.result.reasons, { player: ["territorial"] });
    else assert.ok(S.state.pending?.era === 2 && S.state.dominion.declined && !S.state.result);
  }
  const u = game({ unlimited: true }); S.playEra(ZERO);
  const ru = SV.parseSavedGame(SV.serializeGame()); assert.ok(ru.game.state.unlimited === true && ru.game.state.maxEras === 100);
  // Save antigo (sem state.dominion), de 50 eras: continua de 50, sem Sem limite e encerra na hora ao chegar a 70%.
  const o = game({ eras: 50 }); delete o.dominion;
  const ro = SV.parseSavedGame(SV.serializeGame()); assert.equal(ro.status, "ok");
  S.setState(ro.game.state); assert.ok(S.state.maxEras === 50 && !S.state.unlimited && S.state.dominion === undefined);
  give(S.state, "player", 17); S.playEra(ZERO);
  assert.ok(!C.dominionAsking(S.state)); assert.deepEqual(S.state.result?.reasons, { player: ["territorial"] });
});

/* ── Na interface (versão do jogador) ── */
let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());
const PIXEL = { ...devices["Pixel 7"], deviceScaleFactor: 1, reducedMotion: "reduce" };

async function startUI(page, { eras = null, unlimited = false } = {}) {
  await page.locator("#homeStart").click();
  if (eras || unlimited) {
    await openCustomize(page);
    await page.locator(`#homeEraPresets [data-eras="${unlimited ? "unlimited" : eras}"]`).click();
  }
  await page.locator("#setupStart").click();
  const confirm = page.locator('#modalRoot button:has-text("Nova partida")');
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1 && !!state.pending);
  await page.evaluate(() => { state.ui.skipIdleWarning = true; state.aiAvoid = { player: true }; });
}
// Dá 17 regiões ao jogador e conclui a era pelo botão.
async function dominateAndConclude(page, n = 17) {
  await page.evaluate((n) => {
    for (let i = 0; i < state.owners.length && countTerritories(state, "player") < n; i++) if (state.owners[i] === "neutral") state.owners[i] = "player";
    renderAll();
  }, n);
  await page.locator("#advance").click();
}

test("Pixel 7: \"Você domina o mapa!\" — diálogo acessível, foco em Vencer agora, 48 px; Esc vence por domínio", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startUI(page);
  await dominateAndConclude(page);
  const dlg = page.locator("#dominionChoice");
  await dlg.waitFor({ state: "visible" });
  const a11y = await page.evaluate(() => {
    const back = document.querySelector("#modalRoot .modal-back"), lab = document.getElementById(back.getAttribute("aria-labelledby"));
    return { role: back.getAttribute("role"), modal: back.getAttribute("aria-modal"), title: lab?.textContent, focus: document.activeElement?.textContent.trim(),
      buttons: [...back.querySelectorAll("button")].map((b) => ({ t: b.textContent.trim(), h: b.getBoundingClientRect().height })), help: back.querySelector(".dlg-help")?.textContent };
  });
  assert.equal(a11y.role, "dialog"); assert.equal(a11y.modal, "true");
  assert.equal(a11y.title, "Você domina o mapa!");
  assert.equal(a11y.focus, "Vencer agora", "o foco devia começar em Vencer agora");
  assert.deepEqual(a11y.buttons.map((b) => b.t), ["Vencer agora", "Continuar até a era 30"]);
  for (const b of a11y.buttons) assert.ok(b.h >= 48, `${b.t}: ${b.h} px`);
  assert.match(a11y.help, /^Continuando, você ainda vence por domínio no fim se mantiver 70%/);
  assert.deepEqual(await horizontalOverflow(page), []);
  // Tab fica preso dentro da janela.
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  assert.ok(await page.evaluate(() => !!document.activeElement.closest("#dominionChoice")));
  // Esc = Vencer agora (a opção segura).
  await page.keyboard.press("Escape");
  const scr = page.locator("#resultScreen");
  await scr.waitFor({ state: "visible" });
  assert.match(await page.locator("#resultTitle").innerText(), /Vitória por domínio/);
  assert.deepEqual(await page.evaluate(() => ({ era: state.result.era, r: state.result.reasons })), { era: 1, r: { player: ["territorial"] } });
  assert.match(await page.locator("#resultScreen .res-medals").innerText(), /Primeira coroa|Relâmpago/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("Pixel 7: Continuar segue a partida, não pergunta de novo, e recarregar a meio da pergunta volta a mostrá-la", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startUI(page);
  await dominateAndConclude(page);
  await page.locator("#dominionChoice").waitFor({ state: "visible" });
  // Recarregar com a pergunta aberta: a partida continua salva na era 1, à espera da escolha.
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && !!state);
  assert.ok(await page.evaluate(() => dominionAsking(state) && state.era === 1 && !state.pending));
  assert.match(await page.locator("#homeContinueLabel").innerText(), /Continuar · Era 1/);
  await page.locator("#homeContinue").click();
  await page.locator("#dominionChoice").waitFor({ state: "visible" });
  await page.locator('#dominionChoice button:has-text("Continuar até a era 30")').click();
  await page.waitForFunction(() => !dominionAsking(state) && state.era === 2 && !!state.pending && state.dominion.declined);
  assert.equal(await page.locator("#dominionChoice").count(), 0);
  // A era seguinte (ainda com 70%) não pergunta outra vez; o Placar lembra o que falta.
  await page.evaluate(() => { state.ui.skipReport = true; });
  await page.locator("#advance").click();
  await page.waitForFunction(() => state.era === 3);
  assert.equal(await page.locator("#dominionChoice").count(), 0, "a pergunta reapareceu");
  await page.locator("#scorePill").click();
  assert.match(await page.locator("#dominionRule").innerText(), /Você domina o mapa\. Mantenha 17 regiões até a era 30/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("Pixel 7: quem continua e mantém 70% vê \"Vitória por domínio\" no fim; o resumo da era lembra o domínio", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startUI(page, { eras: 15 });
  await page.evaluate(() => { configApplied.endgame.supremacyEnabled = false; });   // sem supremacia pelo caminho
  await dominateAndConclude(page);
  await page.locator('#dominionChoice button:has-text("Continuar até a era 15")').click();
  // Resumo da era depois de Continuar (a era 1 teve conquistas? pode ser só o aviso): na era seguinte, com o resumo,
  // aparece "Você domina o mapa".
  await page.waitForFunction(() => state.era === 2);
  const ev = await page.evaluate(() => { const b = eraSnapshot(); playEra({ military: 0, infrastructure: 0, technology: 0 }); return eraChanges(b).events.map((e) => e.title + " · " + e.sub); });
  assert.ok(ev.some((t) => /^Você domina o mapa · mantenha 17 regiões até a era 15/.test(t)), JSON.stringify(ev));
  await page.evaluate(() => { while (!state.result) playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
  await page.locator("#resultScreen").waitFor({ state: "visible" });
  assert.match(await page.locator("#resultTitle").innerText(), /Vitória por domínio/);
  assert.match(await page.locator("#resultScreen .res-sub").innerText(), /manteve 17 de 24 regiões até a última era/);
  assert.match(await page.locator("#resultScreen .sum-kicker").innerText(), /Era 15/i);
  assert.deepEqual(errors, []);
  await context.close();
});

test("Pixel 7: Personalizar → Duração \"Sem limite\" (no lugar de 50): texto, partida de até 100 eras, save e vitória na hora", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.equal(await page.locator('#homeEraPresets [data-eras="50"]').count(), 0, '"50 · longa" devia ter saído');
  const b = page.locator('#homeEraPresets [data-eras="unlimited"]');
  assert.match((await b.innerText()).replace(/\s+/g, " "), /^Sem limite/);
  assert.ok((await b.boundingBox()).height >= 48);
  await b.click();
  assert.equal(await b.getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#homeErasDesc").innerText(), "Termina por domínio, eliminação ou supremacia.");
  assert.equal(await page.locator("#homeMaxEras").inputValue(), "30", "o teto de 100 eras não é a duração escolhida em Outra");
  assert.match(await page.locator("#customizeSummary").innerText(), /^Sem limite · ritmo normal · vitória clássica$/);
  assert.match(await page.locator("#setupSummary").innerText(), /Médio · sem limite · ritmo normal/);
  assert.match(await page.locator("#homeVictoryDesc").innerText(), /a partir da era 15\)\. Ao dominar o mapa, você vence na hora\./);
  await page.locator("#homeConquest").click();
  assert.equal(await page.locator("#homeErasDesc").innerText(), "Termina por domínio ou eliminação.");
  await page.locator("#homeClassic").click();
  // "Outra" continua (10–150) e desmarca o Sem limite.
  await page.locator("#homeMaxEras").fill("50"); await page.locator("#homeMaxEras").press("Tab");
  assert.equal(await b.getAttribute("aria-pressed"), "false");
  assert.ok(await page.locator("#homeEraPresets .pg-other").evaluate((e) => e.classList.contains("on")));
  await b.click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && !!state.pending);
  assert.deepEqual(await page.evaluate(() => ({ u: state.unlimited, m: state.maxEras })), { u: true, m: 100 });
  assert.match(await page.locator("#statEra").innerText(), /1\s*\/∞/);
  assert.equal(await page.locator("#victoryPill").innerText(), "Sem limite");
  await page.evaluate(async () => { playEra({ military: 0, infrastructure: 0, technology: 0 }); await saveGame(); });
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && !!state);
  assert.deepEqual(await page.evaluate(() => ({ u: state.unlimited, m: state.maxEras, c: unlimitedChoice })), { u: true, m: 100, c: true });
  assert.match(await page.locator("#homeContinueMeta").innerText(), /^sem limite · Médio · 1 rival$/);
  await page.locator("#homeContinue").click();
  await page.evaluate(() => { state.ui.skipIdleWarning = true; });
  await page.locator("#scorePill").click();
  assert.match(await page.locator("#victoryPanel").innerText(), /Sem limite \(teto de 100 eras\): pontuação/);
  await page.keyboard.press("Escape");
  // Sem limite: o domínio do jogador vence na hora (não há fim para onde continuar).
  await dominateAndConclude(page);
  await page.locator("#resultScreen").waitFor({ state: "visible" });
  assert.equal(await page.locator("#dominionChoice").count(), 0);
  assert.match(await page.locator("#resultTitle").innerText(), /Vitória por domínio/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("save antigo de 50 eras abre como estava: 50 eras em \"Outra\" e o domínio encerra na hora", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.evaluate(async (key) => {
    configApplied.endgame.maxEras = 50; state = newGame(); delete state.dominion; state.ui.skipIdleWarning = true;
    playEra({ military: 0, infrastructure: 0, technology: 0 });
    await storage.set(key, serializeGame());
  }, KEYS.save);
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && !!state);
  assert.deepEqual(await page.evaluate(() => ({ m: state.maxEras, u: !!state.unlimited, d: state.dominion })), { m: 50, u: false, d: undefined });
  await page.locator("#homeContinue").click();
  assert.match(await page.locator("#statEra").innerText(), /2\s*\/50/);
  await dominateAndConclude(page);
  await page.locator("#resultScreen").waitFor({ state: "visible" });
  assert.equal(await page.locator("#dominionChoice").count(), 0);
  // A próxima partida mantém as 50 eras, agora em "Outra".
  await page.locator("#resultHome").click();
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.ok(await page.locator("#homeEraPresets .pg-other").evaluate((e) => e.classList.contains("on")));
  assert.equal(await page.locator("#homeMaxEras").inputValue(), "50");
  assert.deepEqual(errors, []);
  await context.close();
});
