// Textos traduzidos (src/i18n): todos os dicionários completos e com os mesmos marcadores, campos de valor com o
// separador decimal do idioma, textos do motor traduzidos só na exibição, tela em inglês sem pt-BR nem chaves cruas,
// e troca de idioma ao vivo na tela inicial.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { launch, openGame, ROOT, openCustomize, menuClick, concludeEraUI } = require("./helpers");

const i18n = () => import(pathToFileURL(path.join(ROOT, "src/i18n/index.js")).href);
const marks = (v) => [...new Set(JSON.stringify(v).match(/\{\w+\}/g) || [])].sort().join(",");
const tags = (v) => (JSON.stringify(v).match(/<\/?[a-z]+/g) || []).sort().join(",");

// ── Sem navegador ──

test("todos os dicionários têm exatamente as chaves do pt-BR, os mesmos marcadores e as mesmas etiquetas HTML", async () => {
  const { DICTIONARIES } = await i18n();
  const base = DICTIONARIES["pt-BR"], problems = [];
  assert.ok(Object.keys(base).length > 500, "dicionário pt-BR incompleto");
  for (const [code, dict] of Object.entries(DICTIONARIES)) {
    if (code === "pt-BR") continue;
    for (const k of Object.keys(base)) {
      if (!(k in dict)) { problems.push(`${code}: falta ${k}`); continue; }
      const v = dict[k];
      if (marks(v) !== marks(base[k])) problems.push(`${code}: ${k} com marcadores diferentes`);
      if (typeof base[k] === "string" && tags(v) !== tags(base[k])) problems.push(`${code}: ${k} com HTML diferente`);
      if (typeof v === "object" && (v === null || typeof v.other !== "string")) problems.push(`${code}: ${k} plural sem "other"`);
      if (typeof v === "string" && !v.trim()) problems.push(`${code}: ${k} vazio`);
    }
    for (const k of Object.keys(dict)) if (!(k in base)) problems.push(`${code}: chave ${k} não existe no pt-BR`);
  }
  assert.deepEqual(problems, []);
});

test("plural: 'zero' vale para o número 0; ordinais por idioma", async () => {
  const m = await i18n();
  await m.setLanguage("pt-BR", { persist: false });
  assert.equal(m.t("end.tile.conquests", { count: 0 }), "conquistas");
  assert.equal(m.t("end.tile.conquests", { count: 1 }), "conquista");
  assert.equal(m.ordinal(2), "2.º");
  assert.equal(m.ordinal(1, "format.ordinalF"), "1.ª");
  assert.deepEqual([1, 2, 3, 4, 11, 22].map((n) => m.ordinal(n, "format.ordinal", "en")), ["1st", "2nd", "3rd", "4th", "11th", "22nd"]);
  assert.deepEqual([1, 2].map((n) => m.ordinal(n, "format.ordinal", "fr")), ["1er", "2e"]);
  assert.equal(m.ordinal(3, "format.ordinal", "de"), "3.");
  await m.setLanguage("en", { persist: false });
  assert.equal(m.t("common.rivals", { n: 2 }), "2 rivals");
  await m.setLanguage("pt-BR", { persist: false });
});

test("campos de valor: separador decimal do idioma (fmtInput / parseAmount)", async () => {
  const { fmtInput, parseAmount } = await import(pathToFileURL(path.join(ROOT, "src/ui/format.js")).href);
  // pt-BR (como sempre) e os outros idiomas com vírgula decimal.
  for (const lang of ["pt-BR", "pt-PT", "it", "de", "fr"]) {
    assert.equal(fmtInput(12.5, lang), "12,5", lang);
    assert.equal(fmtInput(1250.75, lang), "1250,75", lang);
    assert.deepEqual(["12,5", "12.5", "1.250", "1.250,75", "", "abc", "1 250,5"].map((x) => parseAmount(x, lang)), [12.5, 12.5, 1250, 1250.75, 0, 0, 1250.5], lang);
  }
  // Inglês: ponto decimal, vírgula de milhar ("1,250" = 1250); "12,5" (vírgula sem grupos de 3) continua 12,5.
  assert.equal(fmtInput(12.5, "en"), "12.5");
  assert.equal(fmtInput(3, "en"), "3");
  assert.deepEqual(["12.5", "1,250", "1,250.75", "12,5", "1.250", "", "abc"].map((x) => parseAmount(x, "en")), [12.5, 1250, 1250.75, 12.5, 1.25, 0, 0]);
  // O que um idioma escreve, o outro lê com o mesmo valor (trocar o idioma a meio não muda o investimento).
  for (const v of [0, 7, 12.5, 99.99, 1234.56]) {
    assert.equal(parseAmount(fmtInput(v, "pt-BR"), "en"), v);
    assert.equal(parseAmount(fmtInput(v, "en"), "pt-BR"), v);
  }
});

