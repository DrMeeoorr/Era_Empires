// Rodada de balanceamento de 20/11/2026 (aprovada pelo usuário). Quatro mudanças:
//  1. Médio com terrenos com efeito: rivais +3% de ouro (1,06 com 2+ rivais, 1,03 no 1×1), gravado na partida.
//     Rodada 4 (20/11/2026): Médio com efeitos passou a 1,03 também com 2+ rivais (o carimbo continua a funcionar igual).
//  2. Mapa padrão: Jaspe ↔ Rochedo (Jaspe Montanha, Rochedo Colinas) — tabela em tests/terrain.test.js.
//  3. Posições iniciais (mapa de 24 regiões): Arvela, Zênite, Esmera, Torva, Musgo, Ombral (Pedral saiu).
//  4. Difícil/Lendário com 2+ rivais no Só visual: regiões livres primeiro; Difícil 1,05 com 2+ rivais, 1,03 no 1×1.
//     Rodada 4 (20/11/2026): Difícil 1,03 com qualquer número de rivais; Médio Só visual 1,00 (antes 1,03 com 2+).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launch, openGame, openCustomize, MOBILE_SCREENS } = require("./helpers");

const SRC = path.resolve(__dirname, "..", "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const PIXEL = MOBILE_SCREENS[0][1];

let E;
before(async () => {
  const [core, terrain, ai, names] = await Promise.all([load("core/index.js"), load("core/terrain.js"), load("ai/decide.js"), load("core/names.js")]);
  E = { ...core, ...terrain, ...ai, ...names };
});

// Regra antiga (antes de 20/11/2026), para provar que 2 e 3 impérios e os outros tamanhos de mapa não mudaram.
function oldStarts(n, count) {
  const pos = [0]; if (count > 1) pos.push(n - 1);
  while (pos.length < count) { let best = -1, bestD = -1; for (let i = 0; i < n; i++) { if (pos.includes(i)) continue; const d = Math.min(...pos.map((p) => E.gridDist(i, p))); if (d > bestD) { best = i; bestD = d; } } pos.push(best); }
  return pos;
}

test("posições iniciais: Arvela, Zênite, Esmera, Torva, Musgo, Ombral; 2–3 impérios iguais a antes; Pedral nunca", () => {
  const names = E.REGION_NAMES || ["Arvela", "Brumas", "Cardo", "Dorna", "Esmera", "Fenda", "Gralha", "Hélia", "Ivara", "Jaspe", "Lumen", "Musgo", "Névoa", "Ombral", "Pedral", "Quartzo", "Rochedo", "Salgar", "Torva", "Urzal", "Vau", "Velar", "Xisto", "Zênite"];
  assert.deepEqual([...E.START_ORDER_24], [0, 23, 4, 18, 11, 13]);
  assert.ok(Object.isFrozen(E.START_ORDER_24));
  assert.deepEqual(E.START_ORDER_24.map((i) => names[i]), ["Arvela", "Zênite", "Esmera", "Torva", "Musgo", "Ombral"]);
  for (let count = 1; count <= 6; count++) {
    const pos = E.startPositions(24, count);
    assert.deepEqual(pos, E.START_ORDER_24.slice(0, count), `${count} impérios`);
    assert.ok(!pos.includes(names.indexOf("Pedral")), "Pedral não devia ser região inicial");
    // Até 5 impérios, todas na borda do mapa 6×4 (Ombral, a 6.ª, fica a uma região da borda); ninguém colado.
    for (const p of pos.slice(0, 5)) assert.ok(p < 6 || p >= 18 || p % 6 === 0 || p % 6 === 5, `${names[p]} não está na borda`);
    for (const a of pos) for (const b of pos) if (a !== b) assert.ok(E.gridDist(a, b) >= 2, `${names[a]} e ${names[b]} colados`);
    if (count <= 3) assert.deepEqual(pos, oldStarts(24, count), "2 e 3 impérios deviam ficar como antes");
    // newState usa a mesma ordem: jogador em Arvela, rivais pela ordem.
    const c = E.clone(E.DEFAULTS); c.map.aiCount = Math.max(1, count - 1);
    if (count >= 2) { const s = E.newState(c); assert.deepEqual(s.civs.map((cv) => s.owners.indexOf(cv.id)), E.START_ORDER_24.slice(0, count)); }
  }
  // A lista devolvida é uma cópia (mexer nela não muda a tabela).
  const p = E.startPositions(24, 4); p[0] = 9; assert.equal(E.startPositions(24, 4)[0], 0);
  // Outros tamanhos de mapa (laboratórios) seguem a regra de sempre.
  for (const n of [12, 18, 30]) for (let count = 2; count <= 6; count++) assert.deepEqual(E.startPositions(n, count), oldStarts(n, count), `n=${n}, ${count} impérios`);
  // Posição inicial aleatória: continua a regra do mais afastado com sorteio (não usa a tabela).
  let x = 7; const rng = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
  const r = E.startPositions(24, 4, rng); assert.equal(new Set(r).size, 4);
});

// Cenário: rival "ai" em Zênite (23) com muito poder; ao lado tem uma região livre (17) e uma do jogador (22),
// que lidera em regiões. Só muda o número de impérios e os terrenos.
function leaderScene({ effects, civs }) {
  const c = E.clone(E.DEFAULTS); c.map.aiCount = civs - 1; c.military.aiTarget = "leader"; c.military.aiAggression = 100;
  const s = E.newState(c, { endRules: true, profiles: [null, ...Array(civs - 1).fill("reference")] });
  s.owners = s.owners.map((o) => (o === "player" ? "neutral" : o));
  for (const i of [0, 1, 2, 22]) s.owners[i] = "player";
  s.terrain = { type: "padrao", seed: null, list: Array(24).fill("campina") };
  if (effects) E.enableTerrainEffects(s);
  const ai = s.civs.find((cv) => cv.id === "ai"); ai.military = 500; s.era = 3;
  E.aiDecide(s, ai, c, 3);
  return { s, first: (s.orders || []).find((o) => o.owner === "ai")?.idx };
}

test("Difícil/Lendário com 2+ rivais no Só visual: regiões livres primeiro; no 1×1 e com efeitos, contra quem lidera", () => {
  // Regra pura.
  const st = (civs, effects, activeOff = 0) => { const c = E.clone(E.DEFAULTS); c.map.aiCount = civs - 1; const s = E.newState(c); if (effects) E.enableTerrainEffects(s); for (let k = 0; k < activeOff; k++) s.civs[civs - 1 - k].active = false; return s; };
  assert.equal(E.leaderTargetMode(st(2, false), "leader"), "leader", "1×1 Só visual");
  assert.equal(E.leaderTargetMode(st(3, false), "leader"), "neutralFirst", "2 rivais Só visual");
  assert.equal(E.leaderTargetMode(st(6, false), "leader"), "neutralFirst", "5 rivais Só visual");
  assert.equal(E.leaderTargetMode(st(3, true), "leader"), "leader", "2 rivais com efeitos");
  assert.equal(E.leaderTargetMode(st(4, false, 2), "leader"), "leader", "só 2 impérios ainda em jogo: volta a coligação");
  for (const p of ["neutralFirst", "cheapest", "playerFirst"]) assert.equal(E.leaderTargetMode(st(4, false), p), p, "outros alvos não mudam");
  // Na decisão da IA.
  assert.equal(leaderScene({ effects: false, civs: 3 }).first, 17, "Só visual, 2 rivais: devia ir à região livre");
  assert.equal(leaderScene({ effects: false, civs: 2 }).first, 22, "Só visual, 1×1: devia atacar o líder (jogador)");
  assert.equal(leaderScene({ effects: true, civs: 3 }).first, 22, "Com efeitos, 2 rivais: devia atacar o líder (jogador)");
});

test("receita dos rivais: Difícil 1,03; Médio 1,00 (com efeitos 1,03 só com state.aiIncomeEffects); carimbo 1×1/2+ separado", () => {
  const base = E.DEFAULTS.economy.baseIncome;
  const run = ({ diff, ai, effects, stamp }) => {
    const c = E.clone(E.DEFAULTS), d = E.DIFFICULTIES[diff]; c.map.aiCount = ai;
    c.economy.aiIncomeMultiplier = d.aiIncomeMultiplier; c.economy.aiIncomeMultiplier1v1 = d.aiIncomeMultiplier1v1 ?? -1;
    const s = E.newState(c); s.terrain = { type: "padrao", seed: null, list: Array(24).fill("floresta") };
    if (effects) E.enableTerrainEffects(s);
    if (stamp) s.aiIncomeEffects = stamp;
    E.beginEra(s, c);
    const pl = s.pending.revenue.player.total;
    return s.civs.slice(1).map((cv) => s.pending.revenue[cv.id].total / pl);
  };
  const near = (arr, m, msg) => arr.forEach((v) => assert.ok(Math.abs(v - m) < 1e-9, `${msg}: ${v} ≠ ${m}`));
  // Rodada 4 (20/11/2026): Difícil 1,05 → 1,03 com 2+ rivais; Médio 1,03 → 1,00 com 2+ rivais (com efeitos 1,06 → 1,03).
  assert.deepEqual(E.DIFFICULTIES.dificil.aiIncomeMultiplier, 1.03);
  assert.deepEqual(E.DIFFICULTIES.dificil.aiIncomeMultiplier1v1, 1.03);
  assert.deepEqual(E.DIFFICULTIES.medio.aiIncomeMultiplier, 1);
  assert.deepEqual(E.DIFFICULTIES.medio.effectsIncome, { aiIncomeMultiplier: 1.03, aiIncomeMultiplier1v1: 1.03 });
  for (const k of ["muitofacil", "facil", "dificil", "hardcore"]) assert.equal(E.DIFFICULTIES[k].effectsIncome, undefined, k + " não tem receita própria com efeitos");
  const fx = E.DIFFICULTIES.medio.effectsIncome;
  near(run({ diff: "dificil", ai: 1, effects: false }), 1.03, "Difícil 1×1");
  near(run({ diff: "dificil", ai: 3, effects: false }), 1.03, "Difícil 3 rivais");
  near(run({ diff: "dificil", ai: 3, effects: true }), 1.03, "Difícil 3 rivais com efeitos");
  near(run({ diff: "medio", ai: 1, effects: false, stamp: fx }), 1, "Médio 1×1 Só visual (o carimbo é ignorado sem efeitos)");
  near(run({ diff: "medio", ai: 3, effects: false, stamp: fx }), 1, "Médio 3 rivais Só visual");
  near(run({ diff: "medio", ai: 1, effects: true, stamp: fx }), 1.03, "Médio 1×1 com efeitos");
  near(run({ diff: "medio", ai: 3, effects: true, stamp: fx }), 1.03, "Médio 3 rivais com efeitos");
  near(run({ diff: "medio", ai: 3, effects: true }), 1, "save com efeitos sem o carimbo: valores da configuração");
  // O carimbo continua a separar 1×1 e 2+ rivais (ex.: o valor gravado por saves de antes da rodada 4: 1,06/1,03).
  const old = { aiIncomeMultiplier: 1.06, aiIncomeMultiplier1v1: 1.03 };
  near(run({ diff: "medio", ai: 1, effects: true, stamp: old }), 1.03, "save antigo, Médio 1×1 com efeitos");
  near(run({ diff: "medio", ai: 3, effects: true, stamp: old }), 1.06, "save antigo, Médio 3 rivais com efeitos");
  // Valores estranhos no save: ignorados.
  for (const bad of [{ aiIncomeMultiplier: "x" }, { aiIncomeMultiplier: 99 }, { aiIncomeMultiplier: 1.06, aiIncomeMultiplier1v1: -3 }, [], null])
    near(run({ diff: "medio", ai: 3, effects: true, stamp: bad }), 1, "carimbo inválido " + JSON.stringify(bad));
  // Laboratórios (todas IA): nenhum multiplicador.
  const c = E.clone(E.DEFAULTS); c.map.aiCount = 2; const s = E.newState(c, { allAI: true }); E.enableTerrainEffects(s); s.aiIncomeEffects = fx; E.beginEra(s, c);
  for (const cv of s.civs) assert.ok(Math.abs(s.pending.revenue[cv.id].total - base * 1.2) < 1e-9, "laboratório com multiplicador");
});

test("mapa padrão novo: mesmas quantidades de cada terreno e as 3 Montanhas já não ficam todas do lado de Zênite", () => {
  const counts = {}; for (const t of E.DEFAULT_TERRAIN) counts[t] = (counts[t] || 0) + 1;
  assert.deepEqual(counts, { campina: 7, pantano: 3, colinas: 3, tundra: 2, floresta: 4, deserto: 2, montanha: 3 });
  const mountains = E.DEFAULT_TERRAIN.map((t, i) => (t === "montanha" ? i : -1)).filter((i) => i >= 0);
  assert.ok(mountains.some((i) => i < 12) && mountains.some((i) => i >= 12), "Montanhas dos dois lados: " + mountains);
});

test("pela interface: Médio com efeitos dá +3% aos rivais (1,03 no 1×1 e com 3) e fica no save; Só visual e Difícil não", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const start = async ({ diff, ai, effects }) => {
    if (await page.locator("#homeScreen").isHidden()) await page.evaluate(() => { document.getElementById("homeScreen").hidden = false; });
    await page.locator("#homeStart").click();
    await page.locator(`#homeDifficulty [data-diff="${diff}"]`).click();
    await page.locator(`#homeOpponents [data-ai="${ai}"]`).click();
    await openCustomize(page);
    await page.locator(effects ? "#terrEffects" : "#terrVisual").click();
    await page.locator("#setupStart").click();
    const confirm = page.locator('#modalRoot button:has-text("Nova partida")');
    if (await confirm.count()) await confirm.click();
    await page.waitForFunction((n) => document.getElementById("homeScreen").hidden && state.era === 1 && state.civs.length === n + 1, ai);
    return page.evaluate(() => {
      const pl = state.pending.revenue.player.total;
      const saved = parseSavedGame(serializeGame());
      return { stamp: state.aiIncomeEffects ?? null, ratios: state.civs.slice(1).map((c) => state.pending.revenue[c.id].total / pl), savedStamp: saved.status === "ok" ? saved.game.state.aiIncomeEffects ?? null : "erro" };
    });
  };
  const near = (arr, m, msg) => arr.forEach((v) => assert.ok(Math.abs(v - m) < 1e-9, `${msg}: ${v} ≠ ${m}`));
  const fx1 = await start({ diff: "medio", ai: 1, effects: true });
  assert.deepEqual(fx1.stamp, { aiIncomeMultiplier: 1.03, aiIncomeMultiplier1v1: 1.03 });
  assert.deepEqual(fx1.savedStamp, fx1.stamp, "o save devia guardar os multiplicadores da partida");
  near(fx1.ratios, 1.03, "Médio 1×1 com efeitos");
  near((await start({ diff: "medio", ai: 3, effects: true })).ratios, 1.03, "Médio 3 rivais com efeitos");
  const vis = await start({ diff: "medio", ai: 3, effects: false });
  assert.equal(vis.stamp, null); near(vis.ratios, 1, "Médio 3 rivais Só visual");
  const dif = await start({ diff: "dificil", ai: 3, effects: true });
  assert.equal(dif.stamp, null); near(dif.ratios, 1.03, "Difícil 3 rivais com efeitos");
  near((await start({ diff: "dificil", ai: 1, effects: false })).ratios, 1.03, "Difícil 1×1");
  assert.deepEqual(errors, []);
  await context.close();
});

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());
