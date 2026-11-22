// Grande Descoberta (vitória por Ciência, mapas 2×–4×) e o saque de Ciência reduzido nos mapas maiores.
// Corre no Node, sem navegador.
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

test("ativa nos mapas 2×–4× com meta e mínimo proporcionais; no Original só se ligada", async () => {
  const C = await core();
  assert.equal("greatDiscovery" in C.newState(C.clone(C.DEFAULTS)), false, "Original sem o campo (jogo de sempre)");
  assert.equal(C.DEFAULTS.endgame.greatDiscovery, false);
  const exp = { 2: [12000, 10], 3: [17500, 15], 4: [24000, 20] };
  for (const [k, [goal, min]] of Object.entries(exp)) {
    const s = C.newState(cfgOf(C, Number(k)));
    assert.deepEqual(s.greatDiscovery, { goal, minRegions: min, perGold: 0.2 });
    assert.equal(C.greatDiscoveryActive(s), true); assert.equal(C.greatDiscoveryGoal(s), goal); assert.equal(C.greatDiscoveryMinRegions(s), min);
  }
  const o = C.newState(cfgOf(C, 1, 1, { greatDiscovery: true }));
  assert.deepEqual(o.greatDiscovery, { goal: 6000, minRegions: 5, perGold: 0.2 });
  assert.equal(C.greatDiscoveryActive({}), false); assert.deepEqual(C.greatDiscoveryProgress({ civs: [] }), []);
});

test("vitória: pontos próprios ≥ meta e regiões ≥ mínimo; abaixo do mínimo não vence; o saque não conta", async () => {
  const C = await core();
  const c = cfgOf(C, 2), s = C.newState(c, { endRules: true }), g = s.greatDiscovery, P = s.civs[0];
  give(s, "player", g.minRegions - 2);   // 1 inicial + (min−2) = min−1 regiões
  P.invested.technology = g.goal / g.perGold;
  C.processEra(s, c, { playerAllocation: { military: 0, infrastructure: 0, technology: 0 } });
  assert.equal(s.result, null, "com menos regiões que o mínimo não vence");
  const pr = C.greatDiscoveryProgress(s).find((x) => x.id === "player");
  assert.equal(pr.reached, false); assert.equal(pr.share, 1); assert.equal(pr.regionsOk, false);
  give(s, "player", 1);
  C.processEra(s, c, { playerAllocation: { military: 0, infrastructure: 0, technology: 0 } });
  assert.equal(s.result?.type, "victory"); assert.deepEqual(s.result.winners, ["player"]);
  assert.ok(s.result.reasons.player.includes("discovery"));
  assert.match(C.describeResult(s, s.result), /Grande Descoberta/);
  // Progresso saqueado (techProgress) não muda os pontos da Grande Descoberta.
  const s2 = C.newState(c); s2.civs[0].techProgress = 1e9;
  assert.equal(C.discoveryPoints(s2, s2.civs[0]), 0);
});

test("IA reage: rival acima de 50% da meta com mais pontos → +20 Militar e ataque a ele primeiro", async () => {
  const C = await core(), D = await load("ai/decide.js");
  const c = cfgOf(C, 2, 1); c.military.aiAggression = 0;
  const s = C.newState(c), g = s.greatDiscovery, ai = s.civs[1];
  assert.equal(D.discoveryThreat(s, ai, c), null);
  s.civs[0].invested.technology = 0.5 * g.goal / g.perGold;
  assert.equal(D.discoveryThreat(s, ai, c), "player");
  // Encosta o jogador na IA: com agressividade 0, a IA ataca mesmo assim, e mira o jogador.
  const n = s.owners.length, aiPos = s.owners.indexOf("ai"), nb = C.neighbors(aiPos, n);
  s.owners[nb[0]] = "player"; ai.military = 500; ai.treasury = 100;
  C.beginEra(s, c);
  const d = D.aiDecide(s, ai, c, s.era);
  const w = d.investment, sum = w.military + w.infrastructure + w.technology;
  const base = ai.profile ? null : [55, 30, 15];
  assert.ok(w.military / sum > (base ? base[0] : 50) / 100, "reforço do Militar");
  const ord = (s.orders || []).filter((o) => o.owner === "ai");
  assert.ok(ord.length >= 1 && ord[0].target === "player", "primeira ordem contra o líder da corrida");
  // Uma IA perto da meta mas com poucas regiões também reforça o Militar.
  const s3 = C.newState(c); s3.civs[1].invested.technology = 0.6 * g.goal / g.perGold;
  assert.equal(D.discoveryNeedsRegions(s3, s3.civs[1], c), true);
});

