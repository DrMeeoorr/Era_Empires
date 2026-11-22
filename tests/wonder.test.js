// Maravilha da Humanidade (vitória por Obras, mapas 2×–4×). Corre no Node, sem navegador.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const SRC = path.resolve(__dirname, "..", "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const core = () => load("core/index.js");
function cfgOf(C, size, ai = 1, eg = {}) {
  const c = C.clone(C.DEFAULTS); c.map.mapSize = size; c.map.aiCount = ai; Object.assign(c.endgame, eg);
  c.military.aiEnabled = true; return C.normalizeConfig(c);
}
const give = (s, id, n) => { let k = 0; for (let i = 0; i < s.owners.length && k < n; i++) if (s.owners[i] === "neutral") { s.owners[i] = id; k++; } };
const ZERO = { military: 0, infrastructure: 0, technology: 0 };

test("ativa nos mapas 2×–4× com meta 3000×k e mínimo ⌈4k⌉; no Original só se ligada", async () => {
  const C = await core();
  assert.equal("wonder" in C.newState(C.clone(C.DEFAULTS)), false, "Original sem o campo (jogo de sempre)");
  assert.equal(C.DEFAULTS.endgame.wonder, false);
  const exp = { 2: [6000, 8], 3: [8750, 12], 4: [12000, 16] };
  for (const [k, [goal, min]] of Object.entries(exp)) {
    const s = C.newState(cfgOf(C, Number(k)));
    assert.deepEqual(s.wonder, { goal, minRegions: min, perGold: 0.2 });
    assert.equal(C.wonderActive(s), true); assert.equal(C.wonderGoal(s), goal); assert.equal(C.wonderMinRegions(s), min);
  }
  assert.deepEqual(C.newState(cfgOf(C, 1, 1, { wonder: true })).wonder, { goal: 3000, minRegions: 4, perGold: 0.2 });
  assert.equal(C.wonderActive({}), false); assert.deepEqual(C.wonderProgress({ civs: [] }), []);
  assert.equal(C.END_REASON_NAMES.wonder, "Maravilha da Humanidade");
});

test("pontos: só o ouro em Obras das eras em que Obras foi a maior fatia (empate não conta)", async () => {
  const C = await core();
  const c = cfgOf(C, 2); c.military.aiEnabled = false;
  const s = C.newState(c), P = s.civs[0];
  const era = (a) => { P.treasury = 1000; C.processEra(s, c, { playerAllocation: a }); };
  C.processEra(s, c, { playerAllocation: ZERO });   // era 1 (antes da era 1 a alocação é "inicial", da era 0)
  era({ military: 10, infrastructure: 50, technology: 20 });   // conta 50
  assert.equal(P.wonderInvested, 50);
  era({ military: 40, infrastructure: 30, technology: 10 });   // Força maior: não conta
  era({ military: 30, infrastructure: 30, technology: 0 });    // empate: não conta
  era({ military: 0, infrastructure: 20, technology: 25 });    // Ciência maior: não conta
  era({ military: 0, infrastructure: 5, technology: 0 });      // conta 5
  assert.equal(P.wonderInvested, 55);
  assert.ok(Math.abs(C.wonderPoints(s, P) - 55 * 0.2) < 1e-12);
  assert.equal(P.wonderEra, undefined, "o registo da era é temporário");
  // Original: nada é registado (o estado fica igual ao de sempre).
  const c1 = C.clone(C.DEFAULTS); c1.military.aiEnabled = false; const s1 = C.newState(c1);
  C.processEra(s1, c1, { playerAllocation: ZERO });
  C.processEra(s1, c1, { playerAllocation: { military: 0, infrastructure: 50, technology: 0 } });
  assert.equal(s1.civs[0].wonderInvested, undefined); assert.equal(C.wonderPoints(s1, s1.civs[0]), 0);
});

test("o saque de Obras não dá pontos de Maravilha a quem conquista", async () => {
  const C = await core();
  const c = cfgOf(C, 2), s = C.newState(c);
  give(s, "ai", 4);
  const i = C.makeInvestment("infrastructure", 5000, 0, c, "ai"); i.id = s.nextInvestmentId++; s.investments.push(i);
  s.civs[1].wonderInvested = 5000; s.era = 1;
  const loot = C.pillage(s, "ai", "player", c);
  assert.ok(loot.infra > 0);
  assert.equal(C.wonderPoints(s, s.civs[0]), 0);
  assert.equal(C.wonderPoints(s, s.civs[1]), 1000, "quem perde a região mantém os pontos");
});

test("vitória: pontos ≥ meta e regiões ≥ mínimo; abaixo do mínimo não vence", async () => {
  const C = await core();
  const c = cfgOf(C, 2), s = C.newState(c, { endRules: true }), w = s.wonder, P = s.civs[0];
  give(s, "player", w.minRegions - 2);
  P.wonderInvested = w.goal / w.perGold;
  C.processEra(s, c, { playerAllocation: ZERO });
  assert.equal(s.result, null);
  const pr = C.wonderProgress(s).find((x) => x.id === "player");
  assert.equal(pr.share, 1); assert.equal(pr.regionsOk, false); assert.equal(pr.reached, false);
  give(s, "player", 1);
  C.processEra(s, c, { playerAllocation: ZERO });
  assert.equal(s.result?.type, "victory"); assert.deepEqual(s.result.winners, ["player"]);
  assert.ok(s.result.reasons.player.includes("wonder"));
  assert.match(C.describeResult(s, s.result), /Maravilha da Humanidade/);
});

