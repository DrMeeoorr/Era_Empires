// Acabamento visual (21/11/2026): efeitos dos terrenos em etiquetas + / − (folha ⓘ Terrenos, folha da região e Como
// jogar), o "?" da partida abre o Como jogar novo ("Atlas") e as janelas (Reiniciar, Nova partida, tutorial, ouro
// parado, save danificado, aviso de falha ao salvar, menu ☰) no estilo novo e acessíveis (role="dialog", foco).
// Nos 3 celulares e com a fonte larga DejaVu Sans: nada cortado, sem rolagem horizontal, alvos com 48 px.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, horizontalOverflow, assertClickable, MOBILE_SCREENS } = require("./helpers");

const WIDE_FONT = '*{font-family:"DejaVu Sans",sans-serif!important}';
const PIXEL = MOBILE_SCREENS[0][1];
const NAMES = ["Campina", "Floresta", "Colinas", "Montanha", "Deserto", "Pântano", "Tundra"];

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

/** Começa uma partida (com ou sem terrenos com efeito) direto na tela da era. */
async function startGame(page, effects) {
  await page.evaluate((fx) => {
    setTerrainEffectsChoice(fx); state = newGame(); state.ui.skipIdleWarning = true;
    document.getElementById("homeScreen").hidden = true; showView("game"); renderAll();
  }, effects);
}

/**
 * Etiquetas de efeito dentro de `root`: cada uma numa linha só (sem quebrar no meio), inteira dentro da sua linha da
 * lista e da tela; contraste do texto ≥ 4,5:1 (WCAG AA); sinal + / − no texto ou estilo próprio da desvantagem.
 * Devolve a lista de problemas e o maior número de linhas de etiquetas de um terreno.
 */
async function chipProblems(page, root) {
  return page.evaluate((root) => {
    const lum = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const out = []; let maxLines = 0;
    for (const box of document.querySelectorAll(`${root} .ter-eff`)) {
      if (!box.offsetParent) continue;
      const row = box.closest("li") || box.parentElement, rr = row.getBoundingClientRect(), tops = new Set();
      for (const c of box.querySelectorAll(".fx")) {
        const r = c.getBoundingClientRect(), cs = getComputedStyle(c), lh = parseFloat(cs.lineHeight) || 18, t = c.textContent.trim();
        tops.add(Math.round(r.top));
        if (c.getClientRects().length > 1 || r.height > lh + 8) out.push(`${t}: quebrou em mais de uma linha (${Math.round(r.height)} px)`);
        if (c.scrollWidth > c.clientWidth + 1) out.push(`${t}: texto cortado`);
        if (r.right > rr.right + 0.5 || r.left < rr.left - 0.5) out.push(`${t}: sai da linha do terreno`);
        if (r.right > innerWidth || r.left < 0) out.push(`${t}: sai da tela`);
        const k = ratio(cs.color, cs.backgroundColor);
        if (k < 4.5) out.push(`${t}: contraste ${k.toFixed(2)} < 4,5`);
        const up = c.classList.contains("up"), down = c.classList.contains("down");
        if (up === down) out.push(`${t}: sem a marca de vantagem/desvantagem`);
        if (down && !/^−/.test(t)) out.push(`${t}: desvantagem sem o sinal −`);
        if (up && !/\+/.test(t)) out.push(`${t}: vantagem sem o sinal +`);
        if (down && cs.borderTopStyle !== "dashed") out.push(`${t}: desvantagem só pela cor`);
      }
      maxLines = Math.max(maxLines, tops.size);
    }
    return { out, maxLines };
  }, root);
}

