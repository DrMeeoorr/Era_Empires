// Seletor de idioma (src/ui/language.js, 23/11/2026): botão 🌐 na tela inicial e item "Idioma" no menu ☰, folha com
// os 6 idiomas pelo nome nativo (radio + aria-checked), troca ao vivo sem mexer na partida, escolha gravada no
// aparelho, acessibilidade básica e os textos apertados apontados pelo tradutor (fr/de/it) cabendo em 360 px.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, MOBILE_SCREENS, KEYS, concludeEraUI, horizontalOverflow, openCustomize } = require("./helpers");

const NAMES = ["Português (Brasil)", "English", "Português (Portugal)", "Italiano", "Deutsch", "Français"];
const S360 = MOBILE_SCREENS.find(([n]) => n === "360x640")[1];
const PIXEL7 = MOBILE_SCREENS.find(([n]) => n === "Pixel 7")[1];
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const sheetOpen = (page) => page.evaluate(() => !document.getElementById("languageSheet").hidden);
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const [name, opts] of [["360x640", S360], ["Pixel 7", PIXEL7]]) {
  test(`${name}: botão de idioma na tela inicial (48 px, sem rolar, sem tapar "Jogar")`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: opts });
    const btn = page.locator("#homeLang");
    assert.ok(await btn.isVisible());
    const b = await btn.boundingBox(), vp = page.viewportSize();
    assert.ok(b.width >= 48 && b.height >= 48, `botão com ${b.width}×${b.height}`);
    assert.ok(b.x >= 0 && b.x + b.width <= vp.width && b.y >= 0 && b.y + b.height <= vp.height, "botão fora da tela");
    for (const sel of ["#homeStart", "#homeTutorial", "#homeHowTo", "#homeMedals", "#homeTitle"]) {
      const o = await page.locator(sel).boundingBox();
      assert.ok(!overlap(b, o), `o botão de idioma tapa ${sel}`);
    }
    assert.equal(await page.locator("#homeLangCode").innerText(), "PT-BR");
    assert.match(await btn.getAttribute("aria-label"), /^Idioma: Português \(Brasil\)/);
    assert.equal(await page.evaluate(() => { const h = document.getElementById("homeScreen"); return h.scrollHeight <= h.clientHeight + 1; }), true, "a tela inicial passou a rolar");
    assert.deepEqual(await horizontalOverflow(page), []);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("escolher English na tela inicial: tela em inglês, folha fecha, foco volta ao botão e a escolha fica gravada", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: S360 });
  await page.locator("#homeLang").click();
  const sheet = page.locator("#languageSheet");
  await sheet.waitFor({ state: "visible" });
  assert.deepEqual(await sheet.locator('[role="radio"] .lang-name').allInnerTexts(), NAMES);
  await sheet.locator('[role="radio"][data-lang="en"]').click();
  await sheet.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
  assert.equal(await page.locator("#homeStartLabel").innerText(), "Play");
  assert.equal(await page.locator("#homeLangCode").innerText(), "EN");
  assert.match(await page.locator("#homeLang").getAttribute("aria-label"), /^Language: English/);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "homeLang", "o foco devia voltar ao botão de idioma");
  assert.equal(await page.evaluate(() => localStorage.getItem("imperios-idioma")), "en");
  // Recarregar (sem ?lang=): continua em inglês, e a folha mostra English marcado.
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true);
  assert.equal(await page.locator("#homeStartLabel").innerText(), "Play");
  await page.locator("#homeLang").click();
  await sheet.waitFor({ state: "visible" });
  assert.equal(await sheet.locator('[aria-checked="true"]').getAttribute("data-lang"), "en");
  assert.equal(await page.locator("#languageSheetTitle").innerText(), "Language");
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  await context.close();
});

