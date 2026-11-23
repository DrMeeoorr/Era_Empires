// Idiomas da interface (src/i18n, regras em docs/idiomas.md): idioma padrão pelo aparelho, ?lang=, escolha
// gravada no aparelho (fora do save), reserva em pt-BR, plural e números por idioma, e que trocar o idioma não muda
// nada no jogo (impressão digital das simulações igual).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launch, openGame, ROOT, concludeEraUI } = require("./helpers");
const { EXPECTED, fingerprintInPage } = require("./fingerprint");

const LANG_KEY = "imperios-idioma";
const SAVE_KEY = "imperios-jogador-partida";
const i18n = () => import(pathToFileURL(path.join(ROOT, "src/i18n/index.js")).href);

// ── Sem navegador ──

test("idioma do aparelho: pt-PT → pt-PT, outros pt → pt-BR, en/it/de/fr pelas duas letras, senão pt-BR", async () => {
  const { matchLanguage, detectLanguage, SUPPORTED_LANGUAGES } = await i18n();
  assert.deepEqual(SUPPORTED_LANGUAGES.map((l) => [l.code, l.name]), [
    ["pt-BR", "Português (Brasil)"], ["en", "English"], ["pt-PT", "Português (Portugal)"],
    ["it", "Italiano"], ["de", "Deutsch"], ["fr", "Français"],
  ]);
  const cases = {
    "pt-BR": "pt-BR", pt: "pt-BR", "pt-AO": "pt-BR", "pt-PT": "pt-PT", "pt_pt": "pt-PT", "PT-pt": "pt-PT",
    "en-US": "en", "en-GB": "en", en: "en", "it-IT": "it", "it-CH": "it", "de-DE": "de", "de-AT": "de",
    "fr-FR": "fr", "fr-CA": "fr", "es-ES": null, "ja": null, "": null,
  };
  for (const [tag, want] of Object.entries(cases)) assert.equal(matchLanguage(tag), want, tag);
  assert.equal(detectLanguage(["es-ES", "fr-FR", "en"]), "fr", "o primeiro suportado da lista ganha");
  assert.equal(detectLanguage(["es-ES", "ja"]), "pt-BR");
  assert.equal(detectLanguage([]), "pt-BR");
  assert.equal(detectLanguage(undefined), "pt-BR");
});

test("t(): marcadores, plural por idioma, reserva em pt-BR e chave sem texto", async () => {
  const m = await i18n();
  await m.setLanguage("pt-BR", { persist: false });
  assert.equal(m.t("format.gold", { n: "1.234,5" }), "1.234,5 de ouro");
  assert.equal(m.t("common.rivals", { n: 1 }), "1 rival");
  assert.equal(m.t("common.rivals", { n: 3 }), "3 rivais");
  assert.equal(m.t("common.rivals", { n: 1234 }), "1.234 rivais", "números dos marcadores no formato do idioma");
  assert.equal(m.t("format.gold"), "{n} de ouro", "marcador sem valor fica como está");
  // Chave que falta no inglês usa o pt-BR; chave que não existe devolve a própria chave e é anotada.
  await m.setLanguage("en", { persist: false });
  assert.equal(m.t("app.title"), "EMPIRES");
  assert.equal(m.t("home.tagline"), "Uma era de cada vez");
  assert.equal(m.t("nao.existe.chave"), "nao.existe.chave");
  assert.ok(m.missingKeys.has("nao.existe.chave"));
  // Plural: categorias do Intl.PluralRules de cada idioma (o francês trata 0 como singular).
  assert.equal(m.pluralCategory(0, "fr"), "one");
  assert.equal(m.pluralCategory(0, "en"), "other");
  assert.equal(m.pluralCategory(1, "de"), "one");
  m.DICTIONARIES.fr["test.plural"] = { one: "{n} rival", other: "{n} rivaux" };
  await m.setLanguage("fr", { persist: false });
  assert.equal(m.t("test.plural", { n: 0 }), "0 rival");
  assert.equal(m.t("test.plural", { n: 2 }), "2 rivaux");
  delete m.DICTIONARIES.fr["test.plural"];
  // Código inválido não troca.
  assert.equal(await m.setLanguage("xx", { persist: false }), false);
  assert.equal(m.getLanguage(), "fr");
  await m.setLanguage("pt-BR", { persist: false });
});

