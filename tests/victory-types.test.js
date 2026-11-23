// Tipos de vitória escolhidos para a partida (config.endgame.victories). Corre no Node, sem navegador.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const SRC = path.resolve(__dirname, "..", "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const core = () => load("core/index.js");
const ALL = { dominion: true, supremacy: true, discovery: true, wonder: true };
function cfgOf(C, size = 1, ai = 1, victories = {}) {
  const c = C.clone(C.DEFAULTS); c.map.mapSize = size; c.map.aiCount = ai; c.endgame.victories = { ...ALL, ...victories };
  c.military.aiEnabled = true; return C.normalizeConfig(c);
}
const give = (s, id, n) => { let k = 0; for (let i = 0; i < s.owners.length && k < n; i++) if (s.owners[i] === "neutral") { s.owners[i] = id; k++; } };
const ZERO = { military: 0, infrastructure: 0, technology: 0 };

test("padrão: tudo ligado, o estado não ganha o campo; configurações antigas e parciais são completadas", async () => {
  const C = await core();
  assert.deepEqual(C.DEFAULTS.endgame.victories, ALL);
  assert.equal("victories" in C.newState(C.clone(C.DEFAULTS)), false);
  const old = C.clone(C.DEFAULTS); delete old.endgame.victories;
  assert.deepEqual(C.normalizeConfig(old).endgame.victories, ALL);
  const part = C.clone(C.DEFAULTS); part.endgame.victories = { wonder: false };
  assert.deepEqual(C.normalizeConfig(part).endgame.victories, { ...ALL, wonder: false });
  for (const bad of [null, [], "x", { dominion: 0 }, { outra: false }]) {
    const c = C.clone(C.DEFAULTS); c.endgame.victories = bad;
    assert.throws(() => C.normalizeConfig(c), /Tipos de vitória/, JSON.stringify(bad));
  }
  const s = C.newState(cfgOf(C, 2, 1, { supremacy: false }));
  assert.deepEqual(s.victories, { ...ALL, supremacy: false });
});

test("lista para a tela e vitórias ativas da partida", async () => {
  const C = await core();
  const one = C.victoryTypes(1), four = C.victoryTypes(4);
  assert.deepEqual(one.map((v) => v.id), ["dominion", "supremacy", "discovery", "wonder", "elimination", "score"]);
  assert.deepEqual(one.filter((v) => v.optional).map((v) => v.id), ["dominion", "supremacy", "discovery", "wonder"]);
  assert.deepEqual(one.filter((v) => !v.available).map((v) => v.id), ["discovery", "wonder"]);
  assert.ok(four.every((v) => v.available));
  assert.deepEqual(C.activeVictories(C.newState(cfgOf(C, 1))), ["dominion", "supremacy", "elimination", "score"]);
  assert.deepEqual(C.activeVictories(C.newState(cfgOf(C, 4))), ["dominion", "supremacy", "discovery", "wonder", "elimination", "score"]);
  const c = cfgOf(C, 4, 1, { dominion: false, wonder: false });
  assert.deepEqual(C.activeVictories(C.newState(c)), ["supremacy", "discovery", "elimination", "score"]);
  const cq = cfgOf(C, 1); cq.endgame.supremacyEnabled = false;
  assert.deepEqual(C.activeVictories(C.newState(cq), cq), ["dominion", "elimination", "score"], "modo Conquista");
});

test("domínio desligado: 70% das regiões não vence nem pergunta", async () => {
  const C = await core();
  for (const on of [true, false]) {
    const c = cfgOf(C, 1, 1, { dominion: on }); c.military.aiEnabled = false;
    const s = C.newState(c, { endRules: true }); s.dominion = { ask: null, declined: false, continued: false }; s.unlimited = true; s.maxEras = 100;
    give(s, "player", 17);
    C.processEra(s, c, { playerAllocation: ZERO });
    if (on) assert.ok(s.result?.reasons.player.includes("territorial"));
    else { assert.equal(s.result, null); assert.equal(s.dominion.ask, null); assert.deepEqual(s.timeline.at(-1).end.territorialWinners, []); }
  }
});

test("supremacia desligada: a avaliação fica 'off' em todas as eras", async () => {
  const C = await core();
  const c = cfgOf(C, 1, 3, { supremacy: false }); c.endgame.maxEras = 100;
  const m = C.runMatch(c, { mode: "slow", profiles: ["military", "economist", "technologist", "aggressive"], civCount: 4, seed: 5, game: 0, maxEras: 100 });
  assert.ok(m.state.timeline.every((e) => e.end.supremacy.status === "off"));
  assert.ok(!Object.values(m.result.reasons).flat().includes("supremacy"));
});

