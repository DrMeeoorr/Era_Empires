// Desafios e medalhas (20/11/2026, aprovado pelo usuário: só medalhas, sem prêmio que mude regras).
// Critérios com estados montados (Node), "uma vez só", gravação entre partidas, dados danificados, tutorial e
// laboratórios sem medalhas e a tela Medalhas acessível e sem cortes nos 3 celulares (também com DejaVu Sans).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launch, openGame, dismissModals, choosePlan, assertClickable, horizontalOverflow, MOBILE_SCREENS } = require("./helpers");

const ROOT = path.resolve(__dirname, "..");
const load = (rel) => import(pathToFileURL(path.join(ROOT, "src", rel)).href);
const WIDE_FONT = '*{font-family:"DejaVu Sans",sans-serif!important}';
const PLAYER_KEY = "imperios-jogador-medalhas";

// Armazenamento falso para o Node (o jogo só fala com ele por src/platform/storage.js).
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

let E, M;
before(async () => {
  const [core, terrain] = await Promise.all([load("core/index.js"), load("core/terrain.js")]);
  E = { ...core, ...terrain };
  M = await load("app/medals.js");
});

// Partida montada: jogador humano + `rivals` rivais, dificuldade `diff`, era `era`.
function scene({ rivals = 1, diff = "medio", era = 10 } = {}) {
  const c = E.clone(E.DEFAULTS); c.map.aiCount = rivals;
  const s = E.newState(c, { endRules: true });
  s.difficulty = diff; s.era = era; s.ui = { skipIdleWarning: false };
  s.terrain = { type: "padrao", seed: null, list: Array(24).fill("campina") };
  return s;
}
const win = (s, reasons = ["score"], era = s.era) => { s.result = { era, type: "victory", winners: ["player"], reasons: { player: reasons } }; return s; };
const met = (s, phase = "end") => M.metMedals(s, phase);
const has = (s, id, phase) => met(s, phase).includes(id);
// Vitória que só cumpre a "Primeira coroa" (tomou uma região de rival: não é Diplomata).
const plainWin = () => { const s = win(scene()); E.P(s).attacks.enemyConquests = 1; return s; };

test("lista: 8 a 12 medalhas, ids únicos, nome, critério e desenho próprios", () => {
  assert.ok(M.MEDALS.length >= 8 && M.MEDALS.length <= 12, String(M.MEDALS.length));
  assert.equal(new Set(M.MEDALS.map((m) => m.id)).size, M.MEDALS.length);
  const ui = fs.readFileSync(path.join(ROOT, "src/ui/medals.js"), "utf8");
  const glyphs = ui.slice(ui.indexOf("const GLYPH"), ui.indexOf("const RIBBON"));
  for (const m of M.MEDALS) {
    assert.ok(m.name && m.goal && /^[A-ZÁÉÍÓÚÂÊÔ]/.test(m.goal) && m.goal.endsWith("."), m.id);
    assert.match(glyphs, new RegExp(`\\b${m.id}:\``), `sem desenho: ${m.id}`);
  }
  // Nenhuma medalha fala de prêmio ou bônus (são só de honra).
  assert.doesNotMatch(M.MEDALS.map((m) => m.goal).join(" "), /b[ôo]nus|pr[êe]mio|ganha \+/i);
});

test("Primeira coroa: só vitória do jogador (derrota e empate não contam)", () => {
  assert.ok(has(win(scene()), "coroa"));
  const lost = scene(); lost.result = { era: 10, type: "victory", winners: ["ai"], reasons: { ai: ["score"] } };
  assert.ok(!has(lost, "coroa"));
  const draw = scene(); draw.result = { era: 10, type: "draw", winners: ["player", "ai"], reasons: { player: ["score"], ai: ["score"] } };
  assert.deepEqual(met(draw), []);
  assert.deepEqual(met(scene()), [], "partida em curso: nada de fim de partida");
});

