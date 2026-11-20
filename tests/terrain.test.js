// Terrenos do mapa (20/11/2026): tabela padrão, sorteio com semente própria e regras, save, opção "Mapa" em
// Personalizar, folha "ⓘ Terrenos", região escolhida (resto escurecido), ordem "⚔ ordem", fronteira + bandeira
// do dono, selo de espadas (sem o tracejado antigo) e nomes legíveis nos 3 celulares (também com fonte larga).
// O terreno é só visual: nenhuma regra muda (a impressão digital fica em tests/fingerprint.test.js).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launch, openGame, openCustomize, horizontalOverflow, MOBILE_SCREENS, KEYS } = require("./helpers");

const SRC = path.resolve(__dirname, "..", "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const PIXEL = MOBILE_SCREENS[0][1];
// Rodada de balanceamento de 20/11/2026 (aprovada): Jaspe ↔ Rochedo — Jaspe Montanha, Rochedo Colinas.
const APPROVED = ["campina", "pantano", "campina", "colinas", "campina", "tundra", "floresta", "deserto", "campina", "montanha", "tundra", "floresta", "pantano", "floresta", "colinas", "montanha", "colinas", "deserto", "pantano", "campina", "campina", "floresta", "montanha", "campina"];
const NAMES = ["Campina", "Floresta", "Colinas", "Montanha", "Deserto", "Pântano", "Tundra"];
const WIDE_FONT = '*{font-family:"DejaVu Sans",sans-serif!important}';

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

// ── Sem navegador ──

test("terrenos: o mapa padrão é a tabela aprovada (Jaspe montanha, Rochedo colinas, Musgo floresta, Salgar deserto…)", async () => {
  const T = await load("core/terrain.js"), N = await load("core/names.js");
  assert.deepEqual([...T.DEFAULT_TERRAIN], APPROVED);
  assert.ok(Object.isFrozen(T.DEFAULT_TERRAIN));
  assert.deepEqual(T.TERRAINS.map((k) => T.TERRAIN_NAMES[k]), NAMES);
  const by = (name) => T.DEFAULT_TERRAIN[N.REGION_NAMES ? N.REGION_NAMES.indexOf(name) : -1];
  if (N.REGION_NAMES) { assert.equal(by("Jaspe"), "montanha"); assert.equal(by("Rochedo"), "colinas"); assert.equal(by("Musgo"), "floresta"); assert.equal(by("Salgar"), "deserto"); }
  const p = T.makeMapTerrain("padrao", null, [0, 23]);
  assert.deepEqual(p, { type: "padrao", seed: null, list: APPROVED });
  // Tipo desconhecido também cai no padrão.
  assert.equal(T.makeMapTerrain("outro", 5, [0]).type, "padrao");
});

test("terrenos: o sorteio é determinístico pela semente e cumpre todas as regras (muitas sementes, 1–6 impérios, posição fixa e aleatória)", async () => {
  const T = await load("core/terrain.js"), M = await load("core/map.js");
  let checked = 0, maxTries = 0;
  const distinct = new Set();
  const realRandom = Math.random;
  Math.random = () => { throw new Error("o sorteio dos terrenos não pode usar Math.random"); };
  try {
    for (let civs = 1; civs <= 6; civs++) {
      for (let k = 0; k < 400; k++) {
        const seed = (Math.imul(k + 1, 2654435761) ^ civs) >>> 0;
        // Posições fixas (padrão do jogo) e aleatórias (opção "Posição inicial aleatória").
        let s = (seed ^ 0x9e3779b9) >>> 0;
        const rng = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
        for (const starts of [civs === 1 ? [0] : M.startPositions(24, civs, null), M.startPositions(24, civs, rng)]) {
          const a = T.rollTerrain(seed, starts), b = T.rollTerrain(seed, starts);
          assert.deepEqual(a, b, `semente ${seed}: o sorteio não é determinístico`);
          assert.equal(a.list.length, 24);
          assert.ok(a.tries >= 1 && a.tries <= T.TERRAIN_MAX_TRIES, `semente ${seed}: caiu no mapa padrão`);
          assert.deepEqual(T.terrainProblems(a.list, starts), [], `semente ${seed}, inícios ${starts}`);
          // Nova tentativa com a semente seguinte: a tentativa N é a 1.ª tentativa de seed+N-1.
          if (a.tries > 1) assert.deepEqual(T.rollTerrain(seed + a.tries - 1, starts).list, a.list);
          maxTries = Math.max(maxTries, a.tries);
          distinct.add(a.list.join());
          checked++;
        }
        const m = T.makeMapTerrain("sorteado", seed, [0, 23]);
        assert.equal(m.type, "sorteado");
        assert.equal(m.seed, seed);
        assert.deepEqual(m.list, T.rollTerrain(seed, [0, 23]).list);
      }
    }
  } finally { Math.random = realRandom; }
  assert.ok(checked >= 4800);
  assert.ok(distinct.size > checked * 0.9, `mapas sorteados pouco variados (${distinct.size} de ${checked})`);
  // As regras de terrainProblems apanham mapas ruins.
  const bad = [...APPROVED];
  assert.ok(T.terrainProblems(bad, [0, 23]).some((p) => /deserto fora do sul/.test(p)));
  assert.ok(T.terrainProblems(Array(24).fill("campina"), [0]).some((p) => /floresta: 0/.test(p)));
  assert.ok(T.terrainProblems(["montanha", ...APPROVED.slice(1)], [0]).some((p) => /não é Campina/.test(p)));
});

test("terrenos: saves antigos ou dados estranhos usam o mapa padrão", async () => {
  const T = await load("core/terrain.js");
  const owners = Array(24).fill("neutral");
  assert.deepEqual(T.terrainOf({ owners }), APPROVED);
  assert.deepEqual(T.terrainOf({ owners, terrain: { type: "sorteado", list: ["lava", ...APPROVED.slice(1)] } }), APPROVED);
  assert.deepEqual(T.terrainOf({ owners, terrain: { type: "sorteado", list: APPROVED.slice(1) } }), APPROVED);
  assert.deepEqual(T.terrainOf({ owners, terrain: "<script>" }), APPROVED);
  assert.equal(T.mapTypeOf({ owners }), "padrao");
  const list = T.rollTerrain(7, [0, 23]).list;
  assert.deepEqual(T.terrainOf({ owners, terrain: { type: "sorteado", seed: 7, list } }), list);
  assert.equal(T.mapTypeOf({ owners, terrain: { type: "sorteado", seed: 7, list } }), "sorteado");
});

// ── No navegador (versão do jogador) ──

async function startFromSetup(page, { map = null, ai = 1 } = {}) {
  await page.locator("#homeStart").click();
  await page.locator(`#homeOpponents [data-ai="${ai}"]`).click();
  if (map) { await openCustomize(page); await page.locator(map === "sorteado" ? "#mapRandom" : "#mapFixed").click(); }
  await page.locator("#setupStart").click();
  const confirm = page.locator('#modalRoot button:has-text("Nova partida")');
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  await page.evaluate(() => { state.ui.skipIdleWarning = true; });
}
const domTerrain = (page) => page.evaluate(() => [...document.querySelectorAll("#map .lands path[data-region]")].map((p) => p.dataset.terrain));

test("opção Mapa em Personalizar: Padrão de fábrica, Sorteado muda resumos e partida, e a escolha fica para a próxima", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.equal(await page.locator("#mapFixed").getAttribute("aria-pressed"), "true", "o padrão de fábrica devia ser Padrão");
  assert.equal(await page.locator("#mapRandom").getAttribute("aria-pressed"), "false");
  assert.match(await page.locator("#mapFixed").innerText(), /Padrão\s*sempre igual/);
  assert.match(await page.locator("#mapRandom").innerText(), /Sorteado\s*novo a cada partida/);
  assert.match(await page.locator("#mapDesc").innerText(), /sempre o mesmo terreno/);
  assert.doesNotMatch(await page.locator("#customizeSummary").innerText(), /mapa sorteado/);
  await page.locator("#mapRandom").click();
  assert.equal(await page.locator("#mapRandom").getAttribute("aria-pressed"), "true");
  assert.match(await page.locator("#mapDesc").innerText(), /mudam a cada partida/);
  assert.match(await page.locator("#customizeSummary").innerText(), /mapa sorteado/);
  assert.match(await page.locator("#setupSummary").innerText(), /mapa sorteado/);
  assert.deepEqual(await horizontalOverflow(page), []);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  const r = await page.evaluate(() => ({ t: state.terrain, starts: state.owners.map((o, i) => (o === "neutral" ? -1 : i)).filter((i) => i >= 0), probs: null }));
  assert.equal(r.t.type, "sorteado");
  assert.ok(Number.isInteger(r.t.seed) && r.t.seed >= 0);
  assert.deepEqual(await page.evaluate((r) => terrainProblems(r.t.list, r.starts), r), []);
  assert.deepEqual(await page.evaluate((s) => rollTerrain(s.seed, [0, 23]).list, r.t), r.t.list, "a lista guardada não é a da semente");
  assert.deepEqual(await domTerrain(page), r.t.list, "o mapa não desenha os terrenos sorteados");
  // Próxima partida: a escolha continua (Personalizar abre com Sorteado) e vem uma semente nova.
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = false; });
  await page.locator("#homeStart").click();
  await openCustomize(page);
  assert.equal(await page.locator("#mapRandom").getAttribute("aria-pressed"), "true");
  await page.locator("#mapFixed").click();
  assert.doesNotMatch(await page.locator("#setupSummary").innerText(), /mapa sorteado/);
  await page.locator("#setupStart").click();
  await page.locator('#modalRoot button:has-text("Nova partida")').click().catch(() => {});
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.terrain.type === "padrao");
  assert.deepEqual(await page.evaluate(() => state.terrain), { type: "padrao", seed: null, list: APPROVED });
  assert.deepEqual(await domTerrain(page), APPROVED);
  assert.deepEqual(errors, []);
  await context.close();
});