test("Grande Descoberta e Maravilha desligadas: não existem na partida, não vencem e as IAs não reagem", async () => {
  const C = await core(), D = await load("ai/decide.js");
  const c = cfgOf(C, 2, 1, { discovery: false, wonder: false });
  const s = C.newState(c, { endRules: true });
  assert.equal(s.greatDiscovery, undefined); assert.equal(s.wonder, undefined);
  assert.equal(C.greatDiscoveryActive(s), false); assert.equal(C.wonderActive(s), false);
  give(s, "player", 20);
  s.civs[0].invested.technology = 1e9; s.civs[0].wonderInvested = 1e9;
  assert.equal(D.discoveryThreat(s, s.civs[1], c), null); assert.equal(D.wonderThreat(s, s.civs[1], c), null);
  assert.equal(D.discoveryNeedsRegions(s, s.civs[0], c), false); assert.equal(D.wonderNeedsRegions(s, s.civs[0], c), false);
  C.processEra(s, c, { playerAllocation: ZERO });
  assert.ok(!s.result || !Object.values(s.result.reasons).flat().some((r) => r === "discovery" || r === "wonder"));
  // Só uma delas desligada: a outra continua.
  const s2 = C.newState(cfgOf(C, 2, 1, { discovery: false }));
  assert.equal(s2.greatDiscovery, undefined); assert.ok(s2.wonder);
});

test("tudo desligado, Sem limite (Original e 4×): termina por eliminação ou pontos no teto", async () => {
  const C = await core();
  const profs = ["reference", "military", "aggressive", "technologist", "economist", "adaptive"];
  for (const size of [1, 4]) for (const ai of [1, 3]) for (let g = 0; g < 3; g++) {
    const c = cfgOf(C, size, ai, { dominion: false, supremacy: false, discovery: false, wonder: false });
    const cap = C.unlimitedMaxEras(size); c.endgame.maxEras = 150;
    const m = C.runMatch(c, { mode: "slow", profiles: profs, civCount: ai + 1, seed: C.fixedGameSeed(C.SEED, g), game: g, maxEras: cap });
    assert.ok(m.result, `tamanho ${size}, ${ai} rivais: não terminou`);
    assert.ok(m.result.era <= cap);
    const why = new Set(Object.values(m.result.reasons).flat());
    assert.ok([...why].every((r) => r === "elimination" || r === "score"), `tamanho ${size}: ${[...why]}`);
  }
});

test("save/load guarda a escolha; save antigo sem o campo = tudo ligado; o tutorial usa o padrão e devolve a escolha", async () => {
  const C = await core(), S = await load("app/save.js");
  const c = cfgOf(C, 3, 3, { wonder: false, supremacy: false }), s = C.newState(c, { endRules: true });
  for (let e = 0; e < 3; e++) C.processEra(s, c, {});
  const raw = (cfg, st) => JSON.stringify({ v: 1, savedAt: 1, gameMode: "slow", config: cfg, state: st, opponentChoices: null, difficulty: "medio" });
  const r = S.parseSavedGame(raw(c, JSON.parse(JSON.stringify(s))));
  assert.equal(r.status, "ok"); assert.deepEqual(r.game.state.victories, s.victories); assert.deepEqual(r.game.config.endgame.victories, c.endgame.victories);
  const old = JSON.parse(JSON.stringify(s)); delete old.victories;
  const oldCfg = JSON.parse(JSON.stringify(c)); delete oldCfg.endgame.victories;
  const r2 = S.parseSavedGame(raw(oldCfg, old));
  assert.equal(r2.status, "ok"); assert.deepEqual(C.victoriesOf(r2.game.state), ALL); assert.deepEqual(r2.game.config.endgame.victories, ALL);
  const session = await load("app/session.js"), setup = await load("app/setup.js");
  session.applyDifficulty(session.currentDifficulty);
  session.configApplied.endgame.victories = { ...ALL, dominion: false };
  setup.newTutorialGame();
  assert.deepEqual(session.configApplied.endgame.victories, ALL); assert.equal("victories" in session.state, false);
  setup.restoreSetupAfterTutorial();
  assert.deepEqual(session.configApplied.endgame.victories, { ...ALL, dominion: false });
  session.setState(session.newGame());
  assert.deepEqual(session.state.victories, { ...ALL, dominion: false });
  session.configApplied.endgame.victories = { ...ALL };
});

test("laboratórios: os quatro interruptores estão no catálogo e escrevem em endgame.victories", async () => {
  const L = await load("labs/settings.js"), C = await core();
  const keys = L.PARAM_GROUPS.find((g) => g[1] === "endgame")[2].map((p) => p[0]);
  for (const k of ["dominion", "supremacy", "discovery", "wonder"]) assert.ok(keys.includes("victories:" + k));
  const cfg = C.clone(C.DEFAULTS);
  L.setParam(cfg, "endgame", "victories:wonder", false);
  assert.equal(L.getParam(cfg, "endgame", "victories:wonder"), false);
  assert.deepEqual(C.normalizeConfig(cfg).endgame.victories, { ...ALL, wonder: false });
});
