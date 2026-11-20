// Rodada 2 de balanceamento de 20/11/2026 (aprovada pelo usuário). Duas mudanças na IA (src/ai/decide.js):
//  1. Reflexo de defesa: o rival que faz fronteira com o jogador humano, quando o exército do jogador é maior que
//     o dele, ganha +15 pontos de Militar, tirados de Obras e Ciência na proporção de cada uma. Não dispara em
//     partidas só de IAs (laboratórios, impressões digitais "match_*").
//  2. O Científico decide se ataca já com o desconto da Ciência (attackNeed); os outros estilos continuam a decidir
//     pelo custo cheio.
"use strict";
const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const SRC = path.resolve(__dirname, "..", "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

let E;
before(async () => {
  const [core, terrain, ai] = await Promise.all([load("core/index.js"), load("core/terrain.js"), load("ai/decide.js")]);
  E = { ...core, ...terrain, ...ai };
});

const STYLES = ["reference", "military", "aggressive", "economist", "technologist", "adaptive"];
// Pesos de base de cada estilo (adaptive: o caso "ameaçado", que é o que vale quando há fronteira com o jogador).
const BASE = { reference: [34, 33, 33], military: [65, 25, 10], aggressive: [68, 22, 10], economist: [20, 65, 15], technologist: [20, 20, 60], adaptive: [55, 30, 15] };

// 1×1: rival "ai" em Zênite (23). Com `border`, o jogador tem também Xisto (22), ao lado de Zênite.
function scene({ profile = "reference", border = true, playerMil = 50, aiMil = 10, allAI = false, effects = false, treasury = 100 }) {
  const c = E.clone(E.DEFAULTS); c.map.aiCount = 1; c.military.aiAggression = 0; c.military.aiReserve = 0;
  const s = E.newState(c, { endRules: true, allAI, profiles: [allAI ? "reference" : null, profile] });
  s.terrain = { type: "padrao", seed: null, list: Array(24).fill("campina") };
  if (effects) E.enableTerrainEffects(s);
  if (border) s.owners[22] = "player";
  const pl = s.civs[0], ai = s.civs[1];
  pl.military = playerMil; ai.military = aiMil; ai.treasury = treasury; s.era = 3;
  return { s, c, pl, ai };
}
const shares = (inv) => { const t = inv.military + inv.infrastructure + inv.technology; return [inv.military / t, inv.infrastructure / t, inv.technology / t]; };
const close = (a, b, msg) => a.forEach((v, k) => assert.ok(Math.abs(v - b[k]) < 1e-9, `${msg}: ${a} ≠ ${b}`));

test("reflexo de defesa: só com fronteira com o jogador humano e o exército do jogador maior", () => {
  assert.equal(E.DEFENSE_REFLEX_POINTS, 15);
  const on = (o) => { const { s, ai } = scene(o); return E.defenseReflexOn(s, ai); };
  assert.equal(on({}), true, "fronteira + exército do jogador maior");
  assert.equal(on({ border: false }), false, "sem fronteira com o jogador");
  assert.equal(on({ playerMil: 10, aiMil: 10 }), false, "exércitos iguais");
  assert.equal(on({ playerMil: 5, aiMil: 10 }), false, "exército do jogador menor");
  assert.equal(on({ allAI: true }), false, "partida só de IAs (lugar do jogador controlado por IA)");
  { const { s, pl } = scene({ allAI: true }); assert.equal(E.defenseReflexOn(s, pl), false, "o lugar do jogador nunca tem reflexo"); }
  // Fronteira só com outra IA mais forte não conta (o reflexo é contra o jogador humano).
  { const c = E.clone(E.DEFAULTS); c.map.aiCount = 2; const s = E.newState(c, { endRules: true, profiles: [null, "reference", "reference"] });
    const a = s.civs[1], b = s.civs[2]; const ia = s.owners.indexOf(a.id);
    for (const t of E.eligibleTargets(s, a.id)) s.owners[t.i] = b.id; b.military = 999; s.civs[0].military = 999; a.military = 1;
    assert.ok(E.eligibleTargets(s, a.id).length > 0 && ia >= 0);
    assert.equal(E.defenseReflexOn(s, a), false, "fronteira só com uma IA forte"); }
});

test("reflexo de defesa: +15 pontos de Militar tirados de Obras e Ciência na proporção, sem passar abaixo de 0", () => {
  for (const [w, exp] of [[[20, 20, 60], [35, 16.25, 48.75]], [[65, 25, 10], [80, 25 - 15 * 25 / 35, 10 - 15 * 10 / 35]], [[100, 0, 0], [115, 0, 0]], [[0, 5, 5], [15, 0, 0]], [[0, 0, 10], [15, 0, 0]]])
    close(E.applyDefenseReflex(w), exp, "pesos " + w);
  for (const w of [[0, 5, 5], [10, 3, 1], [0, 0, 0]]) for (const v of E.applyDefenseReflex(w)) assert.ok(v >= 0, "peso negativo " + w);
});

test("reflexo de defesa na decisão: cada estilo ganha 15 p.p. de Militar e mantém a sua prioridade principal", () => {
  for (const profile of STYLES) {
    const off = shares(E.aiDecide(...(({ s, ai, c }) => [s, ai, c, 3])(scene({ profile, playerMil: 5 }))).investment);
    const on = shares(E.aiDecide(...(({ s, ai, c }) => [s, ai, c, 3])(scene({ profile }))).investment);
    const b = BASE[profile], sum = b[0] + b[1] + b[2];
    close(off, b.map((x) => x / sum), profile + " sem reflexo");
    close(on, E.applyDefenseReflex(b).map((x) => x / sum), profile + " com reflexo");
    assert.ok(Math.abs(on[0] - off[0] - 15 / sum) < 1e-9, profile + ": Militar devia subir 15 p.p.");
    // Obras e Ciência descem na mesma proporção (a relação entre elas não muda) e nunca ficam negativas.
    assert.ok(on[1] >= 0 && on[2] >= 0);
    assert.ok(Math.abs(on[1] / on[2] - off[1] / off[2]) < 1e-9, profile + ": proporção Obras/Ciência mudou");
    // Mínimos de cada estilo: o que cada um prioriza continua a ser a maior parcela.
    const main = { military: 0, aggressive: 0, economist: 1, technologist: 2 }[profile];
    if (main !== undefined) assert.equal(on.indexOf(Math.max(...on)), main, profile + " perdeu a prioridade principal");
  }
  // Partida só de IAs: mesma decisão com ou sem exército grande no lugar do jogador.
  for (const profile of STYLES) {
    const a = shares(E.aiDecide(...(({ s, ai, c }) => [s, ai, c, 3])(scene({ profile, allAI: true }))).investment);
    const b = shares(E.aiDecide(...(({ s, ai, c }) => [s, ai, c, 3])(scene({ profile, allAI: true, playerMil: 0 }))).investment);
    close(a, b, profile + " em partida só de IAs");
  }
});

test("Científico decide atacar já com o desconto da Ciência; os outros estilos continuam pelo custo cheio", () => {
  for (const effects of [false, true]) {
    const run = (profile) => {
      const { s, c, ai } = scene({ profile, border: false, playerMil: 0, effects, treasury: 0 });
      c.military.aiAggression = 100; c.military.aiTarget = "neutralFirst"; ai.techProgress = 5000;
      const targets = E.eligibleTargets(s, ai.id);
      const need = Math.max(...targets.map((t) => E.attackNeed(s, t.i, ai.id, c))), full = Math.min(...targets.map((t) => E.fullAttackCost(s, t.i, c)));
      assert.ok(need < full, "o cenário precisa de desconto da Ciência");
      ai.military = (need + full) / 2; // chega para o custo com desconto, não para o cheio
      const d = E.aiDecide(s, ai, c, 3);
      return { d, ordered: (s.orders || []).some((o) => o.owner === ai.id) };
    };
    const tech = run("technologist");
    assert.ok(tech.ordered, `Científico devia atacar (efeitos=${effects}): ${tech.d.action}`);
    for (const p of ["reference", "military", "aggressive", "economist", "adaptive"]) {
      const r = run(p);
      assert.ok(!r.ordered && /acumulando/.test(r.d.action), `${p} não devia atacar só com o desconto (efeitos=${effects}): ${r.d.action}`);
    }
  }
});

test("partidas contra o jogador: o reflexo dispara, o Científico gasta ≥50% em Ciência e é quem mais gasta nela", () => {
  const inv = {}, fired = {};
  for (const profile of STYLES) {
    inv[profile] = [0, 0, 0]; fired[profile] = 0;
    for (const strategy of ["military", "aggressive", "balanced"]) for (const rivals of [1, 2]) for (let g = 0; g < 3; g++) {
      const c = E.clone(E.DEFAULTS), d = E.DIFFICULTIES.medio; c.map.aiCount = rivals; c.endgame.maxEras = 30;
      c.economy.aiIncomeMultiplier = d.aiIncomeMultiplier; c.economy.aiIncomeMultiplier1v1 = d.aiIncomeMultiplier1v1 ?? -1;
      c.military.aiAggression = d.aiAggression; c.military.aiTarget = d.aiTarget; c.simulation.seed = E.fixedGameSeed(E.SEED, g);
      const s = E.newState(c, { endRules: true, profiles: [null, ...Array(rivals).fill(profile)] });
      let guard = 0;
      while (!s.result && !s.stopped && guard++ < 200) {
        E.beginEra(s, c);
        for (const cv of s.civs.slice(1)) if (cv.active && E.defenseReflexOn(s, cv)) fired[profile]++;
        E.finishEra(s, c, { autoStrategy: strategy });
      }
      for (const e of s.timeline) e.civs.slice(1).forEach((r) => { inv[profile][0] += r.invested.military; inv[profile][1] += r.invested.infrastructure; inv[profile][2] += r.invested.technology; });
    }
  }
  for (const p of STYLES) assert.ok(fired[p] > 0, `o reflexo nunca disparou para ${p}`);
  const sh = Object.fromEntries(STYLES.map((p) => { const t = inv[p][0] + inv[p][1] + inv[p][2]; return [p, inv[p].map((v) => v / t)]; }));
  assert.ok(sh.technologist[2] >= 0.5, "Científico gastou " + (100 * sh.technologist[2]).toFixed(1) + "% em Ciência");
  for (const p of STYLES) if (p !== "technologist") assert.ok(sh.technologist[2] > sh[p][2], `${p} gastou mais em Ciência que o Científico`);
});
