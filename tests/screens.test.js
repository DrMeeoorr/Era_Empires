// Telas fora da partida (decisão de 20/11/2026): início "Aurora", Nova partida + Personalizar, Como jogar e o
// convite do tutorial ("Atlas"). Nos 3 celulares: sem rolagem horizontal, a tela inicial cabe sem rolar (também
// com a fonte larga DejaVu Sans), alvos de toque com pelo menos 48 px, Personalizar mostra todas as opções e
// "Continuar · Era N" aparece quando há partida salva. A fonte própria (Marcellus SC) é local e carrega.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, horizontalOverflow, assertClickable, screenshot, MOBILE_SCREENS, menuClick, openCustomize, choosePlan, concludeEraUI } = require("./helpers");

const WIDE_FONT = '*{font-family:"DejaVu Sans",sans-serif!important}';
const MIN_TAP = 48;

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

/** Botões com pelo menos 48×48 px, inteiros na largura da tela e sem nada por cima. */
async function assertTargets(page, list, where) {
  for (const [sel, label] of list) {
    const box = await assertClickable(page, sel, `${where} › ${label}`);
    assert.ok(box.height >= MIN_TAP - 0.5 && box.width >= MIN_TAP - 0.5, `${where} › ${label}: ${Math.round(box.width)}×${Math.round(box.height)} px < 48 px`);
  }
}

/** Tela inicial: cabe sem rolar e todos os botões ficam inteiros dentro da tela (sem precisar rolar). */
async function homeFits(page) {
  return page.evaluate(() => {
    const h = document.getElementById("homeScreen"), out = [];
    if (h.scrollHeight > h.clientHeight + 1) out.push(`rolagem vertical: ${h.scrollHeight} > ${h.clientHeight}`);
    for (const b of h.querySelectorAll("button")) {
      if (!b.offsetParent) continue;
      const r = b.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight + 1) out.push(`${b.id} fora da tela (${Math.round(r.top)}–${Math.round(r.bottom)} de ${innerHeight})`);
    }
    return out;
  });
}

/** Textos cortados: elementos cujo conteúdo é mais largo do que a caixa. */
async function clippedText(page, root) {
  return page.evaluate((root) => [...document.querySelectorAll(`${root} button, ${root} label, ${root} h1, ${root} h2, ${root} h3, ${root} summary, ${root} small`)]
    .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => `${e.id || e.textContent.trim().slice(0, 24)} (${e.scrollWidth} > ${e.clientWidth})`), root);
}

