// UX Fase 2: a tela de uma era cabe no celular sem rolar (barra de recursos, mapa, gaveta de investimento e
// "Concluir era"), folha de ataque (abrir/fechar, atacar, cancelar ordem), menu ☰ com Reiniciar confirmado,
// folhas acessíveis (role="dialog", aria-modal, foco preso e devolvido) e nada cortado com uma fonte larga
// ("DejaVu Sans", parecida com a do GitHub Actions).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, concludeEraUI, choosePlan, screenshot, MOBILE_SCREENS } = require("./helpers");

const PIXEL = MOBILE_SCREENS[0][1];
let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

const WIDE_FONT = '*{font-family:"DejaVu Sans",sans-serif!important}';

async function startGame(page, { ai = 1 } = {}) {
  await page.locator("#homeStart").click();
  await page.locator(`#homeOpponents [data-ai="${ai}"]`).click();
  await page.locator("#setupStart").click();
  const confirm = page.locator('#modalRoot button:has-text("Nova partida")');
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1 && !!state.pending);
  await page.evaluate(() => { state.ui.skipReport = true; state.ui.skipIdleWarning = true; });
}

/** Sem rolagem vertical e tudo o que é essencial inteiro dentro da tela. */
async function fitProblems(page) {
  return page.evaluate(() => {
    const out = [], vh = innerHeight, vw = innerWidth, de = document.documentElement;
    if (de.scrollHeight > vh + 1) out.push(`rolagem vertical: ${de.scrollHeight} > ${vh}`);
    const inside = (el, label) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) out.push(`${label}: invisível`);
      else if (r.top < -1 || r.bottom > vh + 1 || r.left < -1 || r.right > vw + 1) out.push(`${label}: fora da tela (${Math.round(r.top)}–${Math.round(r.bottom)} de ${vh})`);
    };
    for (const [sel, label] of [["#metrics", "barra de recursos"], ["#menuBtn", "menu"], ["#scorePill", "placar"], ["#statGold", "ouro"], ["#statForce", "Força"], ["#statTerr", "terras"],
      ["#map", "mapa"], ["#investCard", "gaveta"], ["#advance", "Concluir era"]]) inside(document.querySelector(sel), label);
    document.querySelectorAll("[data-territory]").forEach((c) => inside(c, `região ${+c.dataset.territory + 1}`));
    document.querySelectorAll(".inv-ctrl button, .inv-ctrl input").forEach((c) => inside(c, `controle ${c.getAttribute("aria-label")}`));
    return out;
  });
}

