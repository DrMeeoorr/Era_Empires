// Terrenos com efeitos (20/11/2026): opção "Terrenos: Só visual / Com efeitos" em Nova partida → Personalizar.
// Desligado (padrão) o jogo é o de antes byte a byte (impressão digital e82cdda4 em tests/fingerprint.test.js;
// a do modo ligado está em tests/fingerprint-effects.test.js). Aqui: cada efeito da tabela, proteção só para quem
// ocupa, região inicial como Campina, preferência da IA pelo terreno do seu estilo, save, tutorial e textos.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launch, openGame, openCustomize, horizontalOverflow, MOBILE_SCREENS, KEYS } = require("./helpers");

const SRC = path.resolve(__dirname, "..", "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const PIXEL = MOBILE_SCREENS[0][1];
const NAMES = ["Campina", "Floresta", "Colinas", "Montanha", "Deserto", "Pântano", "Tundra"];
// Tabela final aprovada (Tundra com Ciência): 2 vantagens + 1 desvantagem.
const TABLE = {
  campina: { income: 1.2, obras: 0.05, defense: -2 },
  floresta: { obras: 0.1, defense: 2, income: 0.8 },
  colinas: { forca: 0.1, defense: 2, income: 0.8 },
  montanha: { defense: 4, income: 1.2, ciencia: -0.1 },
  deserto: { ciencia: 0.1, income: 1.2, defense: -2 },
  pantano: { ciencia: 0.2, attack: 1.2, income: 0.8 },
  tundra: { ciencia: 0.15, defense: 2, income: 0.8 },
};
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);

let E;
before(async () => {
  const [core, terrain, ai, config] = await Promise.all([load("core/index.js"), load("core/terrain.js"), load("ai/decide.js"), load("core/config.js")]);
  E = { ...core, ...terrain, ...ai, ...config };
});

// Partida de teste: 1 rival, mapa todo de um terreno (ou lista dada), efeitos ligados ou não.
function mk({ list = null, fill = "campina", effects = true, starts = null } = {}) {
  const c = E.clone(E.DEFAULTS);
  const s = E.newState(c, { endRules: true });
  s.terrain = { type: "padrao", seed: null, list: list || Array(s.owners.length).fill(fill) };
  if (effects) { E.enableTerrainEffects(s); if (starts) s.terrain.starts = starts; }
  return { s, c };
}

// ── Sem navegador ──

test("efeitos: a tabela final é a aprovada (Tundra com Ciência) e cada terreno tem 2 vantagens e 1 desvantagem", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(E.TERRAIN_EFFECTS)), TABLE);
  assert.ok(Object.isFrozen(E.TERRAIN_EFFECTS));
  for (const k of E.TERRAINS) {
    const t = E.TERRAIN_EFFECT_TEXT[k];
    assert.equal(t.length, 3, k);
    assert.equal(t.filter((x) => x.startsWith("+")).length + (k === "pantano" ? 1 : 0), 2, `${k}: 2 vantagens`);
    assert.ok(t[2].startsWith("−"), `${k}: a desvantagem vem por último`);
  }
  // Tundra e Pântano são diferentes; Tundra já não repete o +10% Força de Colinas.
  assert.notDeepEqual(TABLE.tundra, TABLE.pantano);
  assert.equal(TABLE.tundra.forca, undefined);
});