for (const [name, opts] of MOBILE_SCREENS) {
  for (const wide of [false, true]) {
    test(`terrenos com efeito em ${name}${wide ? " com fonte larga (DejaVu Sans)" : ""}: etiquetas + / − sem quebrar nem cortar (ⓘ Terrenos, região, Como jogar)`, async () => {
      const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      await startGame(page, true);
      // ⓘ Terrenos: 1 coluna, 7 linhas, cada uma com ícone, nome e 3 etiquetas (2 vantagens e 1 desvantagem).
      await page.locator("#terrainBtn").click();
      const ts = page.locator("#terrainSheet");
      await ts.waitFor({ state: "visible" });
      const rows = ts.locator(".ter-list.ter-fx li");
      assert.equal(await rows.count(), 7);
      const xs = new Set();
      for (let k = 0; k < 7; k++) {
        const li = rows.nth(k), b = await li.boundingBox();
        xs.add(Math.round(b.x));
        assert.ok(b.height >= 48, `${NAMES[k]}: linha com menos de 48 px`);
        assert.equal(await li.locator("b").innerText(), NAMES[k]);
        assert.equal(await li.locator("svg.ter-ico").count(), 1);
        assert.equal(await li.locator(".fx.up").count(), 2);
        assert.equal(await li.locator(".fx.down").count(), 1);
      }
      assert.equal(xs.size, 1, "a lista com efeitos devia ter 1 coluna");
      const r = await chipProblems(page, "#terrainSheet");
      assert.deepEqual(r.out, []);
      assert.ok(r.maxLines <= 2, `etiquetas de um terreno em ${r.maxLines} linhas (máx. 2)`);
      // No Pixel 7 todas cabem numa linha só, também com a fonte larga (a do GitHub Actions é mais larga que a local).
      if (name === "Pixel 7") assert.equal(r.maxLines, 1, "no Pixel 7 as 3 etiquetas deviam caber numa linha");
      // A explicação longa fica num bloco que abre com um toque.
      const more = ts.locator(".ter-more > summary");
      await assertClickable(page, "#terrainSheet .ter-more > summary", "Como os efeitos funcionam");
      assert.ok((await more.boundingBox()).height >= 47.5);
      assert.equal(await ts.locator(".ter-more").evaluate((d) => d.open), false);
      await more.click();
      assert.match(await ts.innerText(), /A região inicial de cada império conta como Campina/);
      assert.deepEqual(await horizontalOverflow(page), []);
      await page.keyboard.press("Escape");
      // Folha da região: o terreno e as etiquetas, também sem quebrar no meio.
      const t = await page.evaluate(() => { const t = eligibleTargets(state, "player")[0].i; state.terrain.list[t] = "pantano"; renderAll(); return t; });
      await page.locator(`[data-territory="${t}"]`).click();
      await page.locator("#attackSheet").waitFor({ state: "visible" });
      assert.deepEqual(await page.locator("#mapStatus .tgt-terrain .fx").allInnerTexts(), ["+20% Ciência", "atacar custa +20%", "−20% ouro"]);
      const rr = await chipProblems(page, "#mapStatus");
      assert.deepEqual(rr.out, []);
      assert.ok(rr.maxLines <= 2);
      await page.keyboard.press("Escape");
      // Como jogar ("?"): a mesma lista.
      await page.locator("#helpBtn").click();
      await page.locator("#howToScreen").waitFor({ state: "visible" });
      assert.equal(await page.locator("#howToScreen .ter-list.ter-fx li").count(), 7);
      const rh = await chipProblems(page, "#howToScreen");
      assert.deepEqual(rh.out, []);
      assert.ok(rh.maxLines <= 2);
      assert.deepEqual(await horizontalOverflow(page), []);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
}

test("terrenos só visuais: a mesma linha (ícone + nome) com a dica, em 2 colunas, sem etiquetas de efeito", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { ...MOBILE_SCREENS[2][1], reducedMotion: "reduce" } });
  await page.addStyleTag({ content: WIDE_FONT });
  await startGame(page, false);
  await page.locator("#terrainBtn").click();
  const ts = page.locator("#terrainSheet");
  await ts.waitFor({ state: "visible" });
  assert.equal(await ts.locator(".ter-eff, .ter-more").count(), 0);
  const rows = ts.locator(".ter-list li");
  assert.equal(await rows.count(), 7);
  const xs = new Set();
  for (let k = 0; k < 7; k++) {
    const li = rows.nth(k), b = await li.boundingBox();
    xs.add(Math.round(b.x));
    assert.ok(b.height >= 48);
    assert.equal(await li.locator("svg.ter-ico").getAttribute("width"), "28", "ícone do mesmo tamanho da lista com efeitos");
    assert.ok((await li.locator("small").innerText()).length > 3, `${NAMES[k]} sem a dica`);
    assert.equal(await li.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), true, `${NAMES[k]}: texto cortado`);
  }
  assert.equal(xs.size, 2, "a lista só visual devia ter 2 colunas");
  assert.deepEqual(await horizontalOverflow(page), []);
  assert.deepEqual(errors, []);
  await context.close();
});

/** O Como jogar está aberto como diálogo acessível, com o foco dentro e o resto da tela inerte. */
async function howToOpenA11y(page) {
  return page.evaluate(() => {
    const s = document.getElementById("howToScreen"), lab = document.getElementById(s.getAttribute("aria-labelledby"));
    return {
      role: s.getAttribute("role"), modal: s.getAttribute("aria-modal"), name: lab && lab.textContent.trim(),
      focusInside: s.contains(document.activeElement),
      gameInert: document.getElementById("metrics").closest("[inert]") !== null || document.getElementById("metrics").inert,
      homeInert: document.getElementById("homeScreen").inert,
    };
  });
}