// ── No navegador ──

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

// Palavras do pt-BR que não podem sobrar na versão em inglês (nomes de regiões ficam de fora: são iguais em todos os idiomas).
const PT_WORDS = /\b(você|voc[eê]s|de ouro|ouro|partida|região|regiões|Força|Obras|Ciência|Concluir|Jogar|Nova|rivais|Dificuldade|Médio|Lendário|Personalizar|Campina|Floresta|Pântano|Placar|Medalhas|Voltar|Fechar|terrenos?|vitória|não|também|para|com|uma|sem limite|ritmo|Rubro|Anil)\b/i;
const REGIONS_RE = /\b(Arvela|Brumas|Cardo|Dorna|Esmera|Fenda|Gralha|Hélia|Ivara|Jaspe|Lumen|Musgo|Névoa|Ombral|Pedral|Quartzo|Rochedo|Salgar|Torva|Urzal|Vau|Velar|Xisto|Zênite)\b/g;
const KEY_RE = /\b(app|home|setup|map|tut|medals?|help|terrain|format|common|civ|rival|style|diff|save|idle|dom|restart|hud|alloc|gd|wd|race|res|details|vic|sup|end|sum|menu|log|result|reason|refuse|plan)\.[a-zA-Z][\w.]*\b/;

async function screenText(page) {
  return page.evaluate(() => {
    const attrs = [...document.querySelectorAll("[aria-label],[title]")].filter((el) => !el.closest(".dev-only")).flatMap((el) => [el.getAttribute("aria-label"), el.getAttribute("title")]).filter(Boolean);
    return [document.body.innerText, ...attrs, document.title].join("\n");
  });
}
function scan(where, text, problems) {
  for (const line of text.split("\n")) {
    const l = line.replace(REGIONS_RE, "");
    const m = l.match(PT_WORDS);
    if (m) problems.push(`${where}: "${m[0]}" em «${line.trim().slice(0, 100)}»`);
    const k = l.match(KEY_RE);
    if (k) problems.push(`${where}: chave crua ${k[0]}`);
  }
}