test("efeitos desligados: nenhuma função muda um número, com qualquer terreno (unidade com terrenos variados)", () => {
  const T = E.TERRAINS;
  for (let k = 0; k < 7; k++) {
    const list = Array.from({ length: 24 }, (_, i) => T[(i + k) % 7]);
    const plain = mk({ effects: false }).s;
    const { s, c } = mk({ list, effects: false });
    s.terrain.starts = [0, 23];  // mesmo com regiões iniciais guardadas, sem terrainEffects nada vale
    s.owners[3] = "player"; plain.owners[3] = "player";
    assert.equal(E.terrainEffectsOn(s), false);
    for (let i = 0; i < 24; i++) {
      assert.equal(E.terrainIncomeFactor(s, i), 1);
      assert.equal(E.terrainDefenseBonus(s, i), 0);
      assert.equal(E.terrainAttackFactor(s, i), 1);
      assert.equal(E.territoryDefense(s, i, c), E.territoryDefense(plain, i, c));
      assert.equal(E.attackNeed(s, i, "player", c), E.attackNeed(plain, i, "player", c));
    }
    for (const key of ["obras", "forca", "ciencia"]) assert.equal(E.terrainAreaBonus(s, "player", key), 0);
    // A mesma partida inteira, com e sem terrenos (só visuais), dá exatamente o mesmo resultado.
    const run = (terrain) => {
      const cc = E.clone(E.DEFAULTS); cc.map.aiCount = 2;
      const st = E.newState(cc, { endRules: true, allAI: true, profiles: ["adaptive", "military", "technologist"] });
      if (terrain) st.terrain = { type: "sorteado", seed: 1, list };
      while (!st.result && st.era < 40) E.processEra(st, cc, {});
      return JSON.stringify({ tl: st.timeline, o: st.owners, r: st.result, log: st.log });
    };
    assert.equal(run(true), run(false), `terrenos só visuais mudaram a partida (rotação ${k})`);
  }
});

test("efeito ouro: cada região rende conforme o seu terreno (Campina/Montanha/Deserto +20%, os outros −20%)", () => {
  for (const k of E.TERRAINS) {
    const on = mk({ fill: k, starts: [] }), off = mk({ fill: k, effects: false });
    for (const { s } of [on, off]) { s.owners[2] = "player"; s.owners[3] = "player"; }
    const a = E.collectRevenue(on.s, on.s.civs[0], 3, on.c), b = E.collectRevenue(off.s, off.s.civs[0], 3, off.c);
    near(a.normal, b.normal * TABLE[k].income, `ouro de ${k}`);
  }
});

test("efeito defesa: +2 Floresta/Colinas/Tundra, +4 Montanha, −2 Campina/Deserto, nunca abaixo de 0", () => {
  for (const k of E.TERRAINS) {
    const on = mk({ fill: k, starts: [] }), off = mk({ fill: k, effects: false });
    on.s.owners[5] = "player"; off.s.owners[5] = "player";
    near(E.territoryDefense(on.s, 5, on.c), Math.max(0, E.territoryDefense(off.s, 5, off.c) + (TABLE[k].defense || 0)), `defesa de ${k}`);
  }
  const { s, c } = mk({ fill: "campina", starts: [] });
  s.owners[5] = "player"; c.military.defenseOwned = 1;
  assert.equal(E.territoryDefense(s, 5, c), 0, "a defesa não pode ficar negativa");
});

test("efeito custo de ataque: atacar um Pântano com dono custa +20% (antes do desconto da Ciência)", () => {
  const on = mk({ fill: "pantano", starts: [] }), off = mk({ fill: "pantano", effects: false });
  for (const { s } of [on, off]) { s.owners[1] = s.civs[1].id; s.owners[0] = "player"; }
  near(E.fullAttackCost(on.s, 1, on.c), (on.c.military.conquestCost + E.territoryDefense(on.s, 1, on.c)) * 1.2, "custo cheio");
  near(E.attackNeed(on.s, 1, "player", on.c), E.attackNeed(off.s, 1, "player", off.c) * 1.2, "custo do Pântano");
  // Outros terrenos não mexem no multiplicador.
  for (const k of E.TERRAINS.filter((x) => x !== "pantano")) assert.equal(E.terrainAttackFactor(mk({ fill: k, starts: [] }).s, 23), 1, k);
});