test("trocar de idioma pelo menu ☰ no meio da partida mantém era, estado, ouro dividido e save", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL7 });
  await page.locator("#homeStart").click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  await page.locator('[data-plan="attack"]').click();
  await concludeEraUI(page);
  await concludeEraUI(page);
  await page.locator('[data-plan="balanced"]').click();
  await page.waitForTimeout(200);
  const snap = () => page.evaluate((k) => ({ state: JSON.stringify(state), save: localStorage.getItem(k), spend: ["mil", "infra", "tech"].map((a) => document.getElementById(a + "Spend").value) }), KEYS.save);
  const before = await snap();
  assert.equal(JSON.parse(before.state).era, 3);
  await page.locator("#menuBtn").click();
  await page.locator("#menuSheet").waitFor({ state: "visible" });
  const item = page.locator("#menuLanguage");
  assert.match(await item.innerText(), /Idioma\s+Português \(Brasil\)/);
  assert.ok((await item.boundingBox()).height >= 48);
  await item.click();
  const sheet = page.locator("#languageSheet");
  await sheet.waitFor({ state: "visible" });
  assert.equal(await page.locator("#menuSheet").isVisible(), false, "o menu devia dar lugar à folha de idiomas");
  await sheet.locator('[data-lang="de"]').click();
  await sheet.waitFor({ state: "hidden" });
  await page.waitForTimeout(200);
  const afterChange = await snap();
  assert.equal(afterChange.state, before.state, "o estado da partida mudou ao trocar de idioma");
  assert.equal(afterChange.save, before.save, "o save mudou ao trocar de idioma");
  assert.deepEqual(afterChange.spend, before.spend, "o ouro dividido mudou");
  assert.match(await page.locator("#statEra").innerText(), /Ära\s*3/i);
  assert.match(await page.locator("#advance").innerText(), /Ära 3 beenden/);
  // O item do menu mostra o novo idioma; voltar ao português repõe os textos.
  await page.locator("#menuBtn").click();
  assert.match(await page.locator("#menuLanguage").innerText(), /Sprache\s+Deutsch/);
  await page.locator("#menuLanguage").click();
  await sheet.locator('[data-lang="pt-BR"]').click();
  await sheet.waitFor({ state: "hidden" });
  assert.match(await page.locator("#advance").innerText(), /Concluir era 3/);
  assert.equal(await page.evaluate(() => JSON.stringify(state)), before.state);
  assert.deepEqual(errors, []);
  await context.close();
});

test("acessibilidade da folha de idiomas: diálogo, radiogroup, aria-checked, lang, 48 px, teclado, Esc e Voltar", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: S360 });
  await page.locator("#homeLang").click();
  const sheet = page.locator("#languageSheet");
  await sheet.waitFor({ state: "visible" });
  const a11y = await page.evaluate(() => {
    const s = document.getElementById("languageSheet"), g = document.getElementById("languageList");
    return {
      role: s.getAttribute("role"), modal: s.getAttribute("aria-modal"), title: document.getElementById(s.getAttribute("aria-labelledby"))?.textContent.trim(),
      group: g.getAttribute("role"), groupLabel: document.getElementById(g.getAttribute("aria-labelledby"))?.textContent.trim(),
      hint: document.getElementById(g.getAttribute("aria-describedby"))?.textContent.trim(),
      radios: [...g.querySelectorAll('[role="radio"]')].map((r) => ({ lang: r.lang, code: r.dataset.lang, checked: r.getAttribute("aria-checked"), on: r.classList.contains("on"), h: r.getBoundingClientRect().height, w: r.getBoundingClientRect().width, tick: getComputedStyle(r.querySelector(".lang-radio .ic")).opacity })),
      homeInert: document.getElementById("homeScreen").inert, expanded: document.getElementById("homeLang").getAttribute("aria-expanded"),
    };
  });
  assert.equal(a11y.role, "dialog");
  assert.equal(a11y.modal, "true");
  assert.equal(a11y.title, "Idioma");
  assert.equal(a11y.group, "radiogroup");
  assert.equal(a11y.groupLabel, "Idioma");
  assert.match(a11y.hint, /partida continua igual/);
  assert.equal(a11y.radios.length, 6);
  assert.deepEqual(a11y.radios.map((r) => r.code), ["pt-BR", "en", "pt-PT", "it", "de", "fr"]);
  assert.deepEqual(a11y.radios.map((r) => r.lang), ["pt-BR", "en", "pt-PT", "it", "de", "fr"], "cada nome devia ter o lang da própria língua");
  assert.deepEqual(a11y.radios.map((r) => r.checked), ["true", "false", "false", "false", "false", "false"]);
  // O atual não depende só da cor: tem o ✓ visível (os outros não).
  assert.deepEqual(a11y.radios.map((r) => r.tick), ["1", "0", "0", "0", "0", "0"]);
  for (const r of a11y.radios) assert.ok(r.h >= 48 && r.w >= 48, `${r.code}: alvo de ${r.w}×${r.h}`);
  assert.equal(a11y.homeInert, true, "a tela inicial devia ficar inerte por trás da folha");
  assert.equal(a11y.expanded, "true");
  // Foco no idioma atual; setas movem o foco sem trocar; Esc fecha sem trocar e devolve o foco.
  await page.waitForFunction(() => document.activeElement?.dataset?.lang === "pt-BR");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.lang), "en");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.lang), "fr", "a seta devia dar a volta");
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.documentElement.lang), "pt-BR");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "homeLang");
  assert.equal(await page.evaluate(() => localStorage.getItem("imperios-idioma")), null, "fechar sem escolher não devia gravar");
  // Botão Voltar do Android/navegador fecha a folha.
  await page.locator("#homeLang").click();
  await sheet.waitFor({ state: "visible" });
  await page.goBack();
  await sheet.waitFor({ state: "hidden" });
  assert.equal(await page.locator("#homeScreen").isVisible(), true);
  // Teclado: Enter escolhe (Italiano).
  await page.locator("#homeLang").click();
  await sheet.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.activeElement?.dataset?.lang === "pt-BR");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await sheet.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.documentElement.lang), "it");
  assert.equal(await page.locator("#homeStartLabel").innerText(), "Gioca");
  assert.equal(await sheetOpen(page), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test("primeira abertura com o idioma do aparelho: nenhuma pergunta obrigatória, o convite do tutorial abre normalmente", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { ...S360, locale: "fr-FR" }, offerTutorial: true });
  assert.equal(await page.evaluate(() => document.documentElement.lang), "fr");
  assert.equal(await sheetOpen(page), false, "a folha de idiomas não devia abrir sozinha");
  assert.equal(await page.evaluate(() => localStorage.getItem("imperios-idioma")), null, "o idioma do aparelho não devia ser gravado");
  assert.equal(await page.locator("#homeLangCode").innerText(), "FR");
  await page.waitForFunction(() => document.getElementById("modalRoot").childElementCount > 0, null, { timeout: 5000 });
  assert.match(await page.locator("#modalRoot").innerText(), /Tutoriel/i, "o convite do tutorial devia abrir (em francês)");
  assert.deepEqual(errors, []);
  await context.close();
});