test('"?" na partida abre o Como jogar novo por cima da partida e fecha com ✕, Esc, Voltar do Android e Entendi, devolvendo o foco', async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { ...PIXEL, reducedMotion: "reduce" } });
  await startGame(page, false);
  assert.equal(await page.locator("#howTo").count(), 0, "a folha de regras antiga ainda existe");
  assert.equal(await page.locator("#helpBtn").getAttribute("data-open"), "howToScreen");
  const how = page.locator("#howToScreen");
  const era = await page.evaluate(() => state.era);
  for (const way of ["x", "esc", "back", "ok"]) {
    await page.locator("#helpBtn").focus();
    await page.locator("#helpBtn").click();
    await how.waitFor({ state: "visible" });
    const a = await howToOpenA11y(page);
    assert.deepEqual(a, { role: "dialog", modal: "true", name: "Como jogar", focusInside: true, gameInert: true, homeInert: true });
    assert.equal(await page.locator("#helpBtn").getAttribute("aria-expanded"), "true");
    // Por cima da partida: ✕ à direita (48 px); sem a seta Voltar da tela inicial.
    assert.equal(await page.locator("#howToBack").isVisible(), false);
    const x = await assertClickable(page, "#howToClose", "✕ Fechar");
    assert.ok(x.width >= 47.5 && x.height >= 47.5 && x.x > 300);
    if (way === "x") {
      // Os 4 cartões, nesta ordem; "Regras completas" a um toque (fechadas ao abrir).
      const labs = await how.locator(".pg-card > h2.pg-lab").allInnerTexts();
      assert.deepEqual(labs.map((t) => t.trim().toLowerCase()), ["cada era, 3 passos", "onde investir", "terrenos", "como vencer"]);
      assert.equal(await page.locator("#howToFull").evaluate((d) => d.open), false);
      await page.locator("#howToFull > summary").click();
      assert.match(await page.locator("#howToFullBody").innerText(), /Cada era[\s\S]*Os investimentos[\s\S]*Terrenos[\s\S]*Como vencer/);
      // Tab não sai da tela.
      for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); assert.ok(await how.evaluate((s) => s.contains(document.activeElement)), "o foco saiu do Como jogar"); }
      assert.deepEqual(await horizontalOverflow(page), []);
      await page.locator("#howToClose").click();
    } else if (way === "esc") await page.keyboard.press("Escape");
    else if (way === "back") await page.evaluate(() => history.back());
    else await page.locator("#howToOk").click();
    await how.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement.id), "helpBtn", `foco não voltou ao "?" (${way})`);
    assert.equal(await page.evaluate(() => document.getElementById("metrics").inert), false);
    assert.equal(await page.locator("#sheetScrim").isVisible(), false);
  }
  // Reabre com as regras completas fechadas e no topo.
  await page.locator("#helpBtn").click();
  assert.equal(await page.locator("#howToFull").evaluate((d) => d.open), false);
  assert.equal(await how.evaluate((s) => s.scrollTop), 0);
  await page.keyboard.press("Escape");
  // Pelo menu ☰ → Como jogar: abre o mesmo; ao fechar, o foco volta ao ☰.
  await page.locator("#menuBtn").click();
  await page.locator('#menuSheet [data-open="howToScreen"]').click();
  await how.waitFor({ state: "visible" });
  assert.equal(await page.locator("#menuSheet").isVisible(), false);
  await page.keyboard.press("Escape");
  await how.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.activeElement.id), "menuBtn");
  assert.equal(await page.evaluate(() => state.era), era, "abrir o Como jogar mudou a partida");
  assert.deepEqual(errors, []);
  await context.close();
});

