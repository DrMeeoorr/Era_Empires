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

/** Quanto do elemento destacado pelo tutorial fica visível e NÃO tapado pelo balão. */
const focusVisibility = (page) =>
  page.evaluate(() => {
    const f = document.querySelector(".tut-focus"), bx = document.getElementById("tutBox");
    if (!f || bx.hidden) return null;
    const a = f.getBoundingClientRect(), c = bx.getBoundingClientRect();
    const top = Math.max(0, a.top), bot = Math.min(innerHeight, a.bottom), vis = Math.max(0, bot - top);
    const cover = Math.max(0, Math.min(bot, c.bottom) - Math.max(top, c.top));
    return { target: f.id || f.className, height: Math.round(a.height), uncovered: Math.round(vis - cover) };
  });

// Corrigido na Fase 1 de UX (o balão fica do lado com mais espaço): era test.todo "BUG:" no Galaxy S9+ e 360x640.
// Agora é teste normal nos 3 celulares (proteção contra regressão).
for (const [name, opts] of MOBILE_SCREENS) {
  test(`tutorial — o balão não pode tapar o elemento destacado no celular (${name})`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: opts, offerTutorial: true });
    const problems = [];
    await playTutorial(page, {
      onStep: async (n) => {
        // Espera o fim do scroll suave (posição estável durante 200 ms).
        await page.waitForFunction(() => new Promise((ok) => { const y = scrollY; setTimeout(() => ok(scrollY === y), 200); }), null, { polling: 50 });
        const v = await focusVisibility(page);
        if (v && v.uncovered < Math.min(40, v.height * 0.5)) {
          problems.push(`passo ${n} (${v.target}): só ${v.uncovered}px de ${v.height}px visíveis`);
          await screenshot(page, `BUG-tutorial-${name}-passo${n}`);
        }
        // A instrução de ação (👉) fica sempre visível dentro do balão, sem precisar rolar o texto.
        const cta = await page.evaluate(() => { const c = document.querySelector("#tutBox .tut-cta"), bx = document.getElementById("tutBox"); if (!c) return null; const a = c.getBoundingClientRect(), b = bx.getBoundingClientRect(); return { inside: a.top >= b.top - 1 && a.bottom <= b.bottom + 1 && a.height > 0, text: c.innerText }; });
        if (cta && !cta.inside) problems.push(`passo ${n}: instrução cortada no balão (${cta.text.slice(0, 40)}…)`);
        const txt = await page.evaluate(() => document.getElementById("tutBox").innerText);
        if (/\bClique\b/.test(txt)) problems.push(`passo ${n}: texto diz "Clique" (no celular é "Toque")`);
      },
    });
    assert.deepEqual(errors, []);
    await context.close();
    assert.deepEqual(problems, [], "elementos destacados tapados pelo balão do tutorial");
  });
}