test("Construtor e Sábio: a área com mais ouro investido na partida (empate não conta)", () => {
  const a = win(scene()); E.P(a).invested = { military: 10, infrastructure: 30, technology: 20 };
  assert.ok(has(a, "construtor") && !has(a, "sabio"));
  const b = win(scene()); E.P(b).invested = { military: 10, infrastructure: 20, technology: 30 };
  assert.ok(has(b, "sabio") && !has(b, "construtor"));
  const tie = win(scene()); E.P(tie).invested = { military: 30, infrastructure: 30, technology: 30 };
  assert.ok(!has(tie, "sabio") && !has(tie, "construtor"));
  const lost = scene(); E.P(lost).invested = { military: 0, infrastructure: 30, technology: 0 };
  assert.ok(!has(lost, "construtor"), "sem vitória não conta");
});

test("Diplomata: vencer sem tomar região de rival (regiões livres podem)", () => {
  const a = win(scene()); E.P(a).attacks = { wins: 6, losses: 2, neutralConquests: 6, enemyConquests: 0 };
  assert.ok(has(a, "diplomata"));
  const b = win(scene()); E.P(b).attacks = { wins: 7, losses: 0, neutralConquests: 6, enemyConquests: 1 };
  assert.ok(!has(b, "diplomata"));
});

test("Relâmpago: domínio ou eliminação até a era 18; Hegemonia: supremacia", () => {
  assert.equal(M.MEDAL_RULES.flashEra, 18);
  assert.ok(has(win(scene({ era: 18 }), ["territorial"]), "relampago"));
  assert.ok(has(win(scene({ era: 12 }), ["elimination", "territorial"]), "relampago"));
  assert.ok(!has(win(scene({ era: 19 }), ["territorial"]), "relampago"));
  assert.ok(!has(win(scene({ era: 10 }), ["score"]), "relampago"));
  assert.ok(has(win(scene({ era: 22 }), ["supremacy"]), "hegemonia"));
  assert.ok(!has(win(scene({ era: 22 }), ["territorial"]), "hegemonia"));
});

test("Contra a maré: Difícil ou Lendário com 3 rivais ou mais", () => {
  assert.ok(has(win(scene({ rivals: 3, diff: "dificil" })), "mare"));
  assert.ok(has(win(scene({ rivals: 5, diff: "hardcore" })), "mare"));
  assert.ok(!has(win(scene({ rivals: 2, diff: "dificil" })), "mare"));
  assert.ok(!has(win(scene({ rivals: 3, diff: "medio" })), "mare"));
});

test("Explorador (mapa sorteado) e Terra natal (terrenos com efeito)", () => {
  const a = win(scene()); assert.ok(!has(a, "explorador") && !has(a, "terra"));
  const b = win(scene()); b.terrain.type = "sorteado"; b.terrain.seed = 7;
  assert.ok(has(b, "explorador") && !has(b, "terra"));
  const c = win(scene()); E.enableTerrainEffects(c);
  assert.ok(has(c, "terra") && !has(c, "explorador"));
});

test("Sobrevivente: 5 regiões → 2 ou menos → 5 de novo (pela linha do tempo; vale a meio da partida)", () => {
  const tl = (list) => list.map((n, i) => ({ era: i + 1, civs: [{ id: "player", territories: n }] }));
  const s = scene(); s.timeline = tl([1, 3, 5, 4, 2, 3, 5]);
  assert.ok(has(s, "sobrevivente", "era"));
  for (const bad of [[1, 2, 5], [1, 5, 3, 5], [1, 5, 2, 4], [5, 1]]) { const x = scene(); x.timeline = tl(bad); assert.ok(!has(x, "sobrevivente", "era"), JSON.stringify(bad)); }
});

test("Muralha: conta só ataques repelidos em regiões que eram suas e continuaram suas; 3 dão a medalha", () => {
  const s = scene({ era: 4 }); s.owners[0] = "player"; s.owners[1] = "player"; s.owners[2] = "player";
  const before = s.owners.slice();
  s.log = [
    { era: 4, text: "🛡️ Ataque de Rubro repelido: território 1; 12 pontos comprometidos." },
    { era: 4, text: "🛡️ Ataque de Rubro repelido: território 2; 9 pontos comprometidos." },
    { era: 4, text: "🛡️ Ataque de Ocre repelido: território 7; 9 pontos comprometidos." },   // não era sua
    { era: 3, text: "🛡️ Ataque de Rubro repelido: território 1; 9 pontos comprometidos." },   // outra era
  ];
  M.trackEra(s, before, 4);
  assert.equal(s.ui.medals.held, 2);
  assert.ok(!has(s, "muralha", "era"));
  s.owners[2] = "ai"; s.log.unshift({ era: 4, text: "🛡️ Ataque de Rubro repelido: território 3; 5 pontos comprometidos." });
  M.trackEra(s, before, 4);
  assert.equal(s.ui.medals.held, 4, "território 3 perdido não conta; os outros dois contam de novo nesta chamada");
  assert.ok(has(s, "muralha", "era"));
  assert.ok(!met(s, "era").some((id) => M.MEDAL_BY_ID[id].when === "end"), "a meio da partida só saem medalhas de 'era'");
});