test("Como jogar da tela inicial: seta Voltar, fecha com Voltar, Esc e o Voltar do Android e devolve o foco", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { ...PIXEL, reducedMotion: "reduce" } });
  const how = page.locator("#howToScreen");
  for (const way of ["seta", "esc", "back"]) {
    await page.locator("#homeHowTo").click();
    await how.waitFor({ state: "visible" });
    assert.equal(await page.locator("#howToClose").isVisible(), false);
    await assertClickable(page, "#howToBack", "Voltar");
    const a = await howToOpenA11y(page);
    assert.equal(a.focusInside, true);
    assert.equal(a.homeInert, true, "a tela inicial devia ficar inerte por baixo");
    if (way === "seta") await page.locator("#howToBack").click();
    else if (way === "esc") await page.keyboard.press("Escape");
    else await page.evaluate(() => history.back());
    await how.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.getElementById("homeScreen").hidden), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), "homeHowTo", `foco (${way})`);
    assert.equal(await page.evaluate(() => document.getElementById("homeScreen").inert), false);
  }
  // Esc no Como jogar aberto por cima de Nova partida fecha só o Como jogar.
  await page.locator("#homeStart").click();
  await page.evaluate(() => openSheet("howToScreen", document.getElementById("setupStart")));
  await how.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await how.waitFor({ state: "hidden" });
  assert.equal(await page.locator("#setupScreen").isVisible(), true, "Esc fechou também a Nova partida");
  assert.deepEqual(errors, []);
  await context.close();
});

/** Janela aberta: estilo novo, diálogo acessível com nome e descrição, foco dentro e alvos de 48 px na tela. */
async function checkDialog(page, title, where, wide) {
  const d = await page.evaluate(() => {
    const back = document.querySelector("#modalRoot .modal-back"), m = back?.querySelector(".modal");
    if (!back) return null;
    const lab = document.getElementById(back.getAttribute("aria-labelledby") || ""), desc = document.getElementById(back.getAttribute("aria-describedby") || "");
    const r = m.getBoundingClientRect();
    return {
      atlas: back.classList.contains("modal-atlas"), role: back.getAttribute("role"), modal: back.getAttribute("aria-modal"),
      name: lab?.textContent.trim(), desc: !!desc && desc.textContent.trim().length > 10, focus: back.contains(document.activeElement),
      icon: !!m.querySelector(".dlg-ic svg"), inView: r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5,
      font: getComputedStyle(m.querySelector("h2")).fontFamily,
      buttons: [...m.querySelectorAll(".actions button")].map((b) => { const q = b.getBoundingClientRect(); return { t: b.textContent.trim(), w: q.width, h: q.height, top: q.top, cut: b.scrollWidth > b.clientWidth + 1, primary: b.classList.contains("btn-main") || b.classList.contains("btn-danger") }; }),
    };
  });
  assert.ok(d, `${where}: janela não abriu`);
  assert.equal(d.atlas, true, `${where}: janela no estilo antigo`);
  assert.equal(d.role, "dialog"); assert.equal(d.modal, "true");
  assert.equal(d.name, title, `${where}: nome acessível`);
  assert.ok(d.desc, `${where}: sem descrição (aria-describedby)`);
  assert.ok(d.focus, `${where}: o foco não está na janela`);
  assert.ok(d.icon, `${where}: sem o ícone`);
  assert.ok(d.inView, `${where}: a janela não cabe na tela`);
  if (!wide) assert.match(d.font, /Marcellus SC/, `${where}: título sem a fonte dos títulos`);
  for (const b of d.buttons) { assert.ok(b.h >= 47.5 && b.w >= 47.5, `${where} › ${b.t}: ${b.w}×${b.h}`); assert.equal(b.cut, false, `${where} › ${b.t}: texto cortado`); }
  const prim = d.buttons.filter((b) => b.primary), rest = d.buttons.filter((b) => !b.primary);
  if (prim.length && rest.length) assert.ok(prim[0].top < rest[0].top, `${where}: o botão principal devia ficar em cima`);
  assert.deepEqual(await horizontalOverflow(page), [], `${where}: rolagem horizontal`);
  // Tab e Shift+Tab não saem da janela.
  for (const k of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(k);
    assert.ok(await page.evaluate(() => document.querySelector("#modalRoot .modal-back")?.contains(document.activeElement)), `${where}: ${k} tirou o foco da janela`);
  }
}