// Textos apertados apontados pelo tradutor (23/11/2026), em 360×640.
for (const lang of ["pt-BR", "en", "pt-PT", "it", "de", "fr"]) {
  test(`${lang}: textos apertados cabem em 360 px (Como jogar, Duração, Terrenos, menu, legenda, fim de jogo)`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...S360, reducedMotion: "reduce" }, query: "?lang=" + lang });
    const oneLine = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => { const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.25; return [el.textContent.trim(), Math.round(el.getBoundingClientRect().height / lh)]; }), sel);
    for (const [txt, n] of await oneLine("#homeTutorial > span, #homeHowTo > span")) assert.equal(n, 1, `"${txt}" quebra em ${n} linhas`);
    await page.locator("#homeStart").click();
    await openCustomize(page);
    const over = await page.evaluate(() => [...document.querySelectorAll("#homeEraPresets > *, #terrVisual, #terrEffects")].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent));
    assert.deepEqual(over, [], "opção cortada");
    for (const [txt, n] of await oneLine("#terrVisual > small, #terrEffects > small")) assert.equal(n, 1, `"${txt}" quebra em ${n} linhas`);
    await page.locator("#setupStart").click();
    await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
    assert.equal(await page.evaluate(() => { const l = document.getElementById("mapLegend"); return l.scrollWidth <= l.clientWidth + 1; }), true, "a legenda do mapa não cabe (último item cortado)");
    await page.locator("#menuBtn").click();
    await page.locator("#menuSheet").waitFor({ state: "visible" });
    assert.ok((await page.locator("#summaryToggle").boundingBox()).height <= 56, "o item do resumo da era quebrou em duas linhas");
    await page.keyboard.press("Escape");
    await page.evaluate(() => { state.ui.skipReport = true; while (!state.result) { P(state).military += 50; for (const t of eligibleTargets(state, "player")) attackTerritory(state, t.i, "player", configApplied, true); playEra({ military: 0, infrastructure: P(state).treasury, technology: 0 }); if (dominionAsking(state)) chooseDominion(true); } renderAll(); });
    await page.locator("#resultScreen").waitFor({ state: "visible" });
    for (const [txt, n] of await oneLine("#resultScreen .res-tile .k")) assert.ok(n <= 2, `"${txt}" quebra em ${n} linhas`);
    assert.deepEqual(errors, []);
    await context.close();
  });
}
