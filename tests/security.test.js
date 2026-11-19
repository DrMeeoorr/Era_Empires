// Segurança: texto vindo do save (localStorage) ou de ficheiros importados nunca pode virar código.
// No GitHub Pages todos os projetos de usuario.github.io partilham o mesmo localStorage, por isso
// outra página poderia gravar um save "envenenado".
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, KEYS } = require("./helpers");

const EVIL = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

test("escapeHtml e cssColor neutralizam HTML e cores inválidas", async () => {
  const { context, page } = await openGame(browser);
  const r = await page.evaluate(() => ({
    e: escapeHtml(`<a href="x" title='y'>&</a>`), n: escapeHtml(null), num: escapeHtml(5),
    c1: cssColor("#2c9d87"), c2: cssColor("red;background:url(x)"), c3: cssColor(undefined),
  }));
  await context.close();
  assert.equal(r.e, "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(r.n, "");
  assert.equal(r.num, "5");
  assert.equal(r.c1, "#2c9d87");
  assert.equal(r.c2, "#888888");
  assert.equal(r.c3, "#888888");
});

test("save com nome de IA, cor e registo maliciosos não executa código (mapa, placar, relatório, resultado)", async () => {
  const { context, page, errors } = await openGame(browser);
  await page.evaluate(([k, evil]) => {
    configApplied = clone(DEFAULTS); configApplied.map.aiCount = 2;
    const s = newGame();
    s.civs[1].name = evil;
    s.civs[2].name = "IA <b>2</b>";
    s.civs[1].color = 'red" onmouseover="window.__xss=1';
    s.civs[1].chartColor = "red;}</style>" + evil;
    s.log.unshift({ era: 1, text: "⚔️ " + evil + " conquistou: território 3" });
    localStorage.setItem(k, JSON.stringify({ v: 1, savedAt: Date.now(), gameMode: "slow", config: configApplied, state: s, opponentChoices, difficulty: "medio" }));
  }, [KEYS.save, EVIL]);
  await page.reload();
  await page.waitForFunction(() => typeof state !== "undefined" && !!state);
  // O save pode ser aceite (o nome é só texto) — se for, o nome tem de aparecer como texto.
  const loaded = await page.evaluate((evil) => state.civs[1]?.name === evil, EVIL);
  await page.locator("#homeContinue, #homeStart").first().waitFor();
  if (loaded) {
    await page.evaluate(() => { document.getElementById("homeScreen").hidden = true; renderAll(); });
    const legend = await page.locator("#mapLegend").innerText();
    assert.ok(legend.includes(EVIL), "o nome devia aparecer como texto na legenda do mapa");
    assert.ok((await page.locator("#mapLegend b").count()) === 0, "HTML do nome foi interpretado");
    // Concluir eras: relatório da era, notificações, placar; depois a tela de resultado.
    await page.evaluate(() => { state.ui.skipReport = false; });
    await page.evaluate(() => { playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => showEraReport(state.era - 1));
    await dismissModals(page);
    await page.evaluate(() => { while (!state.result) playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
    await page.waitForTimeout(150);
    await dismissModals(page);
  }
  await page.waitForTimeout(400); // dá tempo a um <img src=x> falhar e disparar onerror
  assert.equal(await page.evaluate(() => window.__xss), undefined, "código do save foi executado");
  assert.equal(await page.locator("img").count(), 0, "um <img> do save foi inserido na página");
  assert.deepEqual(errors.filter((e) => !/pedido falhou/.test(e)), []);
  await context.close();
});