test("efeito Obras/Ciência/Força: % somada por região de cada terreno do império", () => {
  // Obras: 3 Florestas (+10% cada) + a região inicial (Campina, +5%) = +35% na receita de Obras.
  const list = Array(24).fill("montanha");
  list[1] = list[2] = list[6] = "floresta";
  const o = mk({ list }), off = mk({ list, effects: false });
  for (const { s } of [o, off]) { for (const i of [1, 2, 6]) s.owners[i] = "player"; }
  assert.equal(o.s.owners[0], "player", "o jogador começa no 1");
  near(E.terrainAreaBonus(o.s, "player", "obras"), 0.35, "bônus de Obras");
  for (const { s, c } of [o, off]) { E.invest(s, "infrastructure", 50, c); E.invest(s, "technology", 50, c); }
  const ro = E.collectRevenue(o.s, o.s.civs[0], 6, o.c), rf = E.collectRevenue(off.s, off.s.civs[0], 6, off.c);
  assert.ok(rf.infra > 0);
  near(ro.infra, rf.infra * 1.35, "receita de Obras");
  // Ciência: Pântano +20%, Deserto +10%, Tundra +15%, Montanha −10% (a região inicial é Campina, 0%).
  for (const [k, pct] of [["pantano", 0.2], ["deserto", 0.1], ["tundra", 0.15], ["montanha", -0.1]]) {
    const a = mk({ fill: k }), b = mk({ fill: k, effects: false });
    for (const { s } of [a, b]) s.owners[1] = s.owners[6] = "player";
    near(E.terrainAreaBonus(a.s, "player", "ciencia"), 2 * pct, `Ciência de ${k}`);
    // Sem o bônus de Ciência sobre toda a receita (que soma o ouro das regiões), para medir só a receita da Ciência.
    for (const { s, c } of [a, b]) { c.technology.revenueBonusPerProgress = 0; E.invest(s, "technology", 80, c); }
    const x = E.collectRevenue(a.s, a.s.civs[0], 8, a.c), y = E.collectRevenue(b.s, b.s.civs[0], 8, b.c);
    assert.ok(y.tech > 0);
    near(x.tech, y.tech * (1 + 2 * pct), `receita de Ciência com ${k}`);
  }
  // Força: 2 Colinas = +20% nos pontos de cada novo investimento militar.
  const f = mk({ fill: "colinas" }), g = mk({ fill: "colinas", effects: false });
  for (const { s } of [f, g]) s.owners[1] = s.owners[6] = "player";
  const pf = E.invest(f.s, "military", 40, f.c).points, pg = E.invest(g.s, "military", 40, g.c).points;
  near(pf, pg * 1.2, "pontos de Força");
});

test("proteção só para quem ocupa: região livre de Montanha, Floresta ou Pântano custa o normal", () => {
  for (const k of ["montanha", "floresta", "colinas", "tundra", "pantano", "campina", "deserto"]) {
    const on = mk({ fill: k }), off = mk({ fill: k, effects: false });
    assert.equal(on.s.owners[1], "neutral");
    assert.equal(E.territoryDefense(on.s, 1, on.c), on.c.military.defenseNeutral, `defesa da região livre de ${k}`);
    assert.equal(E.attackNeed(on.s, 1, "player", on.c), E.attackNeed(off.s, 1, "player", off.c), `custo da região livre de ${k}`);
    // Com dono, o terreno passa a proteger (ou a expor: Campina e Deserto −2).
    on.s.owners[1] = off.s.owners[1] = on.s.civs[1].id;
    const d = E.attackNeed(on.s, 1, "player", on.c) - E.attackNeed(off.s, 1, "player", off.c);
    assert.ok(TABLE[k].defense < 0 ? d < 0 : d > 0, `região com dono de ${k}: o terreno devia contar (${d})`);
  }
});

