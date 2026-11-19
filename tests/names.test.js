// Nomes aprovados (docs/decisoes.md, "Textos pt-BR e nomes") na versão do jogador:
// - rivais "Cores" com símbolo (▲ Rubro, ● Ocre, ◆ Anil, ■ Violeta, ✚ Turquesa) e "★ Você";
// - regiões com nome no mapa (nome + número pequeno), no painel de ataque, no relatório e no registro;
// - nenhum "território N" nem "IA"/"IA 2" genérico nas telas do jogador.
// Os nomes são só de exibição: as simulações (impressão digital) continuam iguais (tests/fingerprint.test.js).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, concludeEraUI, MOBILE_SCREENS } = require("./helpers");
const { playTutorial } = require("./tutorial-helpers");

const PIXEL = MOBILE_SCREENS[0][1];
const REGIONS = ["Arvela", "Brumas", "Cardo", "Dorna", "Esmera", "Fenda", "Gralha", "Hélia", "Ivara", "Jaspe", "Lumen", "Musgo",
  "Névoa", "Ombral", "Pedral", "Quartzo", "Rochedo", "Salgar", "Torva", "Urzal", "Vau", "Velar", "Xisto", "Zênite"];
const RIVALS = [["▲", "Rubro"], ["●", "Ocre"], ["◆", "Anil"], ["■", "Violeta"], ["✚", "Turquesa"]];

// "território 9" / "Território 12" e "IA"/"IA 2" usados como nome de um rival.
// "controlados pela IA" (texto da tela inicial) descreve os rivais, não é um nome.
function genericNames(where, text, problems) {
  for (const re of [/territ[óo]rio \d+/gi, /\bIAs?\b(?: \d)?/g]) {
    for (const m of text.matchAll(re)) {
      const ctx = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, " ");
      if (/controlados pela IA/.test(ctx)) continue;
      problems.push(`${where}: "${m[0]}" → "…${ctx}…"`);
    }
  }
}
const bodyText = (page) => page.evaluate(() => document.body.innerText);

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