test("números por idioma; o pt-BR continua igual ao formato de sempre (1.234,5)", async () => {
  const { formatNumber } = await i18n();
  const old = (n, d = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  for (const n of [0, 1, 12.5, 1234.5, 1234567.891, -42.25]) for (const d of [0, 1, 2]) assert.equal(formatNumber(n, d, "pt-BR"), old(n, d));
  assert.equal(formatNumber(1234.5, 1, "pt-BR"), "1.234,5");
  assert.equal(formatNumber(1234.5, 1, "en"), "1,234.5");
  assert.equal(formatNumber(1234.5, 1, "de"), "1.234,5");
  // Italiano e pt-PT seguem a norma do idioma (CLDR): sem separador de milhar com só 4 algarismos.
  assert.equal(formatNumber(1234.5, 1, "it"), "1234,5");
  assert.equal(formatNumber(12345.5, 1, "it"), "12.345,5");
  assert.match(formatNumber(1234.5, 1, "fr"), /^1\s234,5$/u);
  assert.match(formatNumber(12345.5, 1, "pt-PT"), /^12\s345,5$/u);
  assert.equal(formatNumber(NaN, 1, "en"), "—");
});

test("dicionários: só chaves do pt-BR e os mesmos marcadores {…}; módulos de idioma entram na versão do jogador", async () => {
  const { DICTIONARIES, SUPPORTED_LANGUAGES } = await i18n();
  assert.deepEqual(Object.keys(DICTIONARIES).sort(), SUPPORTED_LANGUAGES.map((l) => l.code).sort());
  const base = DICTIONARIES["pt-BR"];
  const marks = (v) => [...new Set(JSON.stringify(v).match(/\{\w+\}/g) || [])].sort();
  const problems = [];
  for (const [code, dict] of Object.entries(DICTIONARIES))
    for (const [k, v] of Object.entries(dict)) {
      if (!(k in base)) problems.push(`${code}: chave ${k} não existe no pt-BR`);
      else if (JSON.stringify(marks(v)) !== JSON.stringify(marks(base[k]))) problems.push(`${code}: ${k} com marcadores diferentes`);
    }
  assert.deepEqual(problems, []);
  // A versão do jogador (index.html → src/main-player.js) carrega os módulos de idioma pela cadeia de importações.
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
  assert.match(read("index.html"), /src\/main-player\.js/);
  assert.match(read("index.html"), /data-i18n="app\.title"/);
  assert.match(read("src/ui/boot.js"), /from "\.\.\/i18n\/index\.js"/);
  for (const f of ["pt-BR", "en", "pt-PT", "it", "de", "fr"]) assert.match(read("src/i18n/index.js"), new RegExp(`from "\\./${f}\\.js"`));
});

// ── No navegador ──

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

const langOf = (page) => page.evaluate(() => ({ lang: getLanguage(), html: document.documentElement.lang, title: document.getElementById("homeTitle").textContent, tab: document.title, source: languageSource }));

test("idioma padrão pelo idioma do aparelho (navigator.languages)", async () => {
  const cases = [["pt-BR", "pt-BR", "IMPÉRIOS"], ["en-US", "en", "EMPIRES"], ["pt-PT", "pt-PT", "IMPÉRIOS"], ["it-IT", "it", "IMPERI"],
    ["de-DE", "de", "IMPERIEN"], ["fr-CA", "fr", "EMPIRES"], ["es-ES", "pt-BR", "IMPÉRIOS"], ["pt-AO", "pt-BR", "IMPÉRIOS"]];
  for (const [locale, want, title] of cases) {
    const { context, page, errors } = await openGame(browser, { contextOptions: { locale } });
    const got = await langOf(page);
    assert.equal(got.lang, want, locale);
    assert.equal(got.html, want, `<html lang> (${locale})`);
    assert.equal(got.title, title, `título (${locale})`);
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY), null, "o padrão do aparelho não é gravado");
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test("?lang=xx escolhe o idioma só nesta abertura (não grava); código inválido segue o aparelho", async () => {
  {
    const { context, page, errors } = await openGame(browser, { query: "?lang=de" });
    const got = await langOf(page);
    assert.deepEqual([got.lang, got.html, got.title, got.tab, got.source], ["de", "de", "IMPERIEN", "Imperien", "url"]);
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY), null);
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { context, page } = await openGame(browser, { contextOptions: { locale: "en-US" }, query: "?lang=pt-pt" });
    assert.equal((await langOf(page)).lang, "pt-PT");
    await context.close();
  }
  {
    const { context, page } = await openGame(browser, { contextOptions: { locale: "it-IT" }, query: "?lang=xx" });
    assert.equal((await langOf(page)).lang, "it");
    await context.close();
  }
  {
    // Também na versão de desenvolvimento.
    const { context, page } = await openGame(browser, { dev: true, query: "?lang=fr" });
    assert.equal((await langOf(page)).lang, "fr");
    await context.close();
  }
});

