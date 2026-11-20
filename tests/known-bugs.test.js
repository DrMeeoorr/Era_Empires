// BUGS CONHECIDOS — testes que descrevem o comportamento CORRETO e que hoje falham ficam marcados com
// test.todo ("BUG: ..."): aparecem no relatório como "# TODO" e não quebram `npm test`.
// Quando o bug é corrigido, o teste perde o test.todo e passa a ser um teste normal.
// Hoje não há bugs conhecidos em aberto: os testes abaixo são de bugs já corrigidos (proteção contra regressão).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, screenshot, MOBILE_SCREENS } = require("./helpers");
const { playTutorial } = require("./tutorial-helpers");

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

/** Balão do tutorial em relação ao elemento destacado: cobertura, lado, linhas da dica e seta. */
const focusVisibility = (page) =>
  page.evaluate(() => {
    const f = document.querySelector(".tut-focus"), bx = document.getElementById("tutBox");
    if (!f || bx.hidden) return null;
    const a = f.getBoundingClientRect(), c = bx.getBoundingClientRect();
    const top = Math.max(0, a.top), bot = Math.min(innerHeight, a.bottom), vis = Math.max(0, bot - top);
    const cover = Math.max(0, Math.min(bot, c.bottom) - Math.max(top, c.top)) * (Math.min(a.right, c.right) > Math.max(a.left, c.left) ? 1 : 0);
    const tip = bx.querySelector(".tut-tip"), lh = parseFloat(getComputedStyle(tip).lineHeight);
    const upper = a.top + a.height / 2 < innerHeight / 2, below = c.top >= a.bottom - 1, above = c.bottom <= a.top + 1;
    const spot = document.getElementById("tutSpot").getBoundingClientRect();
    return { target: f.id || f.className, height: Math.round(a.height), uncovered: Math.round(vis - cover), lines: Math.round(tip.getBoundingClientRect().height / lh),
      side: below ? "below" : above ? "above" : "over", upper, arrow: bx.classList.contains(below ? "below" : "above"),
      inScreen: c.top >= -1 && c.bottom <= innerHeight + 1 && c.left >= -1 && c.right <= innerWidth + 1,
      spotOk: spot.left <= a.left + 1 && spot.right >= a.right - 1 && spot.top <= a.top + 1 && spot.bottom >= a.bottom - 1 };
  });

// Tutorial da Fase 3 (5 passos): o balão nunca cobre o alvo, fica do lado oposto (alvo em cima → balão embaixo e
// vice-versa, salvo se não couber), a dica tem no máximo 2 linhas, a seta aponta para o alvo e o destaque o envolve.
// Também com a fonte larga (DejaVu Sans) no celular mais estreito.
for (const [name, opts, wide] of [...MOBILE_SCREENS.map(([n, o]) => [n, o, false]), [MOBILE_SCREENS[1][0], MOBILE_SCREENS[1][1], true]]) {
  test(`tutorial — o balão não tapa o alvo, fica do lado oposto e a dica tem até 2 linhas (${name}${wide ? ", fonte larga" : ""})`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" }, offerTutorial: true });
    if (wide) await page.addStyleTag({ content: '*{font-family:"DejaVu Sans",sans-serif!important}' });
    const problems = [], seen = [];
    await playTutorial(page, {
      onStep: async (n) => {
        const v = await focusVisibility(page);
        if (!v) { problems.push(`passo ${n}: sem balão`); return; }
        seen.push(n);
        if (v.uncovered < v.height - 1) { problems.push(`passo ${n} (${v.target}): balão cobre ${v.height - v.uncovered}px do alvo`); await screenshot(page, `BUG-tutorial-${name}-passo${n}`); }
        if (v.side === "over") problems.push(`passo ${n}: balão nem acima nem abaixo do alvo`);
        else if (v.side !== (v.upper ? "below" : "above")) problems.push(`passo ${n}: balão do mesmo lado do alvo (${v.side})`);
        if (!v.arrow) problems.push(`passo ${n}: seta não aponta para o alvo`);
        if (v.lines > 2) problems.push(`passo ${n}: dica com ${v.lines} linhas`);
        if (!v.inScreen) problems.push(`passo ${n}: balão sai da tela`);
        if (!v.spotOk) problems.push(`passo ${n}: destaque não envolve o alvo`);
        const txt = await page.evaluate(() => document.getElementById("tutBox").innerText);
        if (/\bClique\b/.test(txt)) problems.push(`passo ${n}: texto diz "Clique" (no celular é "Toque")`);
      },
    });
    assert.deepEqual(seen, [1, 2, 3, "3b", 4, "4b", 5]);
    assert.deepEqual(errors, []);
    await context.close();
    assert.deepEqual(problems, [], "balão do tutorial");
  });
}