for (const [name, opts, wide] of [...MOBILE_SCREENS.map(([n, o]) => [n, o, true]), [MOBILE_SCREENS[0][0], PIXEL, false]]) {
  test(`janelas no estilo novo em ${name}${wide ? " com fonte larga (DejaVu Sans)" : ""}: Reiniciar, ouro parado, save danificado, Nova partida, tutorial; Esc cancela e devolve o foco`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
    if (wide) await page.addStyleTag({ content: WIDE_FONT });
    await startGame(page, false);
    // Menu ☰ no estilo novo: ícones SVG (sem emoji) e alvos de 48 px.
    await page.locator("#menuBtn").click();
    await page.locator("#menuSheet").waitFor({ state: "visible" });
    for (const id of ["returnHome", "restart", "summaryToggle"]) {
      const b = await assertClickable(page, `#${id}`, id);
      assert.ok(b.height >= 47.5);
    }
    assert.equal(await page.locator("#menuList .menu-item svg.ic").count(), 7); // 7 itens desde as Medalhas (20/11/2026)
    assert.doesNotMatch(await page.locator("#menuList").innerText(), /🏆|⌂|▤|↺/);
    // Tab preso no menu, mesmo com os ícones SVG (<use href> não é um alvo de foco).
    for (const k of ["Tab", "Tab", "Tab", "Tab", "Tab", "Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
      await page.keyboard.press(k);
      assert.ok(await page.evaluate(() => document.getElementById("menuSheet").contains(document.activeElement) && document.activeElement.tagName === "BUTTON"), `menu: ${k} tirou o foco do menu`);
    }
    if (!wide) assert.match(await page.locator("#menuSheetTitle").evaluate((e) => getComputedStyle(e).fontFamily), /Marcellus SC/);
    // Reiniciar: o foco começa em Cancelar; Esc cancela (a partida continua) e o foco volta ao ☰.
    await page.evaluate(() => { state.era = 3; });
    await page.locator("#restart").click();
    await checkDialog(page, "Reiniciar a partida?", "Reiniciar", wide);
    await page.locator('#modalRoot button:has-text("Cancelar")').focus();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#modalRoot").innerHTML(), "");
    assert.equal(await page.evaluate(() => state.era), 3, "Esc reiniciou a partida");
    assert.equal(await page.evaluate(() => document.activeElement.id), "menuBtn");
    // Ouro parado: Esc = "Voltar e investir" (a era não termina); o foco volta para Concluir.
    await page.evaluate(() => { state.ui.skipIdleWarning = false; });
    await page.locator("#advance").click();
    await checkDialog(page, await page.evaluate(() => document.querySelector("#modalRoot h2").textContent.trim()), "ouro parado", wide);
    const chk = await assertClickable(page, "#modalRoot .dlg-check", "Não perguntar de novo");
    assert.ok(chk.height >= 47.5);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#modalRoot").innerHTML(), "");
    assert.equal(await page.evaluate(() => state.era), 3, "Esc concluiu a era");
    assert.equal(await page.evaluate(() => document.activeElement.id), "advance");
    // Save danificado (só um botão; Esc fecha).
    await page.evaluate(() => noticeBrokenSave());
    await page.locator("#modalRoot .modal").waitFor({ state: "visible" });
    await checkDialog(page, "Não foi possível continuar a partida salva", "save danificado", wide);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#modalRoot").innerHTML(), "");
    // Aviso de falha ao salvar: alerta com ícone e ✕ de 48 px, dentro da tela.
    await page.evaluate(() => showSaveWarning({ name: "QuotaExceededError" }));
    const sw = page.locator("#saveWarning");
    assert.equal(await sw.getAttribute("role"), "alert");
    assert.equal(await sw.locator(".sw-ic svg").count(), 1);
    const swx = await assertClickable(page, "#saveWarning .sw-x", "Fechar aviso");
    assert.ok(swx.width >= 47.5 && swx.height >= 47.5);
    assert.equal(await sw.evaluate((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom < innerHeight / 2; }), true);
    await page.locator("#saveWarning .sw-x").click();
    assert.equal(await sw.isVisible(), false);
    // Nova partida com partida em curso: Esc = Cancelar, foco volta para "Jogar".
    await page.evaluate(() => { state.history.push({}); document.getElementById("homeScreen").hidden = false; });
    await page.locator("#homeStart").click();
    await page.locator("#setupStart").click();
    await checkDialog(page, "Começar uma nova partida?", "Nova partida", wide);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#modalRoot").innerHTML(), "");
    assert.equal(await page.locator("#setupScreen").isVisible(), true, "Esc na janela fechou também a Nova partida");
    assert.equal(await page.evaluate(() => document.activeElement.id), "setupStart");
    assert.equal(await page.evaluate(() => state.era), 3);
    await page.locator("#setupBack").click();
    // Começar o tutorial com partida em curso.
    await page.locator("#homeTutorial").click();
    await checkDialog(page, "Começar o tutorial?", "tutorial", wide);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#modalRoot").innerHTML(), "");
    assert.equal(await page.evaluate(() => document.activeElement.id), "homeTutorial");
    assert.equal(await page.evaluate(() => !!state.tutorial && !state.tutorial.done), false, "Esc começou o tutorial");
    assert.deepEqual(errors, []);
    await context.close();
  });
}