test("nomes: rivais com nome e símbolo, regiões com nome no mapa, no painel de ataque, no relatório e no resultado", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const problems = [];
  // Configurar partida: 3 rivais, o 2.º com estilo "Aleatório" (fica oculto até o fim).
  await page.locator("#homeStart").click();
  await page.locator('#homeOpponents [data-ai="3"]').click();
  const rows = await page.locator("#homeProfiles .profile-row > span").allInnerTexts();
  assert.deepEqual(rows.map((t) => t.trim()), ["▲ Rubro", "● Ocre", "◆ Anil"], "configurar partida: rivais sem nome/símbolo");
  await page.locator('#homeProfiles [data-prof="0"]').selectOption("adaptive");
  await page.locator('#homeProfiles [data-prof="1"]').selectOption("random");
  await page.locator('#homeProfiles [data-prof="2"]').selectOption("aggressive");
  genericNames("configurar partida", await bodyText(page), problems);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden);

  // Nomes no estado da partida do jogador; o motor continua a chamar o jogador "Jogador".
  assert.deepEqual(await page.evaluate(() => state.civs.map((c) => c.name)), ["Jogador", "Rubro", "Ocre", "Anil"]);

  // Legenda do mapa: símbolo + nome + estilo (oculto para o "Aleatório").
  const legend = await page.locator("#mapLegend").innerText();
  for (const s of ["★ Você", "▲ Rubro · Adaptativo", "● Ocre · estilo oculto", "◆ Anil · Agressivo"])
    assert.ok(legend.replace(/\s+/g, " ").includes(s), `legenda sem "${s}": ${legend}`);

  // Mapa: nome + número em cada região; aria-label com nome, número e dono.
  const cells = await page.evaluate(() => [...document.querySelectorAll("[data-territory]")].map((c) => ({
    i: +c.dataset.territory, name: c.querySelector(".rname")?.textContent, text: c.innerText.replace(/\s+/g, " "), aria: c.getAttribute("aria-label"),
  })));
  assert.equal(cells.length, 24);
  for (const c of cells) {
    assert.equal(c.name, REGIONS[c.i], `região ${c.i + 1} sem o nome aprovado`);
    assert.match(c.text, new RegExp(`\\b${c.i + 1}\\b`), `região ${REGIONS[c.i]} sem o número`);
    assert.match(c.aria, new RegExp(`^${REGIONS[c.i]}, região ${c.i + 1}, (livre|sua|de (Rubro|Ocre|Anil))`), `aria-label: ${c.aria}`);
  }
  assert.match(cells[0].text, /★/, "região do jogador sem ★");
  assert.match(cells[0].aria, /, sua/);
  assert.match(cells[23].text, /▲/, "região do Rubro sem ▲");
  assert.match(cells[23].aria, /de Rubro/);

  // Painel de ataque: nome da região-alvo e do dono.
  await page.locator('[data-plan="attack"]').click();
  await concludeEraUI(page);
  const t = await page.evaluate(() => eligibleTargets(state, "player")[0].i);
  await page.locator(`[data-territory="${t}"]`).click();
  const panel = await page.locator("#mapStatus").innerText();
  assert.ok(panel.includes(REGIONS[t]), `painel de ataque sem o nome da região: ${panel}`);
  genericNames("painel de ataque", await bodyText(page), problems);
  // Rival como alvo: "de ▲ Rubro".
  await page.evaluate(() => { state.owners[1] = "ai"; selectedTerritory = 1; renderAll(); });
  const rivalPanel = (await page.locator("#mapStatus").innerText()).replace(/\s+/g, " ");
  assert.match(rivalPanel, /Brumas 2 · de ▲ Rubro/, `painel de ataque com rival: ${rivalPanel}`);
  await page.evaluate(() => { state.owners[1] = "neutral"; selectedTerritory = null; renderAll(); });

  // Placar (depois da 1.ª era) com símbolo e nome.
  const strip = (await page.locator("#scoreStrip").innerText()).replace(/\s+/g, " ");
  for (const s of ["★ Você", "▲ Rubro", "● Ocre", "◆ Anil"]) assert.ok(strip.includes(s), `placar sem "${s}": ${strip}`);

  // Ordem dada e relatório da era com o nome da região conquistada.
  await page.locator(`[data-territory="${t}"]`).click();
  await page.locator("#attack").click();
  assert.ok((await page.locator("#mapStatus").innerText()).includes(REGIONS[t]), "mensagem da ordem sem o nome da região");
  await page.evaluate(() => { state.ui.skipReport = false; state.ui.skipIdleWarning = true; state.forcedAttack = { owner: "player", win: true }; });
  await page.locator("#advance").click();
  await page.waitForSelector("#modalRoot .report", { timeout: 3000 });
  const report = await page.locator("#modalRoot .report").innerText();
  assert.ok(report.includes(REGIONS[t]), `relatório sem o nome da região: ${report}`);
  genericNames("relatório da era", await bodyText(page), problems);
  await dismissModals(page);

  // Registro de eventos: textos do motor ("território N", "pelo território N") mostrados com o nome.
  const shown = await page.evaluate(() => [
    "⚔️ Rubro conquistou: território 3 (de Jogador).",
    "↩️ Ordem de Ocre contra o território 4 cancelada: o alvo mudou de dono e a defesa subiu para 12; poder devolvido.",
    "⚔️ Batalha pelo território 5: Anil venceu Você (força 12 × 8); Você perdeu 8 pontos.",
    "☠️ Ocre perdeu o último território e foi eliminada.",
  ].map(uiText));
  assert.deepEqual(shown, [
    "⚔️ Rubro conquistou: Cardo (seu).",
    "↩️ Ordem de Ocre contra Dorna cancelada: o alvo mudou de dono e a defesa subiu para 12; Força devolvida.",
    "⚔️ Batalha por Esmera: Anil venceu você (Força 12 × 8); Você perdeu 8 de Força.",
    "☠️ Ocre perdeu o último território e foi eliminado.",
  ]);

  // Condições de vitória e jogo com "Como jogar"/"Detalhes" abertos.
  await page.evaluate(() => { document.getElementById("howTo").open = true; document.getElementById("details").open = true; renderAll(); });
  const victory = (await page.locator("#victoryPanel").innerText()).replace(/\s+/g, " ");
  for (const s of ["▲ Rubro · Adaptativo", "● Ocre · estilo oculto", "◆ Anil · Agressivo"]) assert.ok(victory.includes(s), `condições de vitória sem "${s}"`);
  genericNames("jogo (Como jogar e Detalhes abertos)", await bodyText(page), problems);

  // Resultado: estilo revelado, com nome e símbolo.
  await page.evaluate(() => { state.ui.skipReport = true; while (!state.result) playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
  await page.waitForTimeout(200);
  await dismissModals(page);
  const result = (await page.locator("#resultBanner").innerText()).replace(/\s+/g, " ");
  assert.match(result, /▲ Rubro jogou como Adaptativo/);
  assert.match(result, /● Ocre jogou como \S+ \(sorteado\)/);
  assert.match(result, /◆ Anil jogou como Agressivo/);
  assert.doesNotMatch(result, /estilo oculto/);
  genericNames("tela de resultado", await bodyText(page), problems);

  assert.deepEqual(errors, []);
  await context.close();
  assert.deepEqual(problems, [], "\"território N\" ou \"IA\" genérico visível ao jogador");
});

