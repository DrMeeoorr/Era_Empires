// Tela de resultado: domínio, supremacia e eliminação vencem sem olhar os pontos. Quando o vencedor não é o 1.º nos
// pontos (ou o jogador perde liderando os pontos), o subtítulo explica isso em vez de só dar a posição.
// Só texto: as regras não mudam. Confere os 6 idiomas e que o texto cabe em 360×640 (de/fr são os mais longos).
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, MOBILE_SCREENS, horizontalOverflow, screenshot } = require("./helpers");

const SMALL = MOBILE_SCREENS.find(([n]) => n === "360x640")[1];
let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

/** Põe um resultado na partida e desenha a tela final. scores: pontos do jogador e do rival. */
async function showResult(page, { winner, reason, player, rival, kept = false }) {
  return page.evaluate(({ winner, reason, player, rival, kept }) => {
    const ai = state.civs[1].id, w = winner === "player" ? "player" : ai;
    const parts = { military: 0, infrastructure: 0, technology: 0, treasury: 0, territories: 0 };
    state.result = { era: state.era, type: "victory", winners: [w], reasons: { [w]: [reason] }, scores: [{ id: "player", score: player, parts }, { id: ai, score: rival, parts }], ...(kept ? { dominionKept: true } : {}) };
    // A tela só se refaz quando muda a era, o título ou o idioma; aqui o título repete-se entre casos.
    document.getElementById("resultScreen").dataset.key = "";
    renderAll();
    const sub = document.querySelector("#resultScreen .res-sub");
    return { title: document.getElementById("resultTitle").textContent, sub: sub.textContent, subFits: sub.scrollWidth <= sub.clientWidth + 1 };
  }, { winner, reason, player, rival, kept });
}

const WIDE_FONT = '*{font-family:"DejaVu Sans",sans-serif!important}';
async function openInGame(lang, wide = false) {
  const o = await openGame(browser, { contextOptions: SMALL, query: "?lang=" + lang });
  if (wide) {
    await o.page.addStyleTag({ content: WIDE_FONT });
    assert.ok(await o.page.evaluate(() => document.fonts.check('16px "DejaVu Sans"')), "fonte DejaVu Sans indisponível");
  }
  await o.page.locator("#homeStart").click();
  await o.page.locator("#setupStart").click();
  await o.page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
  return o;
}

test("pt-BR: vitória por domínio/supremacia/eliminação sem liderar os pontos explica que vence mesmo assim", async () => {
  const { context, page, errors } = await openInGame("pt-BR");
  let r = await showResult(page, { winner: "player", reason: "territorial", player: 0.4, rival: 0.6 });
  assert.equal(r.title, "Vitória por domínio do mapa!");
  assert.equal(r.sub, "Você controla 70% das regiões — o domínio vence, mesmo sem liderar nos pontos.");
  r = await showResult(page, { winner: "player", reason: "territorial", player: 0.4, rival: 0.6, kept: true });
  assert.match(r.sub, /^Você manteve \d+ de 24 regiões até a última era\. O domínio vence, mesmo sem liderar nos pontos\.$/);
  r = await showResult(page, { winner: "player", reason: "supremacy", player: 0.4, rival: 0.6 });
  assert.equal(r.sub, "Você liderou com folga por 5 eras seguidas — a supremacia vence, mesmo sem liderar nos pontos.");
  r = await showResult(page, { winner: "player", reason: "elimination", player: 0.4, rival: 0.6 });
  assert.equal(r.sub, "Você eliminou todos os rivais — a eliminação vence, mesmo sem liderar nos pontos.");
  // Liderando os pontos: continua só a posição, como antes.
  r = await showResult(page, { winner: "player", reason: "territorial", player: 0.7, rival: 0.3 });
  assert.equal(r.sub, "Você terminou em 1.º de 2.");
  // Vitória por pontos: nada muda.
  r = await showResult(page, { winner: "player", reason: "score", player: 0.7, rival: 0.3 });
  assert.equal(r.sub, "Você terminou em 1.º de 2.");
  // Caso inverso: o rival vence por domínio com você à frente nos pontos.
  r = await showResult(page, { winner: "rival", reason: "territorial", player: 0.6, rival: 0.4 });
  assert.equal(r.title, "Derrota");
  assert.match(r.sub, /^▲ ?Rubro controla 70% das regiões — o domínio vence, mesmo com você à frente nos pontos\.$/);
  r = await showResult(page, { winner: "rival", reason: "supremacy", player: 0.6, rival: 0.4 });
  assert.match(r.sub, /Rubro liderou com folga por 5 eras seguidas — a supremacia vence, mesmo com você à frente nos pontos\.$/);
  // Rival que vence liderando os pontos: o texto de sempre.
  r = await showResult(page, { winner: "rival", reason: "territorial", player: 0.3, rival: 0.7 });
  assert.match(r.sub, /Rubro venceu por domínio do mapa\. Você ficou em 2\.º\.$/);
  assert.deepEqual(errors, []);
  await context.close();
});