test("terrenos no save: recarregar mantém o mapa sorteado; save antigo (sem terrenos) abre com o mapa padrão", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startFromSetup(page, { map: "sorteado", ai: 3 });
  const before = await page.evaluate(async () => { await saveGame(); return state.terrain; });
  assert.equal(before.type, "sorteado");
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true);
  assert.deepEqual(await page.evaluate(() => state.terrain), before, "terrenos perdidos ao recarregar");
  assert.equal(await page.evaluate(() => mapType), "sorteado", "a escolha Sorteado devia vir do save");
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = true; renderAll(); });
  assert.deepEqual(await domTerrain(page), before.list);
  // Save antigo: sem state.terrain.
  await page.evaluate(async (k) => { const o = JSON.parse(await storage.get(k)); delete o.state.terrain; await storage.set(k, JSON.stringify(o)); }, KEYS.save);
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true);
  const old = await page.evaluate(() => ({ terrain: state.terrain, list: terrainOf(state), mapType, era: state.era }));
  assert.equal(old.terrain, undefined, "o save antigo não devia ser alterado ao abrir");
  assert.deepEqual(old.list, APPROVED);
  assert.equal(old.mapType, "padrao");
  await page.evaluate(() => { document.getElementById("homeScreen").hidden = true; renderAll(); });
  assert.deepEqual(await domTerrain(page), APPROVED);
  assert.deepEqual(errors, []);
  await context.close();
});

