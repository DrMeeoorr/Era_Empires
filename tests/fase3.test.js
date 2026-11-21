// UX Fase 3: mapa ilustrado (vizinhança da grade 6×4, toque na forma certa), resumo da era (aparece e fecha,
// só quando algo aconteceu, nunca no avanço rápido) e tela de resultado (botões, nada cortado, sem rolagem lateral).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, choosePlan, horizontalOverflow, assertClickable, screenshot, MOBILE_SCREENS, openCustomize } = require("./helpers");

const PIXEL = MOBILE_SCREENS[0][1];
let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

async function startGame(page) {
  await page.locator("#homeStart").click();
  await openCustomize(page);
  await page.locator('[data-eras="15"]').click();
  await page.locator("#setupStart").click();
  const confirm = page.locator('#modalRoot button:has-text("Nova partida")');
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1 && !!state.pending);
  await page.evaluate(() => { state.ui.skipIdleWarning = true; });
}

/** Elementos com texto que passa da própria caixa ou da tela (dentro de root). */
const cutText = (page, root) =>
  page.evaluate((root) => {
    const out = [], vw = innerWidth;
    for (const el of document.querySelectorAll(`${root} *`)) {
      if (el.closest("[hidden],svg,canvas,.tablewrap") || !el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${el.className || el.tagName}: passa da tela`);
      const cs = getComputedStyle(el);
      if (cs.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) out.push(`${el.className || el.tagName}: corta "${el.textContent.trim().slice(0, 30)}"`);
      if (el.children.length === 0 && el.textContent.trim() && el.parentElement) {
        const p = el.parentElement.getBoundingClientRect();
        if (r.right > p.right + 1.5) out.push(`"${el.textContent.trim().slice(0, 30)}" sai da caixa`);
      }
    }
    return out;
  }, root);

test("mapa ilustrado: as formas preservam exatamente a vizinhança da grade 6×4 e o toque acerta a região desenhada", async () => {
  for (const [name, opts] of MOBILE_SCREENS) {
    const { context, page, errors } = await openGame(browser, { contextOptions: opts });
    await page.evaluate(() => { document.getElementById("homeScreen").hidden = true; renderAll(); });
    const r = await page.evaluate(() => {
      const paths = [...document.querySelectorAll("#map .lands path[data-region]")];
      const polys = paths.map((p) => p.getAttribute("d").slice(1, -1).split("L").map((s) => s.trim().split(/\s+/).map(Number)));
      const seg = (poly) => { const s = new Set(); for (let k = 0; k < poly.length; k++) { const a = poly[k].join(","), b = poly[(k + 1) % poly.length].join(","); s.add(a < b ? a + "|" + b : b + "|" + a); } return s; };
      const S = polys.map(seg), wrong = [];
      for (let a = 0; a < polys.length; a++) for (let b = a + 1; b < polys.length; b++) {
        let shared = 0; for (const x of S[a]) if (S[b].has(x)) shared++;
        const nb = neighbors(a, state.owners.length).includes(b);
        if (nb !== shared > 1) wrong.push(`${a + 1}-${b + 1}: vizinhas=${nb}, segmentos em comum=${shared}`);
      }
      // Toque: no meio de cada região e perto de cada borda partilhada (6 px para dentro de cada lado).
      const m = document.getElementById("map").getBoundingClientRect(), W = regionShapes().width, H = regionShapes().height;
      const px = ([x, y]) => [m.left + (x / W) * m.width, m.top + (y / H) * m.height];
      const hit = (x, y) => document.elementFromPoint(x, y)?.closest("[data-territory]")?.dataset.territory;
      const miss = [];
      document.querySelectorAll("[data-territory]").forEach((b) => { const n = b.querySelector(".rname").getBoundingClientRect(); const t = hit(n.left + n.width / 2, n.top + n.height / 2); if (t !== b.dataset.territory) miss.push(`nome de ${+b.dataset.territory + 1} → ${t}`); });
      const cen = (poly) => px([poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]);
      for (let a = 0; a < polys.length; a++) for (const b of neighbors(a, polys.length)) {
        if (b < a) continue;
        const common = polys[a].filter((p) => polys[b].some((q) => q[0] === p[0] && q[1] === p[1]));
        const mid = px(common[Math.floor(common.length / 2)]);
        for (const [i, c] of [[a, cen(polys[a])], [b, cen(polys[b])]]) {
          const d = Math.hypot(c[0] - mid[0], c[1] - mid[1]), x = mid[0] + ((c[0] - mid[0]) / d) * 6, y = mid[1] + ((c[1] - mid[1]) / d) * 6, t = hit(x, y);
          if (t !== String(i)) miss.push(`borda ${a + 1}/${b + 1}, lado de ${i + 1} → ${t}`);
        }
      }
      return { n: polys.length, buttons: document.querySelectorAll("[data-territory]").length, wrong, miss };
    });
    assert.equal(r.n, 24, `${name}: o mapa não tem 24 formas`);
    assert.equal(r.buttons, 24);
    assert.deepEqual(r.wrong, [], `${name}: vizinhança desenhada diferente da grade`);
    assert.deepEqual(r.miss, [], `${name}: o toque não acerta a região desenhada`);
    // Dono sem depender só da cor: símbolo do rival e do jogador em cada região ocupada.
    const own = await page.evaluate(() => [...document.querySelectorAll("[data-territory]")].filter((b) => state.owners[+b.dataset.territory] !== "neutral").map((b) => b.querySelector(".csym")?.textContent));
    assert.ok(own.length >= 2 && own.every((s) => /[★▲●◆■✚]/.test(s || "")), `${name}: região ocupada sem símbolo do dono`);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

for (const [name, opts] of MOBILE_SCREENS) {
  test(`resumo da era em ${name}: aparece depois de Concluir era com ataque, mostra ✓, ouro e placar, e fecha com "Era N →"`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
    await startGame(page);
    // Era 1 tranquila: só o aviso curto, sem pedir toque.
    await choosePlan(page, "attack");
    await page.locator("#advance").click();
    await page.waitForFunction(() => state.era === 2);
    assert.equal(await page.locator("#eraSummary").count(), 0, "era tranquila abriu o resumo em tela cheia");
    await page.locator("#toast:not([hidden])").waitFor({ timeout: 2000 });
    assert.match(await page.locator("#toast").innerText(), /Era 1 concluída · \+[\d.,]+ de ouro/);
    // Era 2: ordem de ataque com vitória garantida.
    const t = await page.evaluate(() => { const m = configApplied.military; return eligibleTargets(state, "player").find((x) => P(state).military >= m.conquestCost + territoryDefense(state, x.i, configApplied)).i; });
    await page.locator(`[data-territory="${t}"]`).click();
    await page.locator("#attack").click();
    await page.evaluate(() => { state.forcedAttack = { owner: "player", win: true }; });
    await page.locator("#advance").click();
    const sum = page.locator("#eraSummary");
    await sum.waitFor({ state: "visible", timeout: 3000 });
    const txt = await sum.innerText();
    assert.match(txt, /Era 2 conclu[ií]da/i);
    assert.match(txt, new RegExp(`${await page.evaluate((t) => regionName(t), t)} conquistada`));
    assert.match(txt, /✓/);
    assert.match(txt, /\+[\d.,]+\s+de ouro para a era 3/);
    assert.match(txt, /Placar/);
    assert.equal(await page.evaluate(() => document.getElementById("sumGold").textContent), await page.evaluate(() => "+" + hudNum(state.pending.revenue.player.total)), "com reduzir movimento, o ouro devia aparecer já no valor final");
    // Cabe na tela: sem rolagem lateral, nada cortado, botão grande à vista.
    assert.deepEqual(await horizontalOverflow(page), []);
    assert.deepEqual(await cutText(page, "#eraSummary"), []);
    const box = await assertClickable(page, "#eraSummary .sum-next", "Era 3 →");
    assert.ok(box.height >= 48 && box.y + box.height <= page.viewportSize().height + 1, "botão Era 3 → pequeno ou fora da tela");
    assert.match(await page.locator("#eraSummary .sum-next").innerText(), /Era 3/);
    await screenshot(page, `resumo-era-${name}`);
    await page.locator("#eraSummary .sum-next").click();
    assert.equal(await page.locator("#eraSummary").count(), 0, "o resumo não fechou");
    assert.equal(await page.evaluate(() => state.era), 3);
    await assertClickable(page, "#advance", "Concluir era depois do resumo");
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("resumo da era: Esc fecha; desligado no menu ☰ vira só o aviso; playEra() por código não abre nada", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await startGame(page);
  const order = async () => {
    await choosePlan(page, "attack");
    await page.evaluate(() => { const m = configApplied.military, t = eligibleTargets(state, "player").find((x) => P(state).military >= m.conquestCost + territoryDefense(state, x.i, configApplied)); if (t) orderAttack(state, t.i, "player", configApplied); state.forcedAttack = { owner: "player", win: true }; renderAll(); });
  };
  await page.evaluate(() => { playEra({ military: P(state).treasury, infrastructure: 0, technology: 0 }); renderAll(); });
  await page.waitForTimeout(200);
  assert.equal(await page.locator("#modalRoot").innerHTML(), "", "playEra() abriu um modal");
  await order();
  await page.locator("#advance").click();
  await page.locator("#eraSummary").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#eraSummary").count(), 0, "Esc não fechou o resumo");
  // Desligar no menu.
  await page.locator("#menuBtn").click();
  assert.match(await page.locator("#summaryToggle").innerText(), /ligado/);
  await page.locator("#summaryToggle").click();
  assert.equal(await page.locator("#summaryToggle").getAttribute("aria-pressed"), "false");
  await page.keyboard.press("Escape");
  await order();
  const era = await page.evaluate(() => state.era);
  await page.locator("#advance").click();
  await page.waitForFunction((e) => state.era === e + 1, era);
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#eraSummary").count(), 0, "resumo desligado abriu mesmo assim");
  assert.match(await page.locator("#toast").innerText(), /concluída/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("avanço rápido dos laboratórios não abre o resumo da era", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL, dev: true });
  await page.evaluate(() => { state.ui.skipReport = false; document.getElementById("homeScreen").hidden = true; });
  await page.evaluate(() => runLong(5));
  await page.waitForFunction(() => !busy);
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => state.era >= 5));
  assert.equal(await page.locator("#modalRoot").innerHTML(), "", "o avanço rápido abriu um modal");
  assert.deepEqual(errors, []);
  await context.close();
});

for (const [name, opts] of MOBILE_SCREENS) {
  for (const won of [true, false]) {
    test(`tela de resultado em ${name} (${won ? "vitória" : "derrota"}): título, posição, 3 números e botões à vista, nada cortado`, async () => {
      const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
      await startGame(page);
      await page.evaluate((won) => {
        state.ui.skipReport = true;
        // Domínio com escolha (21/11/2026): ao chegar a 70% o jogador escolhe "Vencer agora" (o fim de antes).
        while (!state.result) { if (won) { P(state).military += 50; for (const t of eligibleTargets(state, "player")) attackTerritory(state, t.i, "player", configApplied, true); } playEra({ military: 0, infrastructure: won ? P(state).treasury : 0, technology: 0 }); if (dominionAsking(state)) chooseDominion(true); }
        renderAll();
      }, won);
      const scr = page.locator("#resultScreen");
      await scr.waitFor({ state: "visible" });
      const txt = await scr.innerText();
      const r = await page.evaluate(() => ({ type: state.result.type, won: state.result.type === "victory" && state.result.winners[0] === "player" }));
      assert.match(txt, r.won ? /Vitória/ : r.type === "draw" ? /Empate/ : /Derrota/);
      assert.match(txt, /Placar final/);
      assert.equal(await page.locator("#resultScreen .res-tile").count(), 3, "devia haver 3 números");
      for (const [sel, label] of [["#newGameAfterEnd", "Jogar de novo"], ["#seeDetails", "Ver detalhes"], ["#resultHome", "Início"]]) {
        const b = await assertClickable(page, sel, label);
        assert.ok(b.height >= 48, `${label} com menos de 48 px`);
      }
      assert.deepEqual(await horizontalOverflow(page), []);
      assert.deepEqual(await cutText(page, "#resultScreen"), []);
      await screenshot(page, `resultado-${name}-${won ? "vitoria" : "derrota"}`);
      // Ver detalhes: gráficos e tabela numa folha; fechar volta ao resultado.
      await page.locator("#seeDetails").click();
      await page.locator("#resultSheet").waitFor({ state: "visible" });
      await page.locator("#resultSheet canvas").nth(1).waitFor();
      assert.equal(await page.locator("#resultSheet canvas").count(), 2);
      await page.keyboard.press("Escape");
      assert.ok(await scr.isVisible());
      // Início leva à tela inicial; Jogar de novo começa outra partida.
      await page.locator("#resultHome").click();
      assert.ok(await page.locator("#homeScreen").isVisible());
      await page.evaluate(() => { document.getElementById("homeScreen").hidden = true; });
      await page.locator("#newGameAfterEnd").click();
      await page.waitForFunction(() => !state.result && state.era === 1);
      assert.equal(await scr.isVisible(), false);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
}