// Também com a fonte larga DejaVu Sans (a do GitHub Actions e de vários Android).
for (const wide of [false, true]) test(`os 6 idiomas têm o texto novo e cabem em 360×640 (de e fr incluídos)${wide ? " com fonte larga (DejaVu Sans)" : ""}`, async () => {
  const want = {
    en: [/domination wins, even without leading on points/, /domination wins, even with you ahead on points/],
    "pt-PT": [/^Controla 70% das regiões — o domínio vence/, /mesmo consigo à frente nos pontos/],
    it: [/il dominio vince, anche senza essere in testa ai punti/, /anche se sei tu in testa ai punti/],
    de: [/^Du hältst 70\u00a0% der Regionen – Gebietsherrschaft siegt/, /auch wenn du nach Punkten führst/],
    fr: [/^Vous contrôlez 70 % des régions — la domination l'emporte/, /même si vous menez aux points/],
    "pt-BR": [/o domínio vence, mesmo sem liderar/, /mesmo com você à frente/],
  };
  for (const [lang, [winRe, lostRe]] of Object.entries(want)) {
    const { context, page, errors } = await openInGame(lang, wide);
    for (const [args, re] of [[{ winner: "player", reason: "territorial", player: 0.4, rival: 0.6 }, winRe], [{ winner: "rival", reason: "territorial", player: 0.6, rival: 0.4 }, lostRe],
      [{ winner: "player", reason: "supremacy", player: 0.4, rival: 0.6 }, /\S/], [{ winner: "rival", reason: "elimination", player: 0.6, rival: 0.4 }, /\S/]]) {
      const r = await showResult(page, args);
      assert.match(r.sub, re, `${lang}: ${r.sub}`);
      assert.ok(!/end\.(winNoLead|lostLead)/.test(r.sub), `${lang}: chave sem texto`);
      assert.ok(r.subFits, `${lang}: subtítulo cortado`);
      assert.deepEqual(await horizontalOverflow(page), [], `${lang}: rolagem lateral`);
      // Botões da tela final continuam à vista.
      for (const sel of ["#newGameAfterEnd", "#seeDetails", "#resultHome"]) assert.ok(await page.locator(sel).isVisible(), `${lang}: ${sel}`);
    }
    await showResult(page, { winner: "player", reason: "territorial", player: 0.4, rival: 0.6 });
    await page.waitForTimeout(700);
    // Mesmo com o cartão de medalhas novas, os botões da tela final cabem na tela sem rolar.
    const vh = page.viewportSize().height;
    for (const sel of ["#newGameAfterEnd", "#seeDetails", "#resultHome"]) {
      const b = await page.locator(sel).boundingBox();
      assert.ok(b && b.y + b.height <= vh + 1, `${lang}: ${sel} fora da tela (${b && b.y + b.height} > ${vh})`);
    }
    await screenshot(page, `resultado-dominio-sem-liderar-${lang}-360x640${wide ? "-dejavu" : ""}`);
    // Os botões ficam presos embaixo; rolando até o fim, nada do conteúdo fica escondido atrás deles.
    const hidden = await page.evaluate(() => { const scr = document.getElementById("resultScreen"); scr.scrollTop = scr.scrollHeight;
      const top = document.querySelector("#resultScreen .res-actions").getBoundingClientRect().top;
      return [...document.querySelectorAll("#resultScreen .res-inner > :not(.res-actions)")].filter((el) => el.getBoundingClientRect().bottom > top + 1).map((el) => el.className); });
    assert.deepEqual(hidden, [], `${lang}: conteúdo escondido atrás dos botões`);
    await page.evaluate(() => { document.getElementById("resultScreen").scrollTop = 0; });
    assert.deepEqual(errors, []);
    await context.close();
  }
});