/** Textos cortados: elementos visíveis cujo conteúdo passa da própria caixa ou da tela. */
async function cutText(page, root = "#game") {
  return page.evaluate((root) => {
    const out = [], vw = innerWidth;
    for (const el of document.querySelectorAll(`${root} *`)) {
      if (el.closest("[hidden],.legend,.plans,.tablewrap,.sr-only,canvas,svg") || !el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const cs = getComputedStyle(el);
      if (r.right > vw + 1) out.push(`${el.id || el.className || el.tagName}: passa da tela (${Math.round(r.right)} > ${vw})`);
      if (cs.overflowX !== "visible" && el.tagName !== "INPUT" && el.scrollWidth > el.clientWidth + 1) out.push(`${el.id || el.className || el.tagName}: corta "${el.textContent.trim().slice(0, 30)}"`);
      if (el.children.length === 0 && el.textContent.trim() && el.parentElement) {
        const p = el.parentElement.getBoundingClientRect();
        if (r.right > p.right + 1.5 && getComputedStyle(el.parentElement).overflow !== "visible") out.push(`"${el.textContent.trim().slice(0, 30)}" sai da caixa`);
      }
    }
    // Conteúdo de cada região (nome, número, marca de ordem) dentro do quadrado.
    document.querySelectorAll("[data-territory]").forEach((c) => {
      const b = c.getBoundingClientRect();
      for (const k of c.children) {
        const r = k.getBoundingClientRect();
        if (r.height && (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5)) out.push(`região ${+c.dataset.territory + 1}: "${k.textContent.trim()}" sai do quadrado`);
      }
    });
    // Nomes das regiões dentro do quadrado.
    document.querySelectorAll("[data-territory] .rname").forEach((n) => {
      const c = n.closest("[data-territory]"), cs = getComputedStyle(c);
      if (n.scrollWidth > c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 0.5) out.push(`região "${n.textContent}" corta`);
    });
    return out;
  }, root);
}

for (const [name, opts] of MOBILE_SCREENS) {
  for (const wide of [false, true]) {
    test(`tela da era sem rolagem em ${name}${wide ? " com fonte larga (DejaVu Sans)" : ""}: barra de recursos, mapa, gaveta e Concluir à vista`, async () => {
      const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
      if (wide) {
        await page.addStyleTag({ content: WIDE_FONT });
        assert.ok(await page.evaluate(() => document.fonts.check('16px "DejaVu Sans"')), "fonte DejaVu Sans indisponível");
      }
      for (const ai of [1, 3]) {
        if (ai === 3) { await page.evaluate(() => { document.getElementById("homeScreen").hidden = false; }); }
        await startGame(page, { ai });
        const problems = [...(await fitProblems(page)), ...(await cutText(page))];
        // Depois de investir, dar uma ordem e concluir uma era (prévias e números maiores).
        await choosePlan(page, "attack");
        problems.push(...(await cutText(page)));
        await concludeEraUI(page);
        await page.evaluate(() => { const m = configApplied.military, t = eligibleTargets(state, "player").find((x) => P(state).military >= m.conquestCost + territoryDefense(state, x.i, configApplied)); if (t) { orderAttack(state, t.i, "player", configApplied); renderAll(); } });
        problems.push(...(await fitProblems(page)), ...(await cutText(page)));
        // Folha de ataque, placar e ajuste fino também sem cortes.
        const t = await page.evaluate(() => eligibleTargets(state, "player").find((x) => !(state.orders || []).some((o) => o.idx === x.i))?.i ?? eligibleTargets(state, "player")[0].i);
        await page.locator(`[data-territory="${t}"]`).click();
        problems.push(...(await cutText(page, "#attackSheet")));
        await page.keyboard.press("Escape");
        for (const open of ["#scorePill", "#fineBtn"]) {
          await page.locator(open).click();
          problems.push(...(await cutText(page, ".sheet:not([hidden])")));
          await page.keyboard.press("Escape");
        }
        await screenshot(page, `era-${name}${wide ? "-fonte-larga" : ""}-${ai}rivais`);
        assert.deepEqual([...new Set(problems)], [], `${ai} rival(is)`);
      }
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
}

test("folha de ataque: abre ao tocar, fecha com toque fora, Esc e voltar; atacar e cancelar a ordem", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { ...PIXEL, reducedMotion: "reduce" } });
  await startGame(page);
  await choosePlan(page, "attack");
  await concludeEraUI(page);
  const t = await page.evaluate(() => { const m = configApplied.military; return eligibleTargets(state, "player").find((x) => P(state).military >= m.conquestCost + territoryDefense(state, x.i, configApplied)).i; });
  const cell = page.locator(`[data-territory="${t}"]`);
  const sheet = page.locator("#attackSheet");
  const isOpen = () => sheet.isVisible();
  // Acessibilidade: diálogo modal, foco dentro, resto inerte.
  await cell.click();
  assert.ok(await isOpen());
  assert.deepEqual(await page.evaluate(() => { const s = document.getElementById("attackSheet"); return [s.getAttribute("role"), s.getAttribute("aria-modal"), s.contains(document.activeElement), document.getElementById("mapCard").inert, !!document.getElementById(s.getAttribute("aria-labelledby"))]; }), ["dialog", "true", true, true, true]);
  // Foco preso: Tab muitas vezes nunca sai da folha.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => document.getElementById("attackSheet").contains(document.activeElement)), "o foco saiu da folha");
  }
  // Toque fora (no fundo escurecido, acima da folha) fecha e devolve o foco à região.
  await page.mouse.click(200, 20);
  assert.equal(await isOpen(), false, "toque fora não fechou a folha");
  assert.equal(await page.evaluate((t) => document.activeElement?.dataset?.territory, t), String(t), "o foco não voltou à região");
  assert.equal(await page.evaluate(() => selectedTerritory), null);
  // Esc fecha.
  await cell.click();
  await page.keyboard.press("Escape");
  assert.equal(await isOpen(), false, "Esc não fechou a folha");
  // Botão voltar do navegador/Android fecha a folha e o jogo continua na mesma página.
  const url = page.url();
  await cell.click();
  await page.evaluate(() => history.back());
  await sheet.waitFor({ state: "hidden" });
  assert.equal(page.url(), url);
  assert.equal(await page.evaluate(() => document.getElementById("homeScreen").hidden), true);
  // Atacar: dá a ordem, fecha a folha e mostra o aviso.
  await cell.click();
  const before = await page.evaluate(() => P(state).military);
  assert.match(await page.locator("#attack").innerText(), /^Atacar · usa [\d.,]+ de Força$/);
  await page.locator("#attack").click();
  assert.equal(await isOpen(), false);
  assert.ok(await page.locator("#toast").isVisible(), "sem aviso de ordem dada");
  assert.match(await page.locator("#toast").innerText(), /Ordem dada/);
  assert.equal(await page.evaluate((t) => state.orders.filter((o) => o.owner === "player" && o.idx === t).length, t), 1);
  assert.ok(await page.evaluate(() => P(state).military) < before);
  // Tocar de novo na região: "Cancelar ordem" devolve a Força.
  await cell.click();
  assert.equal(await page.locator("#attack").innerText(), "Cancelar ordem");
  await page.locator("#attack").click();
  assert.equal(await page.evaluate(() => (state.orders || []).filter((o) => o.owner === "player").length), 0);
  assert.ok(Math.abs((await page.evaluate(() => P(state).military)) - before) < 1e-9, "a Força não foi devolvida");
  // Sem Força: botão desabilitado com o motivo e atalho "Investir em Militar" (fecha a folha e foca o + Militar).
  await page.evaluate(() => { P(state).military = 0; renderAll(); });
  await cell.click();
  assert.equal(await page.locator("#attack").isDisabled(), true);
  assert.match(await page.locator("#attack").innerText(), /^Faltam [\d.,]+ de Força$/);
  await page.locator("#mapStatus summary").click();
  assert.match(await page.locator("#mapStatus details").innerText(), /Custo = /, '"Por quê?" sem a explicação');
  await page.locator("#attackInvest").click();
  assert.equal(await isOpen(), false);
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('[data-area="mil"] [data-step="1"]')), true);
  // Fechar com o ✕.
  await cell.click();
  await page.locator("#attackSheet [data-close]").click();
  assert.equal(await isOpen(), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test("menu ☰: Reiniciar pede confirmação; Como jogar, Placar e vitória e Detalhes abrem como folhas", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { ...PIXEL, reducedMotion: "reduce" } });
  await startGame(page);
  for (let i = 0; i < 2; i++) { await choosePlan(page, "balanced"); await concludeEraUI(page); }
  assert.equal(await page.evaluate(() => state.era), 3);
  // Menu abre como diálogo e fecha com Esc, devolvendo o foco ao ☰.
  await page.locator("#menuBtn").click();
  assert.ok(await page.locator("#menuSheet").isVisible());
  assert.equal(await page.locator("#menuBtn").getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#menuSheet").isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), "menuBtn");
  // Reiniciar → Cancelar: nada muda.
  await page.locator("#menuBtn").click();
  await page.locator("#restart").click();
  assert.equal(await page.locator("#menuSheet").isVisible(), false, "o menu ficou aberto por baixo da confirmação");
  await page.locator('#modalRoot :text("Reiniciar a partida?")').waitFor();
  await page.locator('#modalRoot button:has-text("Cancelar")').click();
  assert.equal(await page.evaluate(() => state.era), 3);
  // Reiniciar → Reiniciar: volta à era 1.
  await page.locator("#menuBtn").click();
  await page.locator("#restart").click();
  await page.locator('#modalRoot button.danger:has-text("Reiniciar")').click();
  await page.waitForFunction(() => state.era === 1 && state.history.length === 0);
  // "?" abre Como jogar; o placar e "terras" abrem Placar e vitória (com as condições de vitória); Detalhes pelo menu.
  await page.locator("#helpBtn").click();
  assert.match(await page.locator("#howTo").innerText(), /Como vencer/);
  await page.locator("#howTo [data-close]").click();
  for (const opener of ["#scorePill", "#statTerr"]) {
    await page.locator(opener).click();
    assert.ok(await page.locator("#victoryPanel").isVisible(), `${opener} não mostrou as condições de vitória`);
    assert.match(await page.locator("#scoreSheet").innerText(), /Maioria territorial/);
    await page.keyboard.press("Escape");
  }
  await page.locator("#menuBtn").click();
  await page.locator('#menuSheet [data-open="details"]').click();
  assert.ok(await page.locator("#details").isVisible());
  assert.equal(await page.locator("#menuSheet").isVisible(), false, "duas folhas abertas ao mesmo tempo");
  assert.ok(await page.locator("#revenueChart").isVisible());
  await page.keyboard.press("Escape");
  // Início pelo menu.
  await page.locator("#menuBtn").click();
  await page.locator("#returnHome").click();
  assert.equal(await page.evaluate(() => document.getElementById("homeScreen").hidden), false);
  assert.deepEqual(errors, []);
  await context.close();
});