test("tutorial usa sempre o mapa padrão e devolve a escolha Sorteado do jogador depois", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const r = await page.evaluate(() => {
    setMapType("sorteado");
    newTutorialGame();
    const during = { type: state.terrain.type, list: state.terrain.list, mapType };
    restoreSetupAfterTutorial();
    const after = mapType;
    state = newGame();
    return { during, after, next: state.terrain.type };
  });
  assert.equal(r.during.type, "padrao");
  assert.deepEqual(r.during.list, APPROVED);
  assert.equal(r.during.mapType, "padrao");
  assert.equal(r.after, "sorteado");
  assert.equal(r.next, "sorteado");
  assert.deepEqual(errors, []);
  await context.close();
});

test("folha ⓘ Terrenos (7 terrenos com ícone e nome) e terrenos no Como jogar (tela inicial e \"?\" na partida)", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  // Como jogar da tela inicial.
  await page.locator("#homeHowTo").click();
  const home = await page.locator("#howToScreen .pg-card > [data-terrain-list]").first().innerText();
  for (const n of NAMES) assert.match(home, new RegExp(n), `Como jogar (tela inicial) sem ${n}`);
  assert.equal(await page.locator("#howToScreen .pg-card > [data-terrain-list] li svg.ter-ico").count() >= 7, true);
  await page.locator("#howToBack").click();
  await startFromSetup(page);
  // Botão ⓘ Terrenos ao lado da legenda.
  const btn = page.locator("#terrainBtn");
  assert.ok(await btn.isVisible());
  await btn.click();
  const sheet = page.locator("#terrainSheet");
  await sheet.waitFor({ state: "visible" });
  const items = await sheet.locator(".ter-list li").allInnerTexts();
  assert.equal(items.length, 7);
  NAMES.forEach((n, k) => assert.match(items[k], new RegExp(`^${n}`)));
  assert.equal(await sheet.locator(".ter-list li svg.ter-ico").count(), 7, "cada terreno devia ter o seu ícone");
  assert.match(await sheet.innerText(), /Mapa padrão/);
  assert.match(await sheet.innerText(), /não muda as regras/);
  for (const li of await sheet.locator(".ter-list li").all()) assert.ok((await li.boundingBox()).height >= 48, "linha da folha com menos de 48 px");
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });
  // "?" (Como jogar por cima da partida): o mesmo Como jogar da tela inicial, com os 7 terrenos.
  await page.locator("#helpBtn").click();
  await page.locator("#howToScreen").waitFor({ state: "visible" });
  const how = await page.locator("#howToScreen .pg-card > [data-terrain-list]").innerText();
  for (const n of NAMES) assert.match(how, new RegExp(n), `Como jogar (na partida) sem ${n}`);
  assert.equal(await page.locator("#howToScreen .pg-card > [data-terrain-list] li svg.ter-ico").count(), 7);
  assert.deepEqual(errors, []);
  await context.close();
});