test("setLanguage grava a escolha no aparelho (fora do save), redesenha e não mexe na partida", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: { locale: "en-US" } });
  assert.equal((await langOf(page)).lang, "en");
  await page.locator("#homeStart").click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  await page.evaluate(() => (state.ui.skipReport = true));
  await page.locator('[data-plan="balanced"]').click();
  await concludeEraUI(page);
  const before = await page.evaluate((k) => ({ state: JSON.stringify(state), save: localStorage.getItem(k) }), SAVE_KEY);
  const out = await page.evaluate(async () => {
    let events = 0, renders = 0;
    window.addEventListener("imperios:language", () => events++);
    onHook("afterRender", () => renders++);
    const ok = await setLanguage("de");
    return { ok, events, renders, lang: getLanguage(), html: document.documentElement.lang, title: document.getElementById("homeTitle").textContent, back: document.getElementById("setupBack").getAttribute("aria-label") };
  });
  assert.deepEqual(out, { ok: true, events: 1, renders: 1, lang: "de", html: "de", title: "IMPERIEN", back: "Voltar" });
  const after = await page.evaluate((k) => ({ state: JSON.stringify(state), save: localStorage.getItem(k) }), SAVE_KEY);
  assert.equal(after.state, before.state, "trocar o idioma mudou a partida");
  assert.equal(after.save, before.save, "trocar o idioma regravou o save");
  assert.ok(!Object.keys(JSON.parse(after.save)).some((k) => /lang|idioma/i.test(k)), "o idioma não faz parte do save");
  assert.equal(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY), "de");
  // A partida continua normalmente no outro idioma.
  await page.locator('[data-plan="balanced"]').click();
  await concludeEraUI(page);
  assert.equal(await page.evaluate(() => state.era), 3);
  // Ao reabrir, a escolha gravada vale mais que o idioma do aparelho (en-US); ?lang= vale mais que a escolha.
  await page.reload();
  await page.waitForFunction(() => window.__imperiosReady === true);
  assert.deepEqual(await page.evaluate(() => [getLanguage(), languageSource, state.era]), ["de", "saved", 3]);
  await page.goto(page.url().split("?")[0] + "?lang=it");
  await page.waitForFunction(() => window.__imperiosReady === true);
  assert.equal(await page.evaluate(() => getLanguage()), "it");
  assert.equal(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY), "de");
  // Voltar ao pt-BR restaura os textos de origem.
  assert.equal(await page.evaluate(async () => { await setLanguage("pt-BR"); return document.getElementById("homeTitle").textContent + "|" + document.title; }), "IMPÉRIOS|Impérios");
  assert.deepEqual(errors, []);
  await context.close();
});

test(`trocar o idioma não muda a impressão digital das simulações (${EXPECTED})`, async () => {
  const { context, page, errors } = await openGame(browser, { dev: true, query: "?lang=en" });
  await page.evaluate(() => setLanguage("de"));
  const out = await page.evaluate(fingerprintInPage);
  await context.close();
  assert.deepEqual(errors, []);
  assert.equal(out.pass, out.total, `testes internos: ${out.tests}`);
  assert.equal(out.all, EXPECTED, "impressão digital mudou com o idioma; subcódigos: " + JSON.stringify(out.parts));
});