test("região inicial conta como Campina (ouro +20%, defesa −2, Obras +5%) mesmo num mapa de Montanha", () => {
  const { s, c } = mk({ fill: "montanha" });
  const start = s.owners.indexOf("player");
  assert.deepEqual(E.terrainStartsOf(s), s.owners.map((o, i) => (o === "neutral" ? -1 : i)).filter((i) => i >= 0));
  assert.equal(E.ruleTerrain(s, start), "campina");
  assert.equal(E.terrainOf(s)[start], "montanha", "o desenho continua o do mapa");
  assert.equal(E.terrainIncomeFactor(s, start), 1.2);
  assert.equal(E.terrainDefenseBonus(s, start), -2);
  near(E.terrainAreaBonus(s, "player", "obras"), 0.05, "Obras da região inicial");
  assert.equal(E.terrainAreaBonus(s, "player", "ciencia"), 0, "a região inicial não leva o −10% Ciência da Montanha");
  // Conquistada por outro império, a região inicial continua a contar como Campina.
  s.owners[start] = s.civs[1].id;
  assert.equal(E.terrainDefenseBonus(s, start), -2);
  // Uma região que não é inicial segue o mapa.
  s.owners[1] = "player";
  assert.equal(E.terrainDefenseBonus(s, 1), 4);
});

test("IA prefere o terreno do seu estilo entre alvos iguais (Científico → Pântano, Militar → Colinas, Construtor → Floresta)", () => {
  const pick = (style, a, b, effects = true) => {
    const list = Array(24).fill("campina");
    // Jogador IA no 8 (índice 7) com dois vizinhos livres: 6 (antes) e 8 (depois). Defesa e custo iguais (livres).
    list[6] = a; list[8] = b;
    const c = E.clone(E.DEFAULTS); c.military.aiAggression = 100;
    const s = E.newState(c, { endRules: true, allAI: true, profiles: [style, "reference"] });
    s.owners = s.owners.map(() => "neutral"); s.owners[7] = "player"; s.owners[23] = s.civs[1].id;
    // Os vizinhos de cima e de baixo (1 e 13) são do rival: entre os livres, só sobram 6 e 8.
    s.owners[1] = s.owners[13] = s.civs[1].id;
    s.terrain = { type: "padrao", seed: null, list };
    if (effects) E.enableTerrainEffects(s);
    s.civs[0].military = 100; s.era = 3;
    E.aiDecide(s, s.civs[0], c, 3);
    return (s.orders || []).filter((o) => o.owner === "player").map((o) => o.idx)[0];
  };
  // Com os efeitos ligados, cada estilo vai ao seu terreno, esteja ele antes ou depois.
  for (const [style, fav, other] of [["technologist", "pantano", "colinas"], ["military", "colinas", "pantano"], ["aggressive", "colinas", "tundra"], ["economist", "floresta", "colinas"], ["technologist", "tundra", "floresta"]]) {
    assert.equal(pick(style, fav, other), 6, `${style} devia escolher ${fav} (antes)`);
    assert.equal(pick(style, other, fav), 8, `${style} devia escolher ${fav} (depois)`);
  }
  // Desligado: a escolha de sempre (o primeiro pela ordem das regiões), qualquer que seja o terreno.
  assert.equal(pick("technologist", "colinas", "pantano", false), 6);
  assert.equal(pick("military", "pantano", "colinas", false), 6);
});

test("laboratórios: runMatch/runFixedGame aceitam terrain {type, seed, effects}; sem ele, o resultado de sempre", () => {
  const c = E.clone(E.DEFAULTS); c.map.aiCount = 2;
  const profs = ["adaptive", "military", "technologist"];
  const base = E.runMatch(c, { profiles: profs, civCount: 3, seed: E.SEED, game: 0 });
  const vis = E.runMatch(c, { profiles: profs, civCount: 3, seed: E.SEED, game: 0, terrain: { type: "sorteado", seed: 5, effects: false } });
  const fx = E.runMatch(c, { profiles: profs, civCount: 3, seed: E.SEED, game: 0, terrain: { type: "sorteado", seed: 5, effects: true } });
  assert.equal(JSON.stringify(vis.state.timeline), JSON.stringify(base.state.timeline), "terreno só visual mudou a partida");
  assert.equal(vis.state.terrainEffects, undefined);
  assert.equal(fx.state.terrainEffects, true);
  assert.equal(fx.state.terrain.type, "sorteado");
  assert.deepEqual(fx.state.terrain.starts, [...E.startPositions(24, 3, null)].sort((a, b) => a - b), "regiões iniciais guardadas");
  assert.notEqual(JSON.stringify(fx.state.timeline), JSON.stringify(base.state.timeline), "com efeitos a partida devia mudar");
  const f1 = E.runFixedGame(c, { eras: 20, profiles: profs, civCount: 3, seed: E.SEED, terrain: { type: "padrao", effects: true } });
  const f0 = E.runFixedGame(c, { eras: 20, profiles: profs, civCount: 3, seed: E.SEED });
  assert.notEqual(JSON.stringify(f1), JSON.stringify(f0));
});