test("tutorial: só 'Primeiros passos' (e só se terminar os passos); laboratórios, 'Configurações' e IA no seu lugar não dão medalhas", () => {
  const t = win(scene(), ["territorial"]); t.tutorial = { done: true, step: 4 };
  assert.deepEqual(met(t, "end"), [], "a partida do tutorial não dá medalhas de vitória");
  assert.deepEqual(met(t, "tutorial"), ["passos"]);
  t.tutorial.skipped = true; assert.deepEqual(met(t, "tutorial"), [], "pular o tutorial não dá medalha");
  assert.deepEqual(met(win(scene()), "tutorial"), [], "fora do tutorial não há 'Primeiros passos'");
  const lab = win(scene()); M.markLabGame(lab); assert.deepEqual(met(lab), []);
  assert.deepEqual(met(win(scene({ diff: "config" }))), []);
  const ai = win(scene()); E.P(ai).controller = "ai"; assert.deepEqual(met(ai), []);
});

test("conquista uma vez só: por partida e 'nova' só da primeira vez no aparelho; grava e relê", async () => {
  mem.clear(); M.useMedalSlot("player"); await M.loadMedals();
  assert.deepEqual(M.earnedMedals, {});
  const s = plainWin();
  const first = M.awardMedals(s, "end");
  assert.deepEqual(first, [{ id: "coroa", first: true }]);
  assert.deepEqual(M.awardMedals(s, "end"), [], "a mesma partida não anuncia de novo");
  await new Promise((r) => setTimeout(r, 0));
  const raw = mem.get(PLAYER_KEY);
  assert.ok(raw && JSON.parse(raw).earned.coroa, "não gravou na chave do jogador");
  M.setEarnedMedals({}); await M.loadMedals();
  assert.ok(M.earnedMedals.coroa, "não releu depois de 'recarregar'");
  const again = M.awardMedals(plainWin(), "end");
  assert.deepEqual(again, [{ id: "coroa", first: false }], "outra partida: aparece na lista da partida, mas não é nova");
  assert.deepEqual(M.matchMedals(s), [{ id: "coroa", first: true }]);
  // Chaves por versão, diferentes das do save da partida.
  assert.notEqual(M.MEDAL_KEYS.player, M.MEDAL_KEYS.dev);
  const save = await load("app/save.js");
  assert.ok(!Object.values(save.SAVE_KEYS).includes(M.MEDAL_KEYS.player) && !Object.values(save.SAVE_KEYS).includes(M.MEDAL_KEYS.dev));
  assert.equal(M.useMedalSlot("dev"), M.MEDAL_KEYS.dev); M.useMedalSlot("player");
});

test("dados danificados não quebram: são ignorados e o jogo começa do zero (ou fica com o que é válido)", async () => {
  for (const raw of ["{lixo", "null", "[]", '"texto"', '{"v":2,"earned":{"coroa":{}}}', '{"v":1,"earned":[1,2]}', '{"v":1}', "1e999"]) {
    assert.deepEqual(M.parseMedals(raw), {}, raw);
    mem.set(PLAYER_KEY, raw); await M.loadMedals(); assert.deepEqual(M.earnedMedals, {}, raw);
  }
  const mixed = M.parseMedals('{"v":1,"earned":{"xyz":{"era":3},"coroa":"lixo","sabio":{"era":"x","at":5,"diff":"impossivel"}}}');
  assert.deepEqual(mixed, { coroa: { era: null, at: null, diff: null }, sabio: { era: null, at: 5, diff: null } });
  // Armazenamento que falha ao ler ou gravar: sem exceções.
  const bad = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("cheio"); }, removeItem() {} };
  const keep = globalThis.localStorage; globalThis.localStorage = bad;
  try {
    await M.loadMedals(); assert.deepEqual(M.earnedMedals, {});
    assert.equal(await M.saveMedals(), false);
    assert.deepEqual(M.awardMedals(plainWin(), "end"), [{ id: "coroa", first: true }]);
  } finally { globalThis.localStorage = keep; }
});