test("nomes: 5 rivais com nomes e símbolos na ordem dos assentos", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const r = await page.evaluate(() => {
    configApplied.map.aiCount = 5; state = newGame(); document.getElementById("homeScreen").hidden = true; renderAll();
    return { names: state.civs.map((c) => c.name), legend: document.getElementById("mapLegend").innerText.replace(/\s+/g, " "), colors: state.civs.map((c) => c.color) };
  });
  assert.deepEqual(r.names, ["Jogador", ...RIVALS.map(([, n]) => n)]);
  for (const [sym, name] of RIVALS) assert.ok(r.legend.includes(`${sym} ${name}`), `legenda sem "${sym} ${name}"`);
  assert.equal(new Set(r.colors).size, 6, "cores repetidas");
  assert.deepEqual(errors, []);
  await context.close();
});

test("nomes: saves antigos com \"IA\"/\"IA 2\" mostram os nomes das cores", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const legend = await page.evaluate(() => {
    configApplied.map.aiCount = 2; state = newGame(); state.civs[1].name = "IA"; state.civs[2].name = "IA 2";
    document.getElementById("homeScreen").hidden = true; renderAll();
    return document.getElementById("mapLegend").innerText.replace(/\s+/g, " ");
  });
  assert.match(legend, /▲ Rubro/);
  assert.match(legend, /● Ocre/);
  assert.doesNotMatch(legend, /\bIA\b/);
  assert.deepEqual(errors, []);
  await context.close();
});

for (const [name, opts] of MOBILE_SCREENS) {
  test(`nomes: em ${name} os nomes das regiões cabem no quadrado e o toque tem ≥ 48 px de altura`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: opts });
    const cells = await page.evaluate(() => {
      document.getElementById("homeScreen").hidden = true; renderAll();
      return [...document.querySelectorAll("[data-territory]")].map((c) => {
        const n = c.querySelector(".rname"), cs = getComputedStyle(c);
        const inner = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return { name: n.textContent, w: n.scrollWidth, inner, h: c.getBoundingClientRect().height, font: parseFloat(getComputedStyle(n).fontSize) };
      });
    });
    for (const c of cells) {
      assert.ok(c.w <= c.inner + 0.5, `${name}: "${c.name}" corta (${c.w} px num espaço de ${c.inner} px)`);
      assert.ok(c.h >= 48, `${name}: região ${c.name} com ${c.h} px de altura`);
      assert.ok(c.font >= 8.5, `${name}: fonte de "${c.name}" pequena demais (${c.font} px)`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("nomes: tutorial fala do rival e da região pelo nome", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL, offerTutorial: true });
  const problems = [], texts = {};
  await playTutorial(page, {
    onStep: async (n) => {
      texts[n] = (await page.evaluate(() => document.getElementById("tutBox").innerText)).replace(/\s+/g, " ");
      genericNames(`tutorial passo ${n}`, texts[n], problems);
    },
  });
  assert.match(texts[1], /★ Você \(verde\) e o rival ▲ Rubro/);
  assert.match(texts[5], /Toque em Ivara \(9\)/);
  assert.match(texts[9], /▲ Rubro atacou \S+ \(\d+\), um território seu|Os rivais também atacam/);
  assert.deepEqual(errors, []);
  await context.close();
  assert.deepEqual(problems, [], "\"território N\" ou \"IA\" genérico no tutorial");
});