// ── No navegador (versão do jogador) ──

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

async function startFromSetup(page, { effects = null, ai = 1, map = null } = {}) {
  await page.locator("#homeStart").click();
  await page.locator(`#homeOpponents [data-ai="${ai}"]`).click();
  if (effects !== null || map) await openCustomize(page);
  if (map) await page.locator(map === "sorteado" ? "#mapRandom" : "#mapFixed").click();
  if (effects !== null) await page.locator(effects ? "#terrEffects" : "#terrVisual").click();
  await page.locator("#setupStart").click();
  const confirm = page.locator('#modalRoot button:has-text("Nova partida")');
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  await page.evaluate(() => { state.ui.skipIdleWarning = true; });
}

test("opção Terrenos em Personalizar: Só visual de fábrica; Com efeitos muda resumos e partida, e a escolha fica para a próxima", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.equal(await page.locator("#terrVisual").getAttribute("aria-pressed"), "true", "o padrão de fábrica devia ser Só visual");
  assert.equal(await page.locator("#terrEffects").getAttribute("aria-pressed"), "false");
  assert.match(await page.locator("#terrVisual").innerText(), /Só visual/);
  assert.match(await page.locator("#terrEffects").innerText(), /Com efeitos/);
  assert.match(await page.locator("#terrFxDesc").innerText(), /só enfeita o mapa/);
  assert.doesNotMatch(await page.locator("#customizeSummary").innerText(), /terrenos com efeito/);
  assert.doesNotMatch(await page.locator("#setupSummary").innerText(), /terrenos com efeito/);
  await page.locator("#terrEffects").click();
  assert.equal(await page.locator("#terrEffects").getAttribute("aria-pressed"), "true");
  assert.match(await page.locator("#terrFxDesc").innerText(), /2 vantagens e 1 desvantagem/);
  assert.match(await page.locator("#customizeSummary").innerText(), /terrenos com efeito/);
  assert.match(await page.locator("#setupSummary").innerText(), /terrenos com efeito/);
  assert.deepEqual(await horizontalOverflow(page), []);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  const r = await page.evaluate(() => ({ fx: state.terrainEffects, starts: state.terrain.starts, owners: state.owners.map((o, i) => (o === "neutral" ? -1 : i)).filter((i) => i >= 0), choice: terrainEffectsChoice }));
  assert.equal(r.fx, true);
  assert.deepEqual(r.starts, r.owners);
  assert.equal(r.choice, true);
  // Próxima partida: Personalizar abre com Com efeitos; voltar a Só visual dá uma partida sem efeitos.
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = false; });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.equal(await page.locator("#terrEffects").getAttribute("aria-pressed"), "true");
  await page.locator("#terrVisual").click();
  await page.locator("#setupStart").click();
  await page.locator('#modalRoot button:has-text("Nova partida")').click().catch(() => {});
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.terrainEffects === undefined);
  assert.equal(await page.evaluate(() => terrainEffectsOn(state)), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test("save: Com efeitos sobrevive a salvar/recarregar; save antigo (sem o campo) abre Só visual", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startFromSetup(page, { effects: true, ai: 2, map: "sorteado" });
  await page.evaluate(() => { P(state).military = 30; });
  const before = await page.evaluate(async () => { playEra({ military: P(state).treasury, infrastructure: 0, technology: 0 }); await saveGame(); return { t: state.terrain, fx: state.terrainEffects, era: state.era, owners: state.owners, def: state.owners.map((_, i) => territoryDefense(state, i, configApplied)) }; });
  assert.equal(before.fx, true);
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true);
  const after = await page.evaluate(() => ({ t: state.terrain, fx: state.terrainEffects, era: state.era, owners: state.owners, def: state.owners.map((_, i) => territoryDefense(state, i, configApplied)), choice: terrainEffectsChoice }));
  assert.deepEqual({ ...after, choice: undefined }, { ...before, choice: undefined }, "a partida com efeitos mudou ao recarregar");
  assert.equal(after.choice, true, "a escolha Com efeitos devia vir do save");
  // Save antigo: sem state.terrainEffects (e sem as regiões iniciais).
  await page.evaluate(async (k) => { const o = JSON.parse(await storage.get(k)); delete o.state.terrainEffects; delete o.state.terrain.starts; await storage.set(k, JSON.stringify(o)); }, KEYS.save);
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true);
  const old = await page.evaluate(() => ({ on: terrainEffectsOn(state), choice: terrainEffectsChoice, fx: state.terrainEffects, def: state.owners.map((_, i) => territoryDefense(state, i, configApplied)), plain: (() => { const s = JSON.parse(JSON.stringify(state)); delete s.terrain; return s.owners.map((_, i) => territoryDefense(s, i, configApplied)); })() }));
  assert.equal(old.on, false);
  assert.equal(old.choice, false);
  assert.equal(old.fx, undefined, "o save antigo não devia ser alterado ao abrir");
  assert.deepEqual(old.def, old.plain, "save antigo com regras de terreno");
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = true; renderAll(); openSheet("terrainSheet"); });
  assert.match(await page.locator("#terrainSheet").innerText(), /Nesta partida o terreno é só visual/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("tutorial usa sempre Só visual e devolve a escolha Com efeitos do jogador depois", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const r = await page.evaluate(() => {
    setTerrainEffectsChoice(true);
    newTutorialGame();
    const during = { fx: terrainEffectsOn(state), choice: terrainEffectsChoice, prev: state.tutorial.prevSetup.terrainEffects };
    restoreSetupAfterTutorial();
    const after = terrainEffectsChoice;
    state = newGame();
    return { during, after, next: terrainEffectsOn(state) };
  });
  assert.deepEqual(r.during, { fx: false, choice: false, prev: true });
  assert.equal(r.after, true);
  assert.equal(r.next, true);
  assert.deepEqual(errors, []);
  await context.close();
});