// ── No navegador (versão do jogador) ──
let browser;
after(async () => browser && browser.close());
async function startGame(page) {
  await page.locator("#homeStart").click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  await dismissModals(page);
}
async function concludeByButton(page) {
  const era = await page.evaluate(() => state.era);
  await page.locator("#advance").click();
  const idle = page.locator('#modalRoot button:has-text("Concluir mesmo assim")');
  if (await idle.count()) await idle.click();
  await page.waitForFunction((e) => state.result || state.era > e, era);
  await page.waitForTimeout(120);
}

test("na interface: aviso 'Nova medalha' no resumo da era uma vez só, conta no início e no menu, continua depois de recarregar", async () => {
  browser = await launch();
  const { context, page, errors } = await openGame(browser, { contextOptions: { reducedMotion: "reduce" } });
  assert.match(await page.locator("#homeMedals").innerText(), /Medalhas\s*0\/12/);
  await startGame(page);
  await page.evaluate(() => { medalTrack(state).held = 3; });   // 3 defesas já contadas (estado montado)
  await choosePlan(page, "balanced");
  await concludeByButton(page);
  const sum = page.locator("#eraSummary .sum-medal");
  await sum.waitFor({ state: "visible" });
  assert.equal(await sum.count(), 1);
  assert.match(await sum.innerText(), /Nova medalha\s*Muralha/i);
  assert.equal(await page.locator("#eraSummary .sum-medals").getAttribute("role"), "status");
  await dismissModals(page);
  await choosePlan(page, "balanced");
  await concludeByButton(page);
  assert.equal(await page.locator("#eraSummary .sum-medal").count(), 0, "a Muralha foi anunciada de novo");
  await dismissModals(page);
  await page.waitForFunction(async () => (await storage.get(MEDAL_KEY) || "").includes("muralha"));
  await page.locator("#menuBtn").click();
  assert.match(await page.locator("#menuMedals").innerText(), /Medalhas\s*1\/12/);
  assert.equal(await page.locator("#menuMedals").getAttribute("aria-label"), "Medalhas: 1 de 12");
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && !!state);
  assert.ok(await page.evaluate(() => !!earnedMedals.muralha), "a medalha não ficou guardada");
  assert.match(await page.locator("#homeMedals").innerText(), /1\/12/);
  assert.ok(await page.evaluate(() => state.ui.medals.got.muralha != null), "o registo da partida (no save) perdeu-se");
  assert.deepEqual(errors, []);
  await context.close();
});

test("na interface: dados de medalhas danificados não quebram o jogo e são substituídos na próxima medalha", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { reducedMotion: "reduce" } });
  await page.evaluate((k) => storage.set(k, "{lixo"), PLAYER_KEY);
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && !!state);
  assert.match(await page.locator("#homeMedals").innerText(), /0\/12/);
  await startGame(page);
  await page.evaluate(() => { while (!state.result) { P(state).military += 60; for (const t of eligibleTargets(state, "player")) attackTerritory(state, t.i, "player", configApplied, true); playEra({ military: 0, infrastructure: P(state).treasury, technology: 0 }); } renderAll(); });
  await page.locator("#resultScreen .res-medals").waitFor({ state: "visible" });
  assert.match(await page.locator("#resultScreen .res-medals").innerText(), /Primeira coroa/);
  const saved = await page.evaluate((k) => storage.get(k), PLAYER_KEY);
  assert.ok(JSON.parse(saved).earned.coroa, saved);
  assert.deepEqual(errors, []);
  await context.close();
});

