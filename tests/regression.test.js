// Regressão de regras: partidas simuladas com semente fixa têm de dar sempre o mesmo resultado.
// O resultado de referência fica em tests/snapshots/regression.json.
// Se uma mudança INTENCIONAL de regras alterar os resultados, regrave com:
//   npm run test:update-snapshots
// e explique a mudança no commit. Se a mudança NÃO era intencional, é uma regressão.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { launch, openGame } = require("./helpers");

const SNAP = path.join(__dirname, "snapshots", "regression.json");
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

// Executado dentro da página: corre todos os cenários e devolve {nome: {summary, detail}}.
function runScenariosInPage() {
  const R = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? Number(v.toPrecision(10)) : String(v);
    if (Array.isArray(v)) return v.map(R);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, R(v[k])]));
    return v;
  };
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const LP = LAB_PROFILES.map((x) => x[0]);
  const base = () => clone(DEFAULTS);
  const out = {};
  const fromRecord = (rec) => ({
    summary: {
      eras: rec.eras,
      result: rec.result ? { era: rec.result.era, type: rec.result.type, winners: rec.result.winners, reasons: rec.result.reasons } : null,
      seats: rec.seats,
      finalTerritories: rec.rows.at(-1).civs.map((c) => c[RC.T]),
      finalScores: rec.finalScores.map(r4),
    },
    detail: R({ rows: rec.rows, result: rec.result, finalScores: rec.finalScores }),
  });
  // Modo B: partidas 100% IA com encerramento automático.
  for (const [civs, mode, seeds] of [[2, "slow", [1, 2, 3, 4]], [3, "fast", [5, 6]], [4, "slow", [7, 11]]])
    for (const seed of seeds) {
      const g = seed % LP.length;
      out[`auto-${civs}civ-${mode}-seed${seed}`] = fromRecord(runGame(base(), { kind: "auto", profiles: LP, civCount: civs, mode, seed, game: g }));
    }
  // Modo Conquista (supremacia desligada) e eras máximas curtas.
  {
    const c = base(); c.endgame.supremacyEnabled = false; c.endgame.maxEras = 20;
    out["auto-conquista-3civ-seed21"] = fromRecord(runGame(c, { kind: "auto", profiles: LP, civCount: 3, mode: "slow", seed: 21, game: 1 }));
  }
  // Modo A: duração fixa.
  out["fixed-25eras-3civ-seed99"] = fromRecord(runGame(base(), { kind: "fixed", eras: 25, profiles: LP, civCount: 3, mode: "slow", seed: 99, game: 0 }));
  // Partidas com "jogador" a seguir uma estratégia automática, contra IAs em cada dificuldade.
  const DIFF = { muitofacil: 1, medio: 1, dificil: 3, hardcore: 3 };
  for (const [diff, ai] of Object.entries(DIFF))
    for (const strategy of ["balanced", "aggressive", "growth"]) {
      const c = base(), d = DIFFICULTIES[diff];
      c.economy.aiIncomeMultiplier = d.aiIncomeMultiplier; c.economy.aiIncomeMultiplier1v1 = d.aiIncomeMultiplier1v1 ?? -1;
      c.military.aiAggression = d.aiAggression; c.military.aiTarget = d.aiTarget; c.map.aiCount = ai; c.simulation.seed = 4242;
      const s = newState(c, { mode: "slow", endRules: true, profiles: [null, ...LP.slice(0, ai)] });
      while (!s.result && s.era < c.endgame.maxEras + 10) processEra(s, c, { autoStrategy: strategy });
      out[`player-${strategy}-${diff}-${ai}ai`] = {
        summary: {
          eras: s.era,
          result: s.result ? { era: s.result.era, type: s.result.type, winners: s.result.winners, reasons: s.result.reasons } : null,
          finalTerritories: s.civs.map((x) => countTerritories(s, x.id)),
          playerTreasury: r4(P(s).treasury),
          playerAttacks: s.attacks.playerWins + "/" + (s.attacks.playerWins + s.attacks.playerLosses),
        },
        detail: R({ timeline: s.timeline, owners: s.owners, civs: s.civs, attacks: s.attacks }),
      };
    }
  return out;
}

// Um cenário por linha: fácil de ler e de comparar no git diff.
const formatSnapshot = (o) =>
  "{\n" + Object.keys(o).sort().map((k) => ` ${JSON.stringify(k)}: ${JSON.stringify(o[k])}`).join(",\n") + "\n}\n";
const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

let browser, first, second;
before(async () => {
  browser = await launch();
  // Duas páginas independentes: o resultado não pode depender de estado global nem da ordem.
  for (const k of [0, 1]) {
    // runGame (motor dos laboratórios) só existe na versão de desenvolvimento (dev.html).
    const ctx = await openGame(browser, { dev: true });
    const res = await ctx.page.evaluate(runScenariosInPage);
    const flat = Object.fromEntries(Object.entries(res).map(([n, v]) => [n, { summary: v.summary, hash: hash(v.detail) }]));
    if (k === 0) first = flat; else second = flat;
    assert.deepEqual(ctx.errors, []);
    await ctx.context.close();
  }
});
after(async () => browser && browser.close());

test("mesma semente dá exatamente o mesmo resultado em duas execuções independentes", () => {
  assert.deepEqual(second, first);
});

test("resultados batem com o snapshot gravado (tests/snapshots/regression.json)", () => {
  if (UPDATE || !fs.existsSync(SNAP)) {
    fs.mkdirSync(path.dirname(SNAP), { recursive: true });
    fs.writeFileSync(SNAP, formatSnapshot(first));
    console.log(`  snapshot ${UPDATE ? "regravado" : "criado"}: ${Object.keys(first).length} cenários`);
    return;
  }
  const snap = JSON.parse(fs.readFileSync(SNAP, "utf8"));
  const problems = [];
  for (const name of new Set([...Object.keys(snap), ...Object.keys(first)])) {
    const a = snap[name], b = first[name];
    if (!a) { problems.push(`+ cenário novo sem snapshot: ${name}`); continue; }
    if (!b) { problems.push(`- cenário desapareceu: ${name}`); continue; }
    if (a.hash === b.hash) continue;
    const diffs = Object.keys({ ...a.summary, ...b.summary })
      .filter((k) => JSON.stringify(a.summary[k]) !== JSON.stringify(b.summary[k]))
      .map((k) => `    ${k}: antes ${JSON.stringify(a.summary[k])} → agora ${JSON.stringify(b.summary[k])}`);
    problems.push(`* ${name} mudou` + (diffs.length ? ":\n" + diffs.join("\n") : " (só em valores intermédios por era)"));
  }
  assert.ok(
    problems.length === 0,
    "AVISO DE REGRESSÃO: partidas com semente fixa deram resultados diferentes.\n" + problems.join("\n") +
      "\nSe a mudança de regras foi intencional, rode `npm run test:update-snapshots` e faça commit do snapshot."
  );
});
