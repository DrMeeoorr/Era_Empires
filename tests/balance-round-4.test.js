// Rodada 4 de balanceamento de 20/11/2026 (aprovada pelo usuário), nos dois modos de terreno:
//  A. Saque das Obras e da Ciência limitado a 20% (pillageMaxShare; antes min(50%, 3/regiões)).
//  B. Força guardada defende: cada ponto de Força que o dono não usou em ordens soma 1 à defesa
//     (defensePerReserveForce), repartido como a defesa das Obras (÷ raiz do número de regiões).
//  Sorteio novo a cada partida: cada partida nova tem a sua semente de batalha (state.rngSeed), guardada no save.
//  Laboratórios, testes e impressões digitais continuam com a semente fixa; o tutorial também.
// Não aprovado (e por isso NÃO testado como regra): rivais que reagem ao jogador ("E"), logística, manutenção,
// chance variável, limite de ordens, rival "Aleatório" como padrão no Difícil/Lendário.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launch, openGame } = require("./helpers");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

let E, session, save, setup;
before(async () => {
  const [core, terrain, ai, mil] = await Promise.all([load("core/index.js"), load("core/terrain.js"), load("ai/decide.js"), load("core/military.js")]);
  E = { ...core, ...terrain, ...ai, ...mil };
  [session, save, setup] = await Promise.all([load("app/session.js"), load("app/save.js"), load("app/setup.js")]);
});

// 1×1: jogador em Arvela (0) e rival em Zênite (23); com `border`, o jogador também tem Xisto (22), ao lado de Zênite.
function scene({ border = true, playerMil = 0, aiMil = 0, effects = false } = {}) {
  const c = E.clone(E.DEFAULTS); c.map.aiCount = 1; c.military.aiReserve = 0;
  const s = E.newState(c, { endRules: true, profiles: [null, "reference"] });
  s.terrain = { type: "padrao", seed: null, list: Array(24).fill("campina") };
  if (effects) E.enableTerrainEffects(s);
  if (border) s.owners[22] = "player";
  const pl = s.civs[0], ai = s.civs[1];
  pl.military = playerMil; ai.military = aiMil; s.era = 3;
  return { s, c, pl, ai };
}

test("parâmetros da rodada 4: teto do saque 0,2 e +1 de defesa por ponto de Força guardada", () => {
  assert.equal(E.DEFAULTS.military.pillageMaxShare, 0.2);
  assert.equal(E.DEFAULTS.military.defensePerReserveForce, 1);
  assert.equal(E.DEFAULTS.military.pillageInvestShare, 3, "a parte por região (3/regiões) não mudou");
  // Configurações antigas sem os parâmetros novos abrem com os padrões novos (como os saves em curso).
  const old = E.clone(E.DEFAULTS); delete old.military.pillageMaxShare; delete old.military.defensePerReserveForce;
  const n = E.normalizeConfig(old);
  assert.equal(n.military.pillageMaxShare, 0.2);
  assert.equal(n.military.defensePerReserveForce, 1);
  assert.throws(() => E.normalizeConfig({ ...E.clone(E.DEFAULTS), military: { ...E.DEFAULTS.military, pillageMaxShare: 2 } }));
});