for (const [name, opts] of MOBILE_SCREENS) {
  for (const wide of [false, true]) {
    test(`telas iniciais em ${name}${wide ? " com fonte larga (DejaVu Sans)" : ""}: início sem rolar, Nova partida, Personalizar, Como jogar`, async () => {
      const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
      if (wide) {
        await page.addStyleTag({ content: WIDE_FONT });
        assert.ok(await page.evaluate(() => document.fonts.check('16px "DejaVu Sans"')), "fonte DejaVu Sans indisponível");
      }
      // Início: "Jogar" (sem partida salva), Tutorial e Como jogar lado a lado; nada de "Continuar".
      assert.deepEqual(await homeFits(page), [], "tela inicial");
      assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal na tela inicial");
      assert.equal(await page.locator("#homeContinue").isVisible(), false, '"Continuar" sem partida salva');
      assert.equal((await page.locator("#homeStart").innerText()).trim(), "Jogar");
      await assertTargets(page, [["#homeStart", "Jogar"], ["#homeTutorial", "Tutorial"], ["#homeHowTo", "Como jogar"]], "início");
      const [tut, how] = [await page.locator("#homeTutorial").boundingBox(), await page.locator("#homeHowTo").boundingBox()];
      assert.ok(Math.abs(tut.y - how.y) < 1 && tut.x < how.x, "Tutorial e Como jogar deviam ficar lado a lado");
      const start = await page.locator("#homeStart").boundingBox();
      assert.ok(start.y > page.viewportSize().height / 2, '"Jogar" devia ficar na metade de baixo da tela');
      assert.deepEqual(await clippedText(page, "#homeScreen"), [], "texto cortado na tela inicial");
      if (!wide) await screenshot(page, `inicio-${name}`);

      // Como jogar: tela própria, sem rolagem horizontal; "Regras completas" abre o texto inteiro; Esc fecha.
      await page.locator("#homeHowTo").click();
      await page.locator("#howToScreen").waitFor({ state: "visible" });
      await assertTargets(page, [["#howToBack", "Voltar"], ["#howToFull > summary", "Regras completas"], ["#howToOk", "Entendi"]], "Como jogar");
      await page.locator("#howToFull > summary").click();
      assert.match(await page.locator("#howToFullBody").innerText(), /Cada era[\s\S]*Os investimentos[\s\S]*Como vencer/);
      assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal em Como jogar");
      assert.deepEqual(await clippedText(page, "#howToScreen"), [], "texto cortado em Como jogar");
      await page.keyboard.press("Escape");
      await page.locator("#howToScreen").waitFor({ state: "hidden" });

      // Nova partida: só Dificuldade e Rivais à vista, com os padrões (Médio, 1 rival); Personalizar fechado.
      await page.locator("#homeStart").click();
      await page.locator("#setupScreen").waitFor({ state: "visible" });
      assert.equal(await page.locator("#homeDifficulty [data-diff].selected").getAttribute("data-diff"), "medio");
      assert.equal(await page.locator("#homeOpponents [data-ai].selected").getAttribute("data-ai"), "1");
      assert.equal(await page.locator("#setupCustomize").evaluate((d) => d.open), false, "Personalizar devia começar fechado");
      for (const sel of ["#homeEraPresets", "#modeSlow", "#homeClassic", "#homeProfiles", "#homeRandomStart"]) assert.equal(await page.locator(sel).isVisible(), false, `${sel} devia ficar dentro de Personalizar`);
      assert.match(await page.locator("#customizeSummary").innerText(), /^30 eras · ritmo normal · vitória clássica$/);
      await assertTargets(page, [
        ["#setupBack", "Voltar"], ...["muitofacil", "facil", "medio", "dificil", "hardcore"].map((d) => [`#homeDifficulty [data-diff="${d}"]`, d]),
        ...[1, 2, 3].map((n) => [`#homeOpponents [data-ai="${n}"]`, `${n} rival(is)`]), ["#setupCustomize > summary", "Personalizar"], ["#setupStart", "Jogar"],
      ], "Nova partida");
      assert.deepEqual((await page.locator("#homeDifficulty [data-diff]").allInnerTexts()).map((t) => t.trim()), ["Muito fácil", "Fácil", "Médio", "Difícil", "Lendário"]);
      assert.equal((await page.locator("#setupStart").innerText()).trim(), "Jogar");
      // Personalizar: todas as opções de antes continuam lá (duração 15/30/50/outra, ritmo, vitória, estilo de cada rival, posição).
      await page.locator('#homeOpponents [data-ai="3"]').click();
      await openCustomize(page);
      await assertTargets(page, [
        ...[15, 30, 50].map((e) => [`#homeEraPresets [data-eras="${e}"]`, `${e} eras`]), ["#homeEraPresets .pg-other", "Outra duração"],
        ["#modeSlow", "Ritmo Normal"], ["#modeFast", "Ritmo Rápido"], ["#homeClassic", "Clássica"], ["#homeConquest", "Conquista"],
        ["#mapFixed", "Mapa Padrão"], ["#mapRandom", "Mapa Sorteado"],
        ...[0, 1, 2].map((i) => [`#homeProfiles [data-prof="${i}"]`, `estilo do rival ${i + 1}`]), ["#allRandom", "Todos aleatórios"],
        ["label.pg-switch", "Posição inicial aleatória"],
      ], "Personalizar");
      assert.ok(await page.locator("#homeMaxEras").isVisible(), "campo de duração livre");
      assert.deepEqual((await page.locator("#modeSlow, #modeFast").allInnerTexts()).map((t) => t.trim()), ["Normal", "Rápido"]);
      assert.deepEqual((await page.locator("#homeClassic, #homeConquest").allInnerTexts()).map((t) => t.trim()), ["Clássica", "Conquista"]);
      // Os controles funcionam e o resumo acompanha.
      await page.locator("#modeFast").click();
      await page.locator("#homeConquest").click();
      await page.locator("#homeMaxEras").fill("42");
      await page.locator("#homeMaxEras").press("Tab");
      await page.locator("label.pg-switch").click();
      assert.equal(await page.locator("#homeRandomStart").isChecked(), true, "tocar na linha liga a posição aleatória");
      assert.match(await page.locator("#customizeSummary").innerText(), /^42 eras · ritmo rápido · vitória por conquista · posição aleatória$/);
      assert.match(await page.locator("#setupSummary").innerText(), /3 rivais.*Médio.*42 eras.*Conquista.*posição aleatória.*ritmo rápido/);
      await page.locator("#mapRandom").click();
      assert.match(await page.locator("#customizeSummary").innerText(), /^42 eras · ritmo rápido · vitória por conquista · posição aleatória · mapa sorteado$/);
      assert.match(await page.locator("#setupSummary").innerText(), /posição aleatória · mapa sorteado · ritmo rápido/);
      assert.equal(await page.locator("#homeEraPresets .pg-other").evaluate((e) => e.classList.contains("on")), true, '"Outra" devia ficar marcada com 42 eras');
      assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal em Personalizar");
      assert.deepEqual(await clippedText(page, "#setupScreen"), [], "texto cortado em Nova partida/Personalizar");
      if (!wide) await screenshot(page, `personalizar-${name}`);
      // Voltar (Esc) e de novo: Personalizar volta fechado, as escolhas ficam.
      await page.keyboard.press("Escape");
      await page.locator("#setupScreen").waitFor({ state: "hidden" });
      await page.locator("#homeStart").click();
      assert.equal(await page.locator("#setupCustomize").evaluate((d) => d.open), false);
      assert.equal(await page.locator("#modeFast").getAttribute("aria-pressed"), "true");
      assert.deepEqual(errors, []);
      await context.close();
    });
  }

  test(`tela inicial com partida salva em ${name}: "Continuar · Era N" + "Nova partida", sem rolar (também com fonte larga)`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
    await page.locator("#homeStart").click();
    await page.locator('#homeDifficulty [data-diff="hardcore"]').click();
    await page.locator('#homeOpponents [data-ai="2"]').click();
    await page.locator("#setupStart").click();
    await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
    await page.evaluate(() => { state.ui.skipReport = true; });
    await choosePlan(page, "balanced");
    await concludeEraUI(page);
    await choosePlan(page, "balanced");
    await concludeEraUI(page);
    await menuClick(page, "#returnHome");
    const cont = page.locator("#homeContinue");
    await cont.waitFor({ state: "visible" });
    assert.match(await cont.innerText(), /^Continuar · Era 3\s+de 30 · Lendário · 2 rivais$/);
    assert.equal((await page.locator("#homeStart").innerText()).trim(), "Nova partida");
    const [c, n] = [await cont.boundingBox(), await page.locator("#homeStart").boundingBox()];
    assert.ok(c.y < n.y, '"Continuar" devia vir antes de "Nova partida"');
    for (const wide of [false, true]) {
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      assert.deepEqual(await homeFits(page), [], `tela inicial com partida salva${wide ? " (fonte larga)" : ""}`);
      assert.deepEqual(await horizontalOverflow(page), []);
      await assertTargets(page, [["#homeContinue", "Continuar"], ["#homeStart", "Nova partida"], ["#homeTutorial", "Tutorial"], ["#homeHowTo", "Como jogar"]], "início com partida");
      assert.deepEqual(await clippedText(page, "#homeScreen"), [], "texto cortado");
    }
    // Recarregar mantém o "Continuar" e ele retoma a partida.
    await page.reload();
    await page.waitForFunction(() => window.__imperiosReady === true && typeof state !== "undefined" && !!state);
    await cont.waitFor({ state: "visible" });
    await cont.click();
    await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 3);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test(`convite do tutorial em ${name}: folha embaixo com "Jogar o tutorial" e "Agora não" (≥ 48 px)`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" }, offerTutorial: true });
    const back = page.locator("#modalRoot .modal-back.modal-invite");
    await back.waitFor({ state: "visible" });
    assert.match(await back.innerText(), /Primeira vez em Impérios\?[\s\S]*5 passos[\s\S]*cerca de 2 min/);
    await assertTargets(page, [['#modalRoot button:has-text("Jogar o tutorial")', "Jogar o tutorial"], ['#modalRoot button:has-text("Agora não")', "Agora não"]], "convite");
    const box = await page.locator("#modalRoot .modal").boundingBox();
    assert.ok(Math.abs(box.y + box.height - page.viewportSize().height) <= 1, "o convite devia ficar colado embaixo");
    assert.deepEqual(await horizontalOverflow(page), []);
    await page.locator('#modalRoot button:has-text("Agora não")').click();
    assert.equal(await page.locator("#modalRoot").innerHTML(), "");
    assert.ok(await page.locator("#homeStart").isVisible());
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("fonte própria: Marcellus SC vem do próprio jogo (sem internet), no nome IMPÉRIOS e nos títulos; textos comuns na fonte do sistema", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: MOBILE_SCREENS[0][1] });
  const external = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://imperios.test/") && !r.url().startsWith("data:")) external.push(r.url()); });
  const r = await page.evaluate(async () => {
    const faces = await document.fonts.load('40px "Marcellus SC"', "IMPÉRIOS");
    const ff = (sel) => getComputedStyle(document.querySelector(sel)).fontFamily;
    return { loaded: faces.length, ok: document.fonts.check('40px "Marcellus SC"', "IMPÉRIOS"), brand: ff(".brand-word"), setup: ff("#setupTitle"), btn: ff("#homeStart") };
  });
  assert.ok(r.loaded >= 1 && r.ok, "a fonte Marcellus SC não carregou");
  assert.match(r.brand, /^"Marcellus SC"/);
  assert.match(r.setup, /^"Marcellus SC"/);
  assert.doesNotMatch(r.btn, /Marcellus/, "os botões devem usar a fonte do sistema");
  const fontUrls = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((u) => /\.woff2$/.test(u)));
  assert.deepEqual(fontUrls, ["http://imperios.test/assets/fonts/marcellus-sc-latin-400.woff2"]);
  assert.deepEqual(external, [], "pedidos fora do jogo");
  assert.deepEqual(errors, []);
  await context.close();
});

test("dev.html: os atalhos dos laboratórios continuam na tela inicial; no jogador o título da aba é só 'Impérios'", async () => {
  const dev = await openGame(browser, { contextOptions: { viewport: { width: 360, height: 640 } }, dev: true });
  for (const sel of ["#homeCompare", "#homeLab"]) await assertClickable(dev.page, sel);
  await dev.page.locator("#homeLab").click();
  await dev.page.waitForFunction(() => document.getElementById("homeScreen").hidden && document.getElementById("lab").classList.contains("active"));
  assert.deepEqual(dev.errors, []);
  await dev.context.close();
  const { context, page, errors } = await openGame(browser, { contextOptions: { viewport: { width: 360, height: 640 } } });
  assert.equal(await page.title(), "Impérios");
  const text = await page.evaluate(() => document.body.innerText);
  assert.doesNotMatch(text, /MVP|Funciona offline|sem instalação/);
  assert.deepEqual(errors, []);
  await context.close();
});