test("mapa: fronteira lisa (você) e listrada (rivais), bandeira com símbolo em cada região com dono, espadas nos alvos e nenhum tracejado antigo", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startFromSetup(page, { ai: 3 });
  const r = await page.evaluate(() => {
    const svg = document.querySelector("#map svg.map-art");
    const owned = state.owners.map((o, i) => [o, i]).filter(([o]) => o !== "neutral");
    const fronts = Object.fromEntries([...svg.querySelectorAll(".fronts [data-front]")].map((g) => [g.dataset.front, g.querySelector("[filter='url(#mpRing)'] path").getAttribute("fill")]));
    return {
      dashed: [...svg.querySelectorAll("[stroke-dasharray]")].length + [...document.querySelectorAll("#map *")].filter((e) => getComputedStyle(e).strokeDasharray !== "none" && e.namespaceURI.endsWith("svg")).length,
      flags: [...svg.querySelectorAll(".flags [data-flag]")].map((g) => [+g.dataset.flag, g.querySelector("text").textContent]),
      owned: owned.map(([o, i]) => [i, civSym(getCiv(state, o))]),
      fronts, civs: state.civs.map((c) => c.id),
      targets: eligibleTargets(state, "player").map((t) => t.i).sort((a, b) => a - b),
      glow: [...svg.querySelectorAll(".targets [data-target]")].map((p) => +p.dataset.target).sort((a, b) => a - b),
      swords: svg.querySelectorAll(".marks .swd:not(.ord)").length,
      legend: document.getElementById("mapLegend").innerText.replace(/\s+/g, " "),
      legendFlags: document.querySelectorAll("#mapLegend .flag-ico").length,
      legendSwords: document.querySelectorAll("#mapLegend .swd-ico").length,
    };
  });
  assert.equal(r.dashed, 0, "ainda há tracejado no mapa");
  assert.deepEqual(r.flags, r.owned, "bandeira com símbolo em cada região com dono (e só nelas)");
  assert.equal(r.fronts.player, "#3fd0b2", "a sua fronteira devia ser lisa");
  for (const id of r.civs.slice(1)) assert.equal(r.fronts[id], `url(#fb-${id})`, `fronteira de ${id} devia ser listrada`);
  assert.deepEqual(r.glow, r.targets, "brilho só nas regiões que você pode atacar");
  assert.equal(r.swords, r.targets.length, "selo de espadas em cada alvo");
  assert.equal(r.legendFlags, 4);
  assert.equal(r.legendSwords, 1);
  assert.match(r.legend, /Pode atacar/);
  assert.match(r.legend, /Livre/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("região escolhida: folha mostra o terreno, o resto do mapa escurece e volta ao normal ao fechar; ordem dada mostra ⚔ ordem em dourado sólido", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startFromSetup(page);
  await page.evaluate(() => { P(state).military = 50; renderAll(); });
  const t = await page.evaluate(() => eligibleTargets(state, "player")[0].i);
  await page.locator(`[data-territory="${t}"]`).click();
  await page.locator("#attackSheet").waitFor({ state: "visible" });
  const sel = await page.evaluate((t) => ({
    dim: document.querySelectorAll("#map .selected .dim").length,
    hasSel: document.getElementById("map").classList.contains("has-sel"),
    chip: document.querySelector("#mapStatus .tgt-terrain")?.innerText.trim(),
    want: TERRAIN_NAMES[terrainOf(state)[t]],
    icon: !!document.querySelector("#mapStatus .tgt-terrain svg.ter-ico"),
    otherOpacity: getComputedStyle(document.querySelector(`[data-territory]:not([data-territory="${t}"])`)).opacity,
  }), t);
  assert.equal(sel.dim, 1, "o resto do mapa devia escurecer");
  assert.ok(sel.hasSel);
  assert.equal(sel.chip, sel.want, "a folha da região devia mostrar o terreno");
  assert.ok(sel.icon);
  assert.ok(Number(sel.otherOpacity) < 1);
  await page.keyboard.press("Escape");
  await page.locator("#attackSheet").waitFor({ state: "hidden" });
  const closed = await page.evaluate(() => ({ dim: document.querySelectorAll("#map .selected, #map .dim").length, hasSel: document.getElementById("map").classList.contains("has-sel"), sel: selectedTerritory }));
  assert.deepEqual(closed, { dim: 0, hasSel: false, sel: null }, "o escurecimento não sumiu ao fechar a folha");
  // Ordem dada.
  await page.locator(`[data-territory="${t}"]`).click();
  await page.locator("#attack").click();
  await page.waitForFunction(() => (state.orders || []).some((o) => o.owner === "player"));
  const ord = await page.evaluate((t) => ({
    tag: document.querySelector(`[data-territory="${t}"] .order-tag`)?.textContent,
    gold: document.querySelector(`#map .ordered [data-order="${t}"]`)?.getAttribute("stroke"),
    filled: document.querySelectorAll("#map .marks .swd.ord").length,
    dim: document.querySelectorAll("#map .dim").length,
  }), t);
  assert.equal(ord.tag, "⚔ ordem");
  assert.equal(ord.gold, "#f4bd50");
  assert.equal(ord.filled, 1, "a ordem devia ter as espadas cheias");
  assert.equal(ord.dim, 0);
  assert.deepEqual(errors, []);
  await context.close();
});

for (const [name, opts] of MOBILE_SCREENS) {
  for (const wide of [false, true]) {
    test(`terrenos em ${name}${wide ? " com fonte larga (DejaVu Sans)" : ""}: nomes cabem, sem rolagem lateral, ⓘ Terrenos à vista`, async () => {
      const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      for (const [map, ai] of [["padrao", 3], ["sorteado", 5]]) {
        await page.evaluate(({ map, ai }) => { setMapType(map); configApplied.map.aiCount = ai; state = newGame(); state.ui.skipIdleWarning = true; document.getElementById("homeScreen").hidden = true; renderAll(); }, { map, ai });
        const cells = await page.evaluate(() => [...document.querySelectorAll("[data-territory]")].map((c) => {
          const n = c.querySelector(".rname"), cs = getComputedStyle(c);
          return { name: n.textContent, w: n.scrollWidth, inner: c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), font: parseFloat(getComputedStyle(n).fontSize) };
        }));
        for (const c of cells) {
          assert.ok(c.w <= c.inner + 0.5, `${name} ${map}: "${c.name}" corta`);
          assert.ok(c.font >= 8.5, `${name} ${map}: fonte de "${c.name}" pequena`);
        }
        assert.deepEqual(await horizontalOverflow(page), [], `${name} ${map}: rolagem lateral`);
        const b = await page.locator("#terrainBtn").boundingBox(), vp = page.viewportSize();
        assert.ok(b && b.x >= 0 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height, `${name} ${map}: ⓘ Terrenos fora da tela`);
        await page.locator("#terrainBtn").click({ trial: true });
        // A tela da era continua sem rolagem vertical.
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), `${name} ${map}: a tela da era passou a rolar`);
      }
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
}