test("?lang=en: telas do jogador sem palavras em pt-BR, sem chaves cruas e sem chaves em falta", async () => {
  const { context, page, errors } = await openGame(browser, { query: "?lang=en" });
  const problems = [];
  scan("tela inicial", await screenText(page), problems);
  await page.locator("#homeHowTo").click();
  await page.locator("#howToFull > summary").click();
  scan("Como jogar", await screenText(page), problems);
  await page.locator("#howToOk").click();
  await page.locator("#homeMedals").click();
  scan("Medalhas", await screenText(page), problems);
  await page.locator("#medalsOk").click();
  await page.locator("#homeStart").click();
  await openCustomize(page);
  for (const n of ["1", "3"]) {
    await page.locator(`#homeOpponents [data-ai="${n}"]`).click();
    for (const s of ["1", "2"]) {
      await page.locator(`#homeMapSize [data-map-size="${s}"]`).click();
      scan(`Nova partida (${n} rival, mapa ${s})`, await screenText(page), problems);
    }
  }
  await page.locator('#homeMapSize [data-map-size="1"]').click();
  await page.locator('#homeOpponents [data-ai="1"]').click();
  await page.locator("#terrEffects").click();
  scan("Nova partida (efeitos)", await screenText(page), problems);
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden);
  scan("partida", await screenText(page), problems);
  for (const open of ["#scorePill", "#fineBtn", "#terrainBtn", "#menuBtn"]) {
    await menuClick(page, open);
    await page.waitForFunction(() => !!document.querySelector(".sheet:not([hidden]),[data-sheet]:not([hidden])"));
    scan(`folha ${open}`, await screenText(page), problems);
    await page.evaluate(() => closeSheet({ focus: false }));
  }
  // Região vizinha (folha de ataque), uma era concluída com ordem dada e os Detalhes (registo do motor traduzido).
  await page.locator('[data-plan="attack"]').click();
  await concludeEraUI(page);
  const tgt = await page.evaluate(() => eligibleTargets(state, "player")[0].i);
  await page.locator(`[data-territory="${tgt}"]`).click();
  scan("folha de ataque", await screenText(page), problems);
  await page.evaluate(() => closeSheet({ focus: false }));
  // Textos do motor: frases conhecidas viram inglês (o registo guardado continua em português).
  const engine = await page.evaluate(() => [
    engineText("✅ Ataque bem-sucedido: território 9 (neutro) — saque: 1,5 u. de tesouro, 2 u. de infraestrutura."),
    engineText("🛡️ Ataque de Rubro repelido: território 8; 12,3 pontos comprometidos."),
    engineText("↩️ Ordem de Você contra o território 3 cancelada (já não é possível atacar); poder devolvido."),
    engineText("🏁 Era 12: vitória de Jogador por maioria territorial + supremacia (mantida até a última era)."),
    engineText("Poder insuficiente: precisa de 1 234,5 pontos (2.º ataque da era, custo ×2)."),
  ]);
  assert.deepEqual(engine, [
    "✅ Successful attack: Ivara (free) — plunder: 1.5 gold, 2 gold in Works.",
    "🛡️ Crimson's attack repelled: Hélia; 12.3 Might spent.",
    "↩️ Your order against Cardo canceled (attacking is no longer possible); Might returned.",
    "🏁 Era 12: you won by territorial majority + supremacy (held until the last era).",
    "Not enough Might: you need 1,234.5 Might (2nd attack of the era, cost ×2).",
  ]);
  await menuClick(page, '#menuSheet [data-open="details"]');
  scan("Detalhes", await screenText(page), problems);
  assert.deepEqual(await page.evaluate(() => [...missingKeys]), [], "chaves pedidas que não existem");
  assert.deepEqual(problems, []);
  assert.deepEqual(errors, []);
  await context.close();
});

test("trocar o idioma ao vivo atualiza a tela inicial e a configuração; voltar ao pt-BR restaura os textos", async () => {
  const { context, page, errors } = await openGame(browser);
  const read = () => page.evaluate(() => ({
    start: document.getElementById("homeStartLabel").textContent,
    tagline: document.querySelector("[data-i18n='home.tagline']").textContent,
    howTo: document.getElementById("homeHowTo").textContent.trim(),
    medals: document.getElementById("homeMedals").getAttribute("aria-label"),
    summary: document.getElementById("setupSummary").textContent,
    diff: document.getElementById("homeDiffDesc").textContent,
    rival: document.querySelector("#homeProfiles .profile-row span")?.textContent.trim() ?? "",
  }));
  const pt = await read();
  assert.equal(pt.start, "Jogar");
  assert.match(pt.summary, /^1 rival .* · Médio · 30 eras · ritmo normal$/);
  await page.evaluate(() => setLanguage("en", { persist: false }));
  const en = await read();
  assert.equal(en.start, "Play");
  assert.equal(en.tagline, "One era at a time");
  assert.equal(en.howTo, "How to play");
  assert.match(en.medals, /^Medals: 0 of 12$/);
  assert.match(en.summary, /^1 rival \(adaptive\) · Medium · 30 eras · normal pace$/);
  assert.match(en.diff, /^Rivals play by the same rules/);
  assert.match(en.rival, /Crimson$/);
  await page.evaluate(() => setLanguage("fr", { persist: false }));
  assert.equal((await read()).start, "Jouer");
  await page.evaluate(() => setLanguage("pt-BR", { persist: false }));
  assert.deepEqual(await read(), pt, "voltar ao pt-BR deixa a tela como era");
  assert.deepEqual(errors, []);
  await context.close();
});