test("na interface: o tutorial só dá 'Primeiros passos' (ao terminar os passos) e a vitória nele não dá medalhas", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { reducedMotion: "reduce" } });
  await page.locator("#homeTutorial").click();
  await page.waitForFunction(() => !!state.tutorial && document.getElementById("homeScreen").hidden);
  await page.evaluate(() => { state.tutorial.step = 4; renderAll(); });
  const next = page.locator('#tutBox [data-tut="next"]');
  await next.waitFor({ state: "visible" });
  await next.click();
  await page.waitForFunction(() => !!earnedMedals.passos);
  await page.locator("#toast:not([hidden])").waitFor();
  assert.match(await page.locator("#toast").innerText(), /Nova medalha: Primeiros passos/);
  await page.evaluate(() => { while (!state.result) { P(state).military += 60; for (const t of eligibleTargets(state, "player")) attackTerritory(state, t.i, "player", configApplied, true); playEra({ military: 0, infrastructure: P(state).treasury, technology: 0 }); } renderAll(); });
  await page.locator("#resultScreen .res-medals").waitFor({ state: "visible" });
  assert.match(await page.locator("#resultScreen .res-medals").innerText(), /não vale medalhas/);
  assert.deepEqual(await page.evaluate(() => Object.keys(earnedMedals)), ["passos"]);
  // Pular o tutorial não dá medalha.
  await page.evaluate(() => { setEarnedMedals({}); startTutorial(); });
  await page.locator('#tutBox [data-tut="skip"]').click();
  await dismissModals(page);
  assert.deepEqual(await page.evaluate(() => Object.keys(earnedMedals)), []);
  assert.deepEqual(errors, []);
  await context.close();
});

test("dev.html: partida avançada pelos laboratórios não dá medalhas; os testes internos (runTests) passam", async () => {
  const { context, page, errors } = await openGame(browser, { dev: true });
  const r = await page.evaluate(async () => {
    setCurrentDifficulty("medio"); applyDifficulty("medio"); state = newGame(); renderAll();
    await runLong(2);
    const labs = !!state.ui.labs;
    while (!state.result) { P(state).military += 60; for (const t of eligibleTargets(state, "player")) attackTerritory(state, t.i, "player", configApplied, true); playEra({ military: 0, infrastructure: P(state).treasury, technology: 0 }); }
    renderAll();
    const t = runTests();
    return { labs, earned: Object.keys(earnedMedals), allowed: medalsAllowed(state), pass: t.pass, total: t.total };
  });
  assert.ok(r.labs && !r.allowed, JSON.stringify(r));
  assert.deepEqual(r.earned, []);
  assert.equal(r.pass, r.total, `runTests: ${r.pass}/${r.total}`);
  assert.match(await page.locator("#resultScreen .res-medals").innerText(), /não vale medalhas/);
  assert.deepEqual(errors, []);
  await context.close();
});

// Elementos com texto cortado ou fora da tela dentro de `root`.
const cutText = (page, root) => page.evaluate((root) => {
  const out = [], vw = innerWidth;
  for (const el of document.querySelectorAll(`${root} *`)) {
    if (el.closest("[hidden],svg") || !el.offsetParent) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (r.right > vw + 1 || r.left < -1) out.push(`${el.className || el.tagName}: passa da tela`);
    const cs = getComputedStyle(el);
    if (cs.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) out.push(`${el.className || el.tagName}: corta "${el.textContent.trim().slice(0, 30)}"`);
    if (el.children.length === 0 && el.textContent.trim() && el.parentElement) { const p = el.parentElement.getBoundingClientRect(); if (r.right > p.right + 1.5) out.push(`"${el.textContent.trim().slice(0, 30)}" sai da caixa`); }
  }
  return out;
}, root);