test("saque ≤ 20%: em partidas inteiras nenhuma conquista leva mais de 20% das Obras e da Ciência do derrotado", () => {
  // Cerca a função de saque numa partida real (Difícil, 2 rivais, jogador que ataca muito) e mede cada conquista.
  let checked = 0;
  for (const fx of [false, true]) for (let g = 0; g < 4; g++) {
    const c = E.clone(E.DEFAULTS), d = E.DIFFICULTIES.dificil; c.map.aiCount = 2;
    c.economy.aiIncomeMultiplier = d.aiIncomeMultiplier; c.military.aiAggression = d.aiAggression; c.military.aiTarget = d.aiTarget;
    c.simulation.seed = E.fixedGameSeed(E.SEED, g);
    const s = E.newState(c, { endRules: true, profiles: [null, "aggressive", "military"] });
    s.terrain = E.makeMapTerrain("padrao", null, s.owners.map((o, i) => (o === "neutral" ? -1 : i)).filter((i) => i >= 0), 24);
    if (fx) E.enableTerrainEffects(s);
    let guard = 0;
    while (!s.result && guard++ < 40) {
      E.beginEra(s, c);
      // Antes de resolver, mede o que cada derrotado tem; depois, o que perdeu em cada conquista.
      const sum = (o, ty, k) => s.investments.filter((i) => i.owner === o && i.type === ty).reduce((a, i) => a + (i[k] || 0), 0);
      const own0 = [...s.owners];
      const snap = Object.fromEntries(s.civs.map((cv) => [cv.id, { t: sum(cv.id, "technology", "progress"), T: E.countTerritories(s, cv.id) }]));
      E.finishEra(s, c, { autoStrategy: "aggressive" });
      for (const cv of s.civs) {
        const lost = own0.filter((o, i) => o === cv.id && s.owners[i] !== cv.id).length;
        if (!lost || !(snap[cv.id].t > 0)) continue;
        // Cada conquista leva no máximo 20% do que sobrou; k conquistas na era → no máximo 1 − 0,8^k.
        const kept = sum(cv.id, "technology", "progress") / snap[cv.id].t;
        assert.ok(kept >= Math.pow(0.8, lost) - 1e-9, `fx=${fx} jogo ${g} era ${s.era}: ${cv.id} ficou com ${(100 * kept).toFixed(1)}% da Ciência após ${lost} conquista(s)`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, "nenhuma conquista com saque foi medida");
});

test("Força guardada: aumenta a defesa (÷ raiz das regiões), conta na folha (defenseParts) e no custo de atacar", () => {
  for (const effects of [false, true]) {
    const { s, c, pl, ai } = scene({ effects });
    const T = E.countTerritories(s, "player"); assert.equal(T, 2);
    const d0 = E.territoryDefense(s, 22, c);
    pl.military = 20;
    const d1 = E.territoryDefense(s, 22, c);
    assert.ok(Math.abs(d1 - d0 - 20 / Math.sqrt(T)) < 1e-9, `efeitos=${effects}: defesa ${d0} → ${d1}`);
    const p = E.defenseParts(s, 22, c);
    assert.ok(Math.abs(p.reserve - 20 / Math.sqrt(T)) < 1e-9);
    assert.ok(Math.abs(p.base + p.works + p.reserve + p.terrain - p.total) < 1e-9, "as partes da defesa somam o total");
    assert.ok(Math.abs(p.total - d1) < 1e-9);
    // O custo que a IA paga (e o que o jogador vê quando ataca a IA) inclui a Força guardada do defensor.
    assert.ok(Math.abs(E.fullAttackCost(s, 22, c) - (c.military.conquestCost + d1) * (effects ? E.terrainAttackFactor(s, 22) : 1)) < 1e-9);
    ai.military = 9; const pAi = E.defenseParts(s, 23, c);
    assert.ok(Math.abs(pAi.reserve - 9) < 1e-9, "a defesa do rival (1 região) sobe 9 com 9 de Força guardada");
    const n9 = E.attackNeed(s, 23, "player", c); ai.military = 0;
    assert.ok(Math.abs(n9 - E.attackNeed(s, 23, "player", c) - 9 / E.techAttackFactor(s, "player", c)) < 1e-9, "o custo de atacar o rival sobe com a Força guardada dele");
    // Regiões livres: sem Força guardada.
    assert.equal(E.defenseParts(s, 5, c).reserve, 0);
  }
});

test("gastar a Força em ordens reduz a defesa; na resolução vale a Força livre antes de devolver as reservas", () => {
  // Várias sementes: a ordem em que as ordens se resolvem é sorteada, e o retrato tem de valer em todas.
  const kinds = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const { s, c, pl, ai } = scene({ playerMil: 60, aiMil: 0 }); s.rngSeed = seed;
    const d0 = E.territoryDefense(s, 22, c);
    const t = E.eligibleTargets(s, "player").find((x) => x.o === "neutral");
    const r = E.orderAttack(s, t.i, "player", c); assert.ok(r.ok);
    const d1 = E.territoryDefense(s, 22, c);
    assert.ok(Math.abs(d0 - d1 - r.need / Math.sqrt(2)) < 1e-9, "a Força reservada não defende");
    // A IA ataca Xisto (22) com a Força exata do custo visto agora (com a Força livre do jogador).
    const cost = E.attackNeed(s, 22, ai.id, c); ai.military = cost + 1e-6;
    const o = E.orderAttack(s, 22, ai.id, c); assert.ok(o.ok, o.reason);
    // Resolve: as reservas voltam e são cobradas de novo. Se a Força devolvida ao jogador contasse antes de ele
    // pagar a sua ordem, a defesa de Xisto subia e a ordem da IA era cancelada por falta de Força.
    const ev = E.resolveOrders(s, c, s.era);
    const mine = ev.find((e) => e.owner === ai.id);
    assert.ok(mine && (mine.type === "win" || mine.type === "loss"), `semente ${seed}: a ordem da IA devia ser resolvida: ` + JSON.stringify(ev));
    kinds.add(ev[0].owner);
    // Fora da resolução, volta a valer a Força atual.
    pl.military = 0; assert.ok(Math.abs(E.defenseParts(s, 0, c).reserve) < 1e-9);
  }
  assert.equal(kinds.size, 2, "as sementes deviam cobrir as duas ordens de resolução");
});

test("a IA usa a regra: não ataca o jogador que guarda muita Força, ataca quando ele a gasta", () => {
  const run = (playerMil) => {
    const { s, c, ai } = scene({ playerMil, aiMil: 30 });
    c.military.aiAggression = 100; c.military.aiTarget = "playerFirst"; ai.treasury = 0;
    E.aiDecide(s, ai, c, 3);
    return (s.orders || []).find((o) => o.owner === ai.id) || null;
  };
  assert.equal(run(0)?.idx, 22, "sem Força guardada, a IA (30 de Força) ataca Xisto");
  assert.equal(run(60), null, "com 60 de Força guardada, Xisto custa mais do que a IA tem");
  // Partida curta: a IA paga exatamente o custo com a Força guardada do jogador.
  const { s, c, ai } = scene({ playerMil: 10, aiMil: 100 });
  c.military.aiAggression = 100; c.military.aiTarget = "playerFirst"; ai.treasury = 0;
  E.aiDecide(s, ai, c, 3);
  const o = s.orders.find((x) => x.owner === ai.id);
  assert.ok(Math.abs(o.need - E.attackNeed(s, 22, ai.id, c)) < 1e-9);
  assert.ok(Math.abs(o.need - (c.military.conquestCost + c.military.defenseOwned + 10 / Math.sqrt(2))) < 1e-9, "custo " + o.need);
});

test("sorteio novo a cada partida: newGame sorteia a semente das batalhas; tutorial e laboratórios ficam fixos", () => {
  session.setConfigApplied(E.clone(E.DEFAULTS));
  const seeds = new Set(Array.from({ length: 8 }, () => session.newGame().rngSeed));
  assert.ok(seeds.size >= 7, "sementes repetidas: " + [...seeds]);
  for (const v of seeds) assert.ok(Number.isInteger(v) && v >= 0 && v < 2 ** 32);
  assert.equal(session.newGame({ fixedSeed: true }).rngSeed, E.DEFAULTS.simulation.seed);
  // Tutorial: sempre a semente da configuração (o roteiro é sempre igual).
  const t1 = setup.newTutorialGame().rngSeed; setup.restoreSetupAfterTutorial();
  const t2 = setup.newTutorialGame().rngSeed; setup.restoreSetupAfterTutorial();
  assert.equal(t1, E.DEFAULTS.simulation.seed); assert.equal(t2, t1);
  // Laboratórios: newState/runMatch não usam Math.random para a semente das batalhas.
  const real = Math.random;
  const m = () => JSON.stringify(E.runMatch(E.clone(E.DEFAULTS), { mode: "slow", profiles: ["reference", "military"], civCount: 2, seed: E.fixedGameSeed(E.SEED, 1), game: 1 }).state.timeline);
  try {
    Math.random = () => 0.123; const a = m();
    Math.random = () => 0.987; const b = m();
    assert.equal(a, b, "runMatch mudou com Math.random");
  } finally { Math.random = real; }
  assert.equal(E.newState(E.clone(E.DEFAULTS)).rngSeed, E.DEFAULTS.simulation.seed);
});

test("semente de batalha guardada no save: recarregar continua com a mesma; saves antigos mantêm a sua", () => {
  session.setConfigApplied(E.clone(E.DEFAULTS));
  const s = session.setState(session.newGame());
  const raw = save.serializeGame();
  const back = save.parseSavedGame(raw);
  assert.equal(back.status, "ok");
  assert.equal(back.game.state.rngSeed, s.rngSeed);
  // A partida recarregada joga igual à original (mesmos sorteios).
  const play = (st) => { for (let i = 0; i < 6 && !st.result; i++) { E.finishEra(st, back.game.config, { autoStrategy: "aggressive" }); if (!st.result) E.beginEra(st, back.game.config); } return JSON.stringify(st.timeline); };
  assert.equal(play(JSON.parse(JSON.stringify(s))), play(back.game.state));
  // Save antigo (semente fixa de antes da rodada 4): abre com a mesma semente.
  const old = JSON.parse(raw); old.state.rngSeed = E.SEED;
  assert.equal(save.parseSavedGame(JSON.stringify(old)).game.state.rngSeed, E.SEED);
});

test("textos: Como jogar fala da Força guardada e do saque de até 20%; index.html gerado com os textos novos", () => {
  for (const f of ["dev.html", "index.html"]) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.match(html, /Parada, defende e perde 20% por era\./, f);
    assert.match(html, /\(<strong>Força guardada<\/strong>\) reforça a defesa das suas regiões/, f);
    assert.match(html, /você leva até 20% das Obras e da Ciência dele/, f);
    assert.doesNotMatch(html, /até metade|50% das Obras/, f);
  }
});

let browser;
test("folha da região: defesa com 'Força guardada +X' e custo do ataque explicado", async () => {
  browser = await launch();
  const { context, page, errors } = await openGame(browser);
  const t = await page.evaluate(() => {
    configApplied.map.aiCount = 1; state = newGame(); state.ui.skipIdleWarning = true; document.getElementById("homeScreen").hidden = true;
    const mine = state.owners.indexOf("player"), tgt = eligibleTargets(state, "player")[0].i;
    state.owners[tgt] = state.civs[1].id; P(state).military = 20; state.civs[1].military = 12; renderAll();
    return { mine, tgt, T: countTerritories(state, "player"), reserveMine: defenseParts(state, mine, configApplied).reserve, reserveAi: defenseParts(state, tgt, configApplied).reserve };
  });
  await page.locator(`[data-territory="${t.mine}"]`).click();
  await page.locator("#attackSheet").waitFor({ state: "visible" });
  const own = await page.locator("#mapStatus").innerText();
  assert.match(own, /Defesa [\d.,]+ · Força guardada \+[\d.,]+/, own);
  assert.match(own, /a Força que você não usa em ataques reforçam a defesa/);
  await page.keyboard.press("Escape");
  await page.locator(`[data-territory="${t.tgt}"]`).click();
  await page.locator("#attackSheet").waitFor({ state: "visible" });
  await page.locator("#mapStatus details.tgt-info summary").click();
  const atk = await page.locator("#mapStatus").innerText();
  assert.match(atk, /Custo = defesa 8 \+ [\d.,]+ de Força guardada \+ conquista 5/, atk);
  assert.ok(t.reserveAi > 0 && Math.abs(t.reserveMine - 20 / Math.sqrt(t.T)) < 1e-9, JSON.stringify(t));
  assert.deepEqual(errors, []);
  await context.close();
});

test("na interface: Jogar dá semente nova; recarregar a página continua com a mesma; Nova partida sorteia outra", async () => {
  const { context, page, errors } = await openGame(browser);
  await page.locator("#homeStart").click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  const s1 = await page.evaluate(() => state.rngSeed);
  await page.waitForFunction(async () => !!(await storage.get(SAVE_KEY)));
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true && !!state);
  const s2 = await page.evaluate(() => state.rngSeed);
  assert.equal(s2, s1, "a partida salva devia continuar com a sua semente");
  const s3 = await page.evaluate(() => { startNewGame(); return state.rngSeed; });
  assert.notEqual(s3, s1, "partida nova com a mesma semente");
  assert.deepEqual(errors, []);
  await context.close();
});
after(async () => browser && browser.close());