test("saque de Ciência ÷ k^0,25 nos mapas maiores; Obras e Original iguais", async () => {
  const C = await core();
  for (const size of [1, 4]) {
    const c = cfgOf(C, size), s = C.newState(c);
    give(s, "ai", 9);   // 10 regiões: f = min(20%, 3/10) = 20%
    const t = C.makeInvestment("technology", 1000, 0, c, "ai"); t.id = s.nextInvestmentId++; s.investments.push(t);
    const i = C.makeInvestment("infrastructure", 1000, 0, c, "ai"); i.id = s.nextInvestmentId++; s.investments.push(i);
    s.era = 1;
    const loot = C.pillage(s, "ai", "player", c);
    const k = size > 1 ? s.owners.length / 24 : 1, fT = 0.2 / Math.pow(k, c.military.techPillageMapExponent);
    assert.ok(Math.abs(loot.infra - 200) < 1e-9, "Obras: 20%");
    assert.ok(Math.abs(loot.tech - 1000 * 0.2 * (size > 1 ? fT : 0.2)) < 1e-9, `Ciência, tamanho ${size}`);
  }
});

test("save/load mantém a Grande Descoberta; save antigo de mapa maior sem o campo fica sem ela", async () => {
  const C = await core(), S = await load("app/save.js");
  const c = cfgOf(C, 3, 3), s = C.newState(c, { endRules: true });
  for (let e = 0; e < 3; e++) C.processEra(s, c, {});
  const raw = (st) => JSON.stringify({ v: 1, savedAt: 1, gameMode: "slow", config: c, state: st, opponentChoices: null, difficulty: "medio" });
  const r = S.parseSavedGame(raw(JSON.parse(JSON.stringify(s))));
  assert.equal(r.status, "ok"); assert.deepEqual(r.game.state.greatDiscovery, s.greatDiscovery);
  const old = JSON.parse(JSON.stringify(s)); delete old.greatDiscovery;
  const r2 = S.parseSavedGame(raw(old));
  assert.equal(r2.status, "ok"); assert.equal(C.greatDiscoveryActive(r2.game.state), false);
  C.processEra(r2.game.state, r2.game.config, {});
});

test("partidas só de IAs nos mapas maiores: terminam bem antes do teto e a Grande Descoberta aparece sem dominar", async () => {
  const C = await core();
  const profs = ["reference", "military", "aggressive", "technologist", "economist", "adaptive"];
  const types = {}; let n = 0;
  for (const size of [2, 3, 4]) for (let g = 0; g < 6; g++) {
    const c = cfgOf(C, size, 3); const cap = C.unlimitedMaxEras(size); c.endgame.maxEras = 150;
    const m = C.runMatch(c, { mode: "slow", profiles: profs, civCount: 4, seed: C.fixedGameSeed(C.SEED, 50 + g), game: g, maxEras: cap });
    assert.ok(m.result && m.result.era < cap - 40, `tamanho ${size}: terminou na era ${m.result?.era} (teto ${cap})`);
    for (const r of Object.values(m.result.reasons)) for (const x of r) types[x] = (types[x] || 0) + 1;
    n++;
  }
  assert.ok((types.discovery || 0) > 0, "nenhuma Grande Descoberta em 18 partidas");
  assert.ok((types.discovery || 0) < n, "só Grandes Descobertas");
});
