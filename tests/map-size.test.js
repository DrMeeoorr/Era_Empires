// Tamanho do mapa (config.map.mapSize 1–4): grades, vizinhança, posições, terrenos, nomes, regras escaladas,
// save/load e partidas completas sem limite de eras. Corre no Node, sem navegador (~10 s).
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const SRC = path.resolve(__dirname, "..", "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const GRIDS = { 1: [6, 4], 2: [8, 6], 3: [10, 7], 4: [12, 8] };

async function core() { return load("core/index.js"); }
function cfgOf(C, size, ai = 1, over = {}) {
  const c = C.clone(C.DEFAULTS); c.map.mapSize = size; c.map.aiCount = ai; Object.assign(c.map, over);
  return C.normalizeConfig(c);
}

test("mapSize: padrão 1, só aceita 1–4 e configurações antigas sem o campo ficam com 1", async () => {
  const C = await core();
  assert.equal(C.DEFAULTS.map.mapSize, 1);
  const old = C.clone(C.DEFAULTS); delete old.map.mapSize;
  assert.equal(C.normalizeConfig(old).map.mapSize, 1);
  for (const bad of [0, 5, 2.5, -1]) assert.throws(() => cfgOf(C, bad), /mapa|Valor inválido/, `mapSize ${bad} devia ser recusado`);
  for (const k of [1, 2, 3, 4]) assert.equal(cfgOf(C, k).map.mapSize, k);
});

test("grades: 6×4, 8×6, 10×7 e 12×8, com colunas e linhas certas", async () => {
  const C = await core();
  for (const [k, [cols, rows]] of Object.entries(GRIDS)) {
    const s = C.newState(cfgOf(C, Number(k)));
    assert.equal(s.owners.length, cols * rows, `tamanho ${k}`);
    assert.equal(C.mapColsFor(cols * rows), cols);
    assert.equal(C.mapRowsFor(cols * rows), rows);
    assert.equal(s.mapSize, Number(k) > 1 ? Number(k) : undefined, "o mapa de sempre não ganha o campo mapSize");
  }
  // Os laboratórios continuam a poder usar 4–30 regiões na grade de 6 colunas.
  for (const n of [4, 10, 23, 25, 30]) assert.equal(C.mapColsFor(n), 6);
});

test("mapSize 1 cria exatamente o mesmo estado de sempre", async () => {
  const C = await core();
  const a = C.newState(C.clone(C.DEFAULTS)), d = C.clone(C.DEFAULTS); delete d.map.mapSize;
  const b = C.newState(C.normalizeConfig(d));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal("mapSize" in a, false);
});

test("vizinhança: simétrica, só ortogonal, sem atravessar a borda; todas as regiões ligadas", async () => {
  const C = await core();
  for (const [cols, rows] of Object.values(GRIDS)) {
    const n = cols * rows;
    for (let i = 0; i < n; i++) {
      const nb = C.neighbors(i, n), r = Math.floor(i / cols), c = i % cols;
      const exp = (r > 0) + (r < rows - 1) + (c > 0) + (c < cols - 1);
      assert.equal(nb.length, exp, `n=${n} região ${i}`);
      for (const j of nb) {
        assert.ok(C.neighbors(j, n).includes(i), `n=${n}: ${i}→${j} não é simétrico`);
        assert.equal(C.gridDist(i, j, cols), 1, `n=${n}: ${i} e ${j} não são contíguos`);
      }
    }
    const seen = new Set([0]), q = [0];
    while (q.length) for (const j of C.neighbors(q.shift(), n)) if (!seen.has(j)) { seen.add(j); q.push(j); }
    assert.equal(seen.size, n, `mapa ${cols}×${rows} desligado`);
  }
});

test("posições iniciais: distintas, dentro do mapa, afastadas; o 1×1 em cantos opostos", async () => {
  const C = await core();
  for (const [k, [cols, rows]] of Object.entries(GRIDS)) {
    if (k === "1") continue;
    const n = cols * rows;
    for (let ai = 1; ai <= C.MAX_AI; ai++) {
      for (const random of [false, true]) {
        const s = C.newState(cfgOf(C, Number(k), ai, { randomStart: random }), { startSeed: 1234 + ai });
        const pos = s.owners.map((o, i) => (o === "neutral" ? -1 : i)).filter((i) => i >= 0);
        assert.equal(pos.length, ai + 1);
        for (const a of pos) for (const b of pos) if (a !== b) assert.ok(C.gridDist(a, b, cols) >= 2, `tamanho ${k}, ${ai} rivais: ${a} e ${b} perto demais`);
      }
    }
    const s = C.newState(cfgOf(C, Number(k), 1));
    assert.equal(s.owners[0], "player"); assert.equal(s.owners[n - 1], "ai");
  }
});

test("terrenos: mapa padrão em mosaico do original e sorteado válido em todos os tamanhos", async () => {
  const C = { ...(await core()), ...(await load("core/terrain.js")) };
  assert.deepEqual(C.defaultTerrain(24), [...C.DEFAULT_TERRAIN]);
  for (const [cols, rows] of Object.values(GRIDS)) {
    const n = cols * rows, d = C.defaultTerrain(n);
    assert.equal(d.length, n);
    for (let i = 0; i < n; i++) assert.equal(d[i], C.DEFAULT_TERRAIN[(Math.floor(i / cols) % 4) * 6 + (i % cols) % 6]);
    for (const civs of [2, 4, 6]) {
      const starts = C.startPositions(n, civs);
      for (let seed = 0; seed < 30; seed++) {
        const r = C.rollTerrain(seed * 7919 + 1, starts, n);
        assert.ok(r.tries > 0, `n=${n}: sorteio caiu no mapa padrão`);
        assert.deepEqual(C.terrainProblems(r.list, starts), [], `n=${n}, semente ${seed}`);
      }
    }
  }
});

test("nomes: 96 regiões com nomes diferentes; os 24 de sempre nas mesmas posições", async () => {
  const N = await load("core/names.js");
  const all = Array.from({ length: 96 }, (_, i) => N.regionName(i));
  assert.equal(new Set(all).size, 96);
  assert.ok(all.every((x) => !/^Território/.test(x)));
  assert.deepEqual(all.slice(0, 24), N.REGION_NAMES);
});

test("regras escaladas: custo administrativo ÷ k e territórios ÷ k na pontuação; tamanho 1 sem mudança", async () => {
  const C = await core();
  for (const [k, [cols, rows]] of Object.entries(GRIDS)) {
    const c = cfgOf(C, Number(k)); c.military.aiEnabled = false;
    const s = C.newState(c), n = cols * rows, K = Number(k) > 1 ? n / 24 : 1;
    assert.equal(C.mapAreaFactor(s), K);
    let owned = 0; for (let i = 0; i < n && owned < 10; i++) if (s.owners[i] === "neutral") { s.owners[i] = "player"; owned++; }
    const terr = C.countTerritories(s, "player");
    C.processEra(s, c, { playerAllocation: { military: 0, infrastructure: 0, technology: 0 } });
    const per = c.economy.baseIncome - c.economy.adminCostPerTerritory / K * (terr - 1);
    assert.ok(Math.abs(s.timeline[0].civs[0].revenue.normal - terr * per) < 1e-9, `tamanho ${k}: receita das regiões`);
    assert.ok(Math.abs(s.timeline[0].civs[0].dims.territories - terr / K) < 1e-12, `tamanho ${k}: territórios na pontuação`);
    assert.equal(s.timeline[0].civs[0].territories, terr, "a contagem real de regiões não muda");
  }
});

test("save/load: tamanhos maiores voltam iguais; saves antigos (sem mapSize) abrem como tamanho 1; dados estranhos recusados", async () => {
  const C = await core(), S = await load("app/save.js");
  const raw = (cfg, state) => JSON.stringify({ v: 1, savedAt: 1, gameMode: "slow", config: cfg, state, opponentChoices: null, difficulty: "medio" });
  for (const k of [2, 3, 4]) {
    const c = cfgOf(C, k, 3), s = C.newState(c, { endRules: true });
    for (let e = 0; e < 5; e++) C.processEra(s, c, {});
    const r = S.parseSavedGame(raw(c, JSON.parse(JSON.stringify(s))));
    assert.equal(r.status, "ok", `tamanho ${k}: ${r.reason}`);
    assert.equal(r.game.state.mapSize, k); assert.equal(r.game.config.map.mapSize, k);
    assert.equal(r.game.state.owners.length, GRIDS[k][0] * GRIDS[k][1]);
    // Continua a jogar depois de carregado.
    C.processEra(r.game.state, r.game.config, {});
  }
  const old = C.clone(C.DEFAULTS); delete old.map.mapSize;
  const s1 = C.newState(C.normalizeConfig(old));
  const r1 = S.parseSavedGame(raw(old, s1));
  assert.equal(r1.status, "ok"); assert.equal(r1.game.config.map.mapSize, 1); assert.equal(C.mapSizeOf(r1.game.state), 1);
  const bad = (mut) => { const c = cfgOf(C, 2), s = JSON.parse(JSON.stringify(C.newState(c))); mut(s); return S.parseSavedGame(raw(c, s)).status; };
  assert.equal(bad((s) => { s.mapSize = 3; }), "invalid", "mapSize que não bate com o número de regiões");
  assert.equal(bad((s) => { s.mapSize = 9; }), "invalid", "mapSize desconhecido");
  assert.equal(bad((s) => { delete s.mapSize; }), "invalid", "48 regiões sem mapSize");
  assert.equal(bad((s) => { s.mapSize = 1; }), "invalid", "mapSize 1 com 48 regiões");
});

test("tutorial usa sempre o mapa de 24 e devolve o tamanho escolhido antes", async () => {
  const session = await load("app/session.js"), setup = await load("app/setup.js");
  session.applyDifficulty(session.currentDifficulty);
  session.configApplied.map.mapSize = 3;
  setup.newTutorialGame();
  assert.equal(session.state.owners.length, 24);
  assert.equal(session.configApplied.map.mapSize, 1);
  setup.restoreSetupAfterTutorial();
  assert.equal(session.configApplied.map.mapSize, 3);
  session.setState(session.newGame());
  assert.equal(session.state.owners.length, 70);
  assert.equal(session.state.mapSize, 3);
  session.configApplied.map.mapSize = 1;
});

test("partidas sem limite até o fim em todos os tamanhos (1 e 3 rivais, terrenos com efeito): terminam, sem números inválidos", async () => {
  const C = await core();
  const profs = ["reference", "military", "aggressive", "technologist", "economist", "adaptive"];
  for (const k of [1, 2, 3, 4]) for (const ai of [1, 3]) for (const effects of [false, true]) {
    const c = cfgOf(C, k, ai); c.endgame.maxEras = C.UNLIMITED.maxEras;
    const m = C.runMatch(c, { mode: "slow", profiles: profs, civCount: ai + 1, seed: C.fixedGameSeed(C.SEED, k * 10 + ai), game: k, maxEras: C.UNLIMITED.maxEras, terrain: { type: "sorteado", seed: 99 + k, effects } });
    const s = m.state;
    assert.ok(m.result, `tamanho ${k}, ${ai} rivais: partida não terminou`);
    assert.ok(m.result.era <= C.UNLIMITED.maxEras, `tamanho ${k}: passou do teto`);
    assert.equal(s.owners.length, GRIDS[k][0] * GRIDS[k][1]);
    for (const civ of s.civs) assert.ok([civ.treasury, civ.military].every(Number.isFinite), "valores inválidos");
    for (const e of s.timeline) for (const r of e.civs) assert.ok(Object.values(r.dims).every(Number.isFinite), "dimensões inválidas");
  }
});

test("Sem limite: teto de 100 eras no Original e +25 por tamanho acima; a partida nova usa o do tamanho", async () => {
  const E = await load("core/endgame.js"), session = await load("app/session.js");
  assert.deepEqual([1, 2, 3, 4].map((k) => E.unlimitedMaxEras(k)), [100, 125, 150, 175]);
  assert.equal(E.unlimitedMaxEras(), 100); assert.equal(E.unlimitedMaxEras(9), 100);
  assert.equal(E.UNLIMITED.maxEras, 100, "a constante do Original não muda");
  session.applyDifficulty(session.currentDifficulty);
  session.setUnlimitedChoice(true);
  for (const k of [1, 2, 3, 4]) {
    session.configApplied.map.mapSize = k;
    const s = session.newGame();
    assert.equal(s.maxEras, E.unlimitedMaxEras(k)); assert.equal(E.unlimitedMaxErasOf(s), E.unlimitedMaxEras(k));
  }
  session.setUnlimitedChoice(false); session.configApplied.map.mapSize = 1;
});

test("rivais recomendados por tamanho (só recomendação): 1, 2, 2, 3", async () => {
  const E = await load("core/endgame.js");
  assert.deepEqual([1, 2, 3, 4].map((k) => E.recommendedRivals(k)), [1, 2, 2, 3]);
  assert.equal(E.recommendedRivals(undefined), 1);
  // O jogador continua livre: 1 rival num mapa 4× é uma configuração válida.
  const C = await core();
  assert.equal(C.newState(cfgOf(C, 4, 1)).civs.length, 2);
});

test("ordens extra na mesma era: passo ÷k no 1×1 e ÷√k com 2+ rivais nos mapas maiores; Original igual", async () => {
  const C = await core();
  const step = C.DEFAULTS.military.extraOrderCostStep;
  for (const [k, [cols, rows]] of Object.entries(GRIDS)) {
    const K = (cols * rows) / 24;
    for (const ai of [1, 3]) {
      const c = cfgOf(C, Number(k), ai), s = C.newState(c);
      const exp = k === "1" ? step : step / (ai === 1 ? K : Math.sqrt(K));
      assert.ok(Math.abs(C.orderStep(c, s) - exp) < 1e-12, `tamanho ${k}, ${ai} rivais`);
      assert.ok(Math.abs(C.orderCostMultiplier(c, 2, s) - (1 + 2 * exp)) < 1e-12);
    }
  }
  assert.equal(C.orderCostMultiplier(C.DEFAULTS, 2), 1 + 2 * step, "sem estado: o passo da configuração");
  // A 2.ª ordem cobra o multiplicador escalado e cancelar a 1.ª recalcula com o mesmo passo.
  const c = cfgOf(C, 4, 1), s = C.newState(c), n = s.owners.length;
  const t = C.neighbors(0, n).filter((i) => s.owners[i] === "neutral");
  s.civs[0].military = 1000;
  const a = C.orderAttack(s, t[0], "player", c), b = C.orderAttack(s, t[1], "player", c);
  assert.ok(a.ok && b.ok);
  assert.ok(Math.abs(b.mult - (1 + C.orderStep(c, s))) < 1e-12, "multiplicador da 2.ª ordem");
  const before = s.civs[0].military; C.cancelOrder(s, "player", t[0]);
  const left = s.orders.filter((o) => o.owner === "player");
  assert.equal(left.length, 1); assert.equal(left[0].mult, 1);
  assert.ok(s.civs[0].military > before);
});

test("posições escolhidas com 4–6 impérios nos mapas maiores: perto da borda, distintas e afastadas", async () => {
  const C = await core();
  for (const [k, [cols, rows]] of Object.entries(GRIDS)) {
    if (k === "1") continue;
    const n = cols * rows;
    for (const civs of [4, 5, 6]) {
      const pos = C.startPositions(n, civs);
      assert.deepEqual(pos, C.START_ORDERS_BIG[n][civs]);
      assert.equal(new Set(pos).size, civs);
      for (const p of pos) {
        assert.ok(p >= 0 && p < n);
        const r = Math.floor(p / cols), c = p % cols, edge = Math.min(r, c, rows - 1 - r, cols - 1 - c);
        assert.ok(edge <= 1, `tamanho ${k}, ${civs} impérios: região ${p} longe da borda`);
      }
      const s = C.newState(cfgOf(C, Number(k), civs - 1));
      assert.deepEqual(s.civs.map((cv) => s.owners.indexOf(cv.id)), pos);
    }
    // 1–3 impérios: a regra de sempre (o mais afastado possível).
    assert.deepEqual(C.startPositions(n, 2), [0, n - 1]);
  }
  // Original: a ordem de sempre.
  assert.deepEqual(C.startPositions(24, 6), [...C.START_ORDER_24]);
});

test("laboratórios: tamanho do mapa no catálogo de parâmetros e sondas das IAs no mapa de 24", async () => {
  const S = await load("labs/settings.js"), session = await load("app/session.js"), A = await load("labs/ai-checks.js");
  const map = S.PARAM_GROUPS.find((g) => g[1] === "map")[2].map((p) => p[0]);
  assert.ok(map.includes("mapSize") && map.includes("territories"));
  session.configApplied.map.mapSize = 4;
  const r = A.aiProbe("military", true, 7);
  assert.ok(r.investment > 0 && Number.isFinite(r.military));
  session.configApplied.map.mapSize = 1;
});