for (const [name, opts] of [MOBILE_SCREENS[0], MOBILE_SCREENS[2]]) {
  test(`planos rápidos em ${name}: ${opts.viewport.height <= 700 ? 'folha "Planos ▾"' : "chips na gaveta"}; Resto, Zerar e valor exato continuam`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
    await startGame(page);
    const short = opts.viewport.height <= 700;
    assert.equal(await page.locator("#plansBtn").isVisible(), short);
    assert.equal(await page.locator('[data-plan="attack"]').isVisible(), !short);
    if (short) {
      await page.locator("#plansBtn").click();
      assert.ok(await page.locator("#planSheet").isVisible());
      assert.equal(await page.locator("#planSheet [data-plan]").count(), 5);
      await page.locator('[data-plan="attack"]').click();
      assert.equal(await page.locator("#planSheet").isVisible(), false, "a folha não fechou depois de escolher o plano");
    } else await page.locator('[data-plan="attack"]').click();
    const b = await page.evaluate(() => P(state).treasury);
    assert.ok(Math.abs((await page.evaluate(() => readAlloc().reduce((a, x) => a + x, 0))) - b) < 0.02);
    assert.match(await page.locator("#advance").innerText(), /tudo investido/);
    // Ajuste fino: Zerar e Resto.
    await page.locator("#fineBtn").click();
    await page.locator('[data-area="mil"] [data-zero]').click();
    assert.equal(await page.evaluate(() => readAlloc()[0]), 0);
    assert.match(await page.locator("#advance").innerText(), /sobram [\d.,]+ de ouro/);
    await page.locator('[data-area="tech"] [data-rest]').click();
    assert.ok(Math.abs((await page.evaluate(() => readAlloc().reduce((a, x) => a + x, 0))) - b) < 0.02, "Resto não usou todo o ouro");
    await page.keyboard.press("Escape");
    // Valor exato: tocar no valor e digitar.
    await choosePlan(page, "clear");
    await page.locator("#milSpend").click();
    await page.locator("#milSpend").fill("3,5");
    await page.locator("#milSpend").press("Enter");
    assert.equal(await page.evaluate(() => readAlloc()[0]), 3.5);
    assert.match(await page.locator("#milPrev").innerText(), /de Força/);
    assert.deepEqual(errors, []);
    await context.close();
  });
}