for (const [name, opts, wide] of [...MOBILE_SCREENS.map(([n, o]) => [n, o, false]), ...MOBILE_SCREENS.map(([n, o]) => [n, o, true])]) {
  test(`tela Medalhas e resultado em ${name}${wide ? " com DejaVu Sans" : ""}: diálogo com foco, Esc devolve o foco, 48 px, sem cortes nem rolagem lateral`, async () => {
    browser ||= await launch();
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
    if (wide) await page.addStyleTag({ content: WIDE_FONT });
    // Algumas conquistadas, outras não (as duas aparências na mesma tela).
    await page.evaluate(() => { setEarnedMedals({ coroa: { era: 12, at: Date.now(), diff: "medio" }, muralha: { era: 9, at: Date.now(), diff: "dificil" } }); refreshMedalCounts(); });
    // Tela inicial: o botão Medalhas cabe sem rolar (também com partida salva).
    const hb = await assertClickable(page, "#homeMedals", "Medalhas (início)");
    assert.ok(hb.height >= 47.5 && hb.y + hb.height <= page.viewportSize().height + 1, "botão Medalhas fora da tela inicial");
    await page.locator("#homeMedals").click();
    const scr = page.locator("#medalsScreen");
    await scr.waitFor({ state: "visible" });
    assert.equal(await scr.getAttribute("role"), "dialog");
    assert.equal(await scr.getAttribute("aria-modal"), "true");
    assert.equal(await page.evaluate(() => document.getElementById(document.getElementById("medalsScreen").getAttribute("aria-labelledby")).textContent), "Medalhas");
    assert.ok(await page.evaluate(() => document.getElementById("medalsScreen").contains(document.activeElement)), "o foco não entrou na tela");
    assert.equal(await page.locator("#medalsScreen .md-row").count(), 12);
    assert.equal(await page.locator("#medalsScreen .md-row.on").count(), 2);
    assert.equal(await page.locator("#medalsScreen .md-tag").count(), 0, "etiqueta 'Nova!' fora da secção Nesta partida");
    const txt = await scr.innerText();
    assert.match(txt, /2\s*de 12 medalhas/);
    assert.match(txt, /A conquistar/); assert.match(txt, /Vença num mapa sorteado\./, "critério das bloqueadas devia estar à vista");
    for (const sel of ["#medalsBack", "#medalsOk"]) { const b = await assertClickable(page, sel, sel); assert.ok(b.height >= 47.5 && b.width >= 47.5, sel); }
    assert.deepEqual(await cutText(page, "#medalsScreen"), []);
    assert.deepEqual(await horizontalOverflow(page), []);
    assert.ok(await page.evaluate(() => { const s = document.getElementById("medalsScreen"); return s.scrollWidth <= s.clientWidth + 1; }));
    await page.keyboard.press("Escape");
    await scr.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.id), "homeMedals", "o foco não voltou ao botão");
    // Por cima da partida (menu ☰): ✕ em vez da seta.
    await startGame(page);
    await page.locator("#menuBtn").click();
    const mb = await assertClickable(page, "#menuMedals", "Medalhas (menu)"); assert.ok(mb.height >= 47.5);
    await page.locator("#menuMedals").click();
    await scr.waitFor({ state: "visible" });
    assert.ok(await page.locator("#medalsScreen .pg-x").isVisible() && !(await page.locator("#medalsBack").isVisible()));
    await page.locator("#medalsScreen .pg-x").click();
    await scr.waitFor({ state: "hidden" });
    // Resultado com medalhas: faixa compacta, 48 px, sem cortes; "Jogar de novo" continua visível na tela.
    await page.evaluate(() => { while (!state.result) { P(state).military += 60; for (const t of eligibleTargets(state, "player")) attackTerritory(state, t.i, "player", configApplied, true); playEra({ military: 0, infrastructure: P(state).treasury, technology: 0 }); } renderAll(); });
    const strip = page.locator("#resultScreen .res-medals");
    await strip.waitFor({ state: "visible" });
    const sb = await assertClickable(page, "#resultScreen .res-medals", "faixa das medalhas"); assert.ok(sb.height >= 47.5);
    assert.deepEqual(await cutText(page, "#resultScreen"), []);
    await page.evaluate(() => document.getElementById("resultScreen").scrollTo(0, 0));
    if (name !== "360x640") { const again = await page.locator("#newGameAfterEnd").boundingBox(); assert.ok(again.y + again.height <= page.viewportSize().height + 1, "Jogar de novo saiu da tela"); }
    await strip.click();
    await scr.waitFor({ state: "visible" });
    assert.match(await scr.innerText(), /Nesta partida/);
    assert.deepEqual(await cutText(page, "#medalsScreen"), []);
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    await context.close();
  });
}