test("na mesma era: Maravilha e Grande Descoberta do mesmo império somam motivos; de impérios diferentes = empate", async () => {
  const C = await core();
  const c = cfgOf(C, 2);
  const s = C.newState(c, { endRules: true }), P = s.civs[0];
  give(s, "player", Math.max(s.wonder.minRegions, s.greatDiscovery.minRegions));
  P.wonderInvested = s.wonder.goal / s.wonder.perGold; P.invested.technology = s.greatDiscovery.goal / s.greatDiscovery.perGold;
  C.processEra(s, c, { playerAllocation: ZERO });
  assert.equal(s.result?.type, "victory");
  assert.ok(s.result.reasons.player.includes("wonder") && s.result.reasons.player.includes("discovery"));
  const s2 = C.newState(c, { endRules: true });
  give(s2, "player", s2.wonder.minRegions); give(s2, "ai", s2.greatDiscovery.minRegions);
  s2.civs[0].wonderInvested = s2.wonder.goal / s2.wonder.perGold;
  s2.civs[1].invested.technology = s2.greatDiscovery.goal / s2.greatDiscovery.perGold;
  C.processEra(s2, c, { playerAllocation: ZERO });
  assert.equal(s2.result?.type, "draw");
  assert.deepEqual([...s2.result.winners].sort(), ["ai", "player"]);
  assert.ok(s2.result.reasons.player.includes("wonder")); assert.ok(s2.result.reasons.ai.includes("discovery"));
});

test("IA reage: rival acima de 50% da meta com mais pontos → +Militar e ataque a ele primeiro", async () => {
  const C = await core(), D = await load("ai/decide.js");
  const c = cfgOf(C, 2, 1); c.military.aiAggression = 0;
  const s = C.newState(c), w = s.wonder, ai = s.civs[1];
  assert.equal(D.wonderThreat(s, ai, c), null);
  s.civs[0].wonderInvested = 0.5 * w.goal / w.perGold;
  assert.equal(D.wonderThreat(s, ai, c), "player");
  const n = s.owners.length, nb = C.neighbors(s.owners.indexOf("ai"), n);
  s.owners[nb[0]] = "player"; ai.military = 500; ai.treasury = 100;
  C.beginEra(s, c);
  const d = D.aiDecide(s, ai, c, s.era), v = d.investment, sum = v.military + v.infrastructure + v.technology;
  assert.ok(v.military / sum > 0.55, "reforço do Militar");
  const ord = (s.orders || []).filter((o) => o.owner === "ai");
  assert.ok(ord.length >= 1 && ord[0].target === "player", "primeira ordem contra o líder da Maravilha");
  const s3 = C.newState(c); s3.civs[1].wonderInvested = 0.6 * w.goal / w.perGold;
  assert.equal(D.wonderNeedsRegions(s3, s3.civs[1], c), true);
});

test("save/load mantém a Maravilha e os pontos; save antigo de mapa maior sem o campo fica sem ela", async () => {
  const C = await core(), S = await load("app/save.js");
  const c = cfgOf(C, 3, 3), s = C.newState(c, { endRules: true });
  for (let e = 0; e < 4; e++) C.processEra(s, c, {});
  s.civs[0].wonderInvested = 123;
  const raw = (st) => JSON.stringify({ v: 1, savedAt: 1, gameMode: "slow", config: c, state: st, opponentChoices: null, difficulty: "medio" });
  const r = S.parseSavedGame(raw(JSON.parse(JSON.stringify(s))));
  assert.equal(r.status, "ok"); assert.deepEqual(r.game.state.wonder, s.wonder);
  assert.equal(C.wonderPoints(r.game.state, r.game.state.civs[0]), 123 * 0.2);
  const old = JSON.parse(JSON.stringify(s)); delete old.wonder;
  const r2 = S.parseSavedGame(raw(old));
  assert.equal(r2.status, "ok"); assert.equal(C.wonderActive(r2.game.state), false);
  C.processEra(r2.game.state, r2.game.config, {});
  assert.equal(r2.game.state.civs.some((cv) => cv.wonderEra), false);
});

test("partidas só de IAs nos mapas maiores: há vitórias pela Maravilha, sem dominar, e terminam antes do teto", async () => {
  const C = await core();
  const profs = ["reference", "military", "aggressive", "technologist", "economist", "adaptive"];
  const types = {}; let n = 0;
  for (const size of [2, 3, 4]) for (let g = 0; g < 8; g++) {
    const c = cfgOf(C, size, 5), cap = C.unlimitedMaxEras(size); c.endgame.maxEras = 150;
    const m = C.runMatch(c, { mode: "slow", profiles: profs, civCount: 6, seed: C.fixedGameSeed(C.SEED, 90 + g), game: g, maxEras: cap });
    assert.ok(m.result && m.result.era < cap - 40, `tamanho ${size}: terminou na era ${m.result?.era}`);
    for (const r of Object.values(m.result.reasons)) for (const x of r) types[x] = (types[x] || 0) + 1;
    n++;
  }
  assert.ok((types.wonder || 0) > 0, "nenhuma Maravilha em 24 partidas: " + JSON.stringify(types));
  assert.ok((types.wonder || 0) < n / 2, "a Maravilha decidiu metade ou mais: " + JSON.stringify(types));
});