test("folha da região com efeitos: linha + · + · − do terreno, custo com o terreno; ⓘ Terrenos e Como jogar ligados e desligados", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startFromSetup(page, { effects: true });
  // Um alvo de Pântano com dono (custo +20%) e um de Montanha com dono (+4 defesa), vizinhos do jogador.
  const t = await page.evaluate(() => {
    const t = eligibleTargets(state, "player").map((x) => x.i);
    state.terrain.list[t[0]] = "pantano"; state.owners[t[0]] = state.civs[1].id;
    P(state).military = 80; renderAll(); return t[0];
  });
  await page.locator(`[data-territory="${t}"]`).click();
  await page.locator("#attackSheet").waitFor({ state: "visible" });
  const sheet = await page.evaluate((t) => ({
    line: document.querySelector("#mapStatus .tgt-terrain .ter-eff")?.innerText.trim(),
    cost: document.querySelector("#mapStatus .tgt-num b")?.innerText.trim(),
    need: fmt(attackNeed(state, t, "player", configApplied), 1),
    plain: (() => { const s = JSON.parse(JSON.stringify(state)); delete s.terrainEffects; return attackNeed(s, t, "player", configApplied); })(),
    real: attackNeed(state, t, "player", configApplied),
    tip: document.querySelector("#mapStatus .tgt-info div")?.textContent,
  }), t);
  assert.equal(sheet.line, "+20% Ciência · atacar custa +20% · −20% ouro");
  assert.equal(sheet.cost, sheet.need, "o custo mostrado devia incluir o terreno");
  assert.ok(Math.abs(sheet.real - sheet.plain * 1.2) < 1e-9, "custo do Pântano com dono = +20%");
  assert.match(sheet.tip, /× 1,2 \(Pântano\)/);
  await page.keyboard.press("Escape");
  // Região inicial (Campina para as regras) e região de Montanha própria.
  const own = await page.evaluate(() => { const i = state.owners.indexOf("player"); state.terrain.list[i] = "montanha"; renderAll(); return i; });
  await page.locator(`[data-territory="${own}"]`).click();
  await page.locator("#attackSheet").waitFor({ state: "visible" });
  const ownTxt = await page.locator("#mapStatus .tgt-terrain").innerText();
  assert.match(ownTxt, /Montanha/);
  assert.match(ownTxt, /\+20% ouro · \+5% Obras · −2 defesa/);
  assert.match(ownTxt, /Região inicial: conta como Campina/);
  await page.keyboard.press("Escape");
  // ⓘ Terrenos ligado: 7 linhas com os efeitos.
  await page.locator("#terrainBtn").click();
  const ts = page.locator("#terrainSheet");
  await ts.waitFor({ state: "visible" });
  const items = await ts.locator(".ter-list li").allInnerTexts();
  assert.equal(items.length, 7);
  const want = await page.evaluate(() => TERRAINS.map((k) => TERRAIN_EFFECT_TEXT[k].join(" · ")));
  items.forEach((x, k) => { assert.match(x, new RegExp(`^${NAMES[k]}`)); assert.ok(x.includes(want[k]), `${NAMES[k]} sem os efeitos`); });
  assert.match(await ts.innerText(), /Nesta partida os terrenos têm efeito/);
  assert.doesNotMatch(await ts.innerText(), /só visual/);
  for (const li of await ts.locator(".ter-list li").all()) assert.ok((await li.boundingBox()).height >= 48);
  assert.deepEqual(await horizontalOverflow(page), []);
  await page.keyboard.press("Escape");
  await ts.waitFor({ state: "hidden" });
  // Como jogar (folha ?) ligado.
  await page.evaluate(() => openSheet("howTo"));
  const how = await page.locator("#howTo").innerText();
  for (const w of want) assert.ok(how.includes(w), "Como jogar sem: " + w);
  assert.match(how, /Nesta partida os terrenos têm efeito/);
  await page.keyboard.press("Escape");
  // Desligado: sem as linhas, com o aviso "só visual"; a folha da região só mostra o terreno.
  await page.evaluate(() => { setTerrainEffectsChoice(false); state = newGame(); state.ui.skipIdleWarning = true; renderAll(); });
  await page.locator("#terrainBtn").click();
  await ts.waitFor({ state: "visible" });
  assert.match(await ts.innerText(), /Nesta partida o terreno é só visual/);
  assert.equal(await ts.locator(".ter-eff").count(), 0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => openSheet("howTo"));
  assert.match(await page.locator("#howTo").innerText(), /Nesta partida o terreno é só visual/);
  assert.equal(await page.locator("#howTo .ter-eff").count(), 0);
  await page.keyboard.press("Escape");
  const t2 = await page.evaluate(() => eligibleTargets(state, "player")[0].i);
  await page.locator(`[data-territory="${t2}"]`).click();
  await page.locator("#attackSheet").waitFor({ state: "visible" });
  assert.equal(await page.locator("#mapStatus .tgt-terrain .ter-eff").count(), 0);
  // Como jogar da tela inicial segue a partida atual (só visual).
  await page.keyboard.press("Escape");
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = false; });
  await page.locator("#homeHowTo").click();
  assert.match(await page.locator("#howToScreen").innerText(), /Nesta partida o terreno é só visual/);
  assert.deepEqual(errors, []);
  await context.close();
});
