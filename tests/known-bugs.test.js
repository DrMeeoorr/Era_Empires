// BUGS CONHECIDOS — testes que descrevem o comportamento CORRETO e que hoje falham.
// Estão marcados com test.todo: aparecem no relatório como "# TODO" e não quebram `npm test`.
// Não corrigimos regras de jogo aqui; quando o bug for corrigido, o teste passa a "ok # TODO"
// e deve ser movido para o ficheiro normal correspondente (sem o test.todo).
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

// No Pixel 7 já está correto: fica como teste normal (proteção contra regressão).
for (const [name, opts] of MOBILE_SCREENS) {
  const t = name === "Pixel 7" ? test : test.todo;
  t(`${name === "Pixel 7" ? "" : "BUG: "}tutorial — o balão não pode tapar o elemento destacado no celular (${name})`, async () => {
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
      },
    });
    assert.deepEqual(errors, []);
    await context.close();
    assert.deepEqual(problems, [], "elementos destacados tapados pelo balão do tutorial");
  });
}
