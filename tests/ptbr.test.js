// Textos do jogador em português do Brasil e com os nomes aprovados (docs/decisoes.md):
// Ouro (não "u."), Força (não "Poder militar"/"pontos militares"), Obras (não "Infraestrutura"),
// Ciência (não "Tecnologia"). Percorre as telas principais da versão do jogador e procura no texto
// VISÍVEL (innerText) palavras e construções de português de Portugal.
// Os laboratórios (?dev=1) ficam de fora: podem manter os termos técnicos.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, concludeEraUI, MOBILE_SCREENS } = require("./helpers");
const { playTutorial } = require("./tutorial-helpers");

const PIXEL = MOBILE_SCREENS[0][1];

// Construções de pt-PT proibidas no texto do jogador.
const PT_PT = [
  /resolve-se/i, /resolvem-se/i, /resolveram-se/i, /\bregist(o|ad[oa]s?)\b/i, /\bficheiros?\b/i, /\bbónus\b/i, /\becrã/i,
  /Toque num\b/i, /\bnum território/i, /\bnuma\b/i, /Pode sair a qualquer momento/i, /já não (pode|é possível)/i,
  /\baceites?\b/i, /\ba meio\b/i, /\bequipas?\b/i, /\butilizador/i, /\bfacto\b/i, /por baixo d/i, /até à\b/i,
  /está a ganhar/i, /\ba crescer\b/i, /\bdefinições\b/i, /telemóvel/i, /perder-se/i, /vence-se/i,
];
// Nomes antigos que não podem aparecer ao jogador.
const OLD_NAMES = [/\d u\./, /\bu\.$/m, /Poder militar/i, /pontos militares/i, /Infraestrutura/i, /\bTecnologia\b/i, /\bInfra\.(?=\s|$)/];

function check(where, text, problems) {
  for (const re of [...PT_PT, ...OLD_NAMES]) {
    const m = text.match(re);
    if (m) {
      const i = m.index, ctx = text.slice(Math.max(0, i - 30), i + m[0].length + 30).replace(/\s+/g, " ");
      problems.push(`${where}: ${re} → "…${ctx}…"`);
    }
  }
}
const bodyText = (page) => page.evaluate(() => document.body.innerText);

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

test("pt-BR: telas principais do jogador sem palavras de pt-PT nem nomes antigos (u., Poder militar, Infraestrutura, Tecnologia)", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const problems = [];
  // Tela inicial, Como jogar (modal) e configuração da partida.
  await page.waitForTimeout(300);
  check("tela inicial", await bodyText(page), problems);
  await page.locator("#homeHowTo").click();
  check("Como jogar (modal)", await bodyText(page), problems);
  await dismissModals(page);
  await page.locator("#homeStart").click();
  for (const n of ["1", "2", "3"]) {
    await page.locator(`#homeOpponents [data-ai="${n}"]`).click();
    check(`configurar partida (${n} rival${n === "1" ? "" : "es"})`, await bodyText(page), problems);
  }
  await page.locator("#homeConquest").click();
  for (const d of ["muitofacil", "facil", "medio", "dificil", "hardcore"]) {
    await page.locator(`#homeDifficulty [data-diff="${d}"]`).click();
    check(`configurar partida (${d})`, await bodyText(page), problems);
  }
  await page.locator("#homeClassic").click();
  await page.locator('#homeDifficulty [data-diff="medio"]').click();
  await page.locator('#homeOpponents [data-ai="1"]').click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden);

  // Jogo: investimentos, Como jogar e Detalhes abertos; aviso de ouro parado; Reiniciar.
  await page.evaluate(() => { document.getElementById("howTo").open = true; document.getElementById("details").open = true; renderAll(); });
  await page.locator('[data-plan="balanced"]').click();
  check("jogo (era 1, investimentos, Como jogar, Detalhes)", await bodyText(page), problems);
  await page.locator('[data-plan="clear"]').click();
  await page.locator("#advance").click();
  check("aviso de ouro por investir", await bodyText(page), problems);
  await dismissModals(page, { max: 1 });
  await page.locator("#restart").click();
  check("modal Reiniciar", await bodyText(page), problems);
  await page.locator('#modalRoot button:has-text("Cancelar")').click();

  // Painel de ataque (alvo, "Como funciona", alvo fora do alcance, território próprio) e ordem dada.
  await page.locator('[data-plan="attack"]').click();
  await concludeEraUI(page);
  const t = await page.evaluate(() => eligibleTargets(state, "player")[0].i);
  await page.locator(`[data-territory="${t}"]`).click();
  await page.locator("#mapStatus details").evaluate((d) => (d.open = true));
  check("painel de ataque", await bodyText(page), problems);
  await page.locator(`[data-territory="${t}"]`).click();
  await page.locator('[data-territory="20"]').click();
  check("painel de ataque (fora do alcance)", await bodyText(page), problems);
  await page.locator('[data-territory="0"]').click();
  check("painel de ataque (território seu)", await bodyText(page), problems);
  await page.locator(`[data-territory="${t}"]`).click();
  await page.locator("#attack").click();
  check("ordem dada", await bodyText(page), problems);

  // Relatório da era (com ataques: força o resultado para o texto do registo aparecer).
  await page.evaluate(() => { state.ui.skipReport = false; state.ui.skipIdleWarning = true; });
  await page.locator("#advance").click();
  await page.waitForSelector("#modalRoot .report", { timeout: 3000 });
  check("relatório da era", await bodyText(page), problems);
  await dismissModals(page);

  // Registo com todos os tipos de evento do motor (texto guardado em pt-PT, mostrado em pt-BR).
  await page.evaluate(() => {
    const e = state.era;
    for (const text of [
      "✅ Ataque bem-sucedido: território 9 (de IA) — saque: 1 234,5 u. de tesouro, 12,5 u. de infraestrutura, 0,4 de progresso tecnológico.",
      "❌ Ataque malsucedido: território 9; 1234,5 pontos comprometidos.",
      "🛡️ Ataque de IA repelido: território 2; 8 pontos comprometidos.",
      "⚔️ IA conquistou: território 3 (de Jogador).",
      "↩️ Ordem de Você contra o território 4 cancelada (já não é possível atacar); poder devolvido.",
      "↩️ Ordem de IA contra o território 4 cancelada: o alvo mudou de dono e a defesa subiu para 12; poder devolvido.",
      "⚔️ Batalha pelo território 5: IA venceu Você (força 12 × 8); Você perdeu 8 pontos.",
    ]) state.log.unshift({ era: e - 1, text });
    renderAll(); showEraReport(e - 1);
  });
  const shown = await bodyText(page);
  check("registo de eventos e relatório", shown, problems);
  assert.match(shown, /1\.234,5 de ouro/, "números do registo não aparecem no formato 1.234,5 de ouro");
  assert.match(shown, /\(seu\)/);
  await dismissModals(page);

  // Tela de resultado.
  await page.evaluate(() => { while (!state.result) playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
  await page.waitForTimeout(200);
  await dismissModals(page);
  await page.locator("#resultBanner").waitFor({ state: "visible" });
  check("tela de resultado", await bodyText(page), problems);

  assert.deepEqual(errors, []);
  await context.close();
  assert.deepEqual(problems, [], "textos de pt-PT ou nomes antigos visíveis ao jogador");
});

test("pt-BR: tutorial do início ao fim sem palavras de pt-PT nem nomes antigos", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL, offerTutorial: true });
  const problems = [];
  await page.locator("#modalRoot .modal").waitFor({ state: "visible" });
  check("convite do tutorial", await bodyText(page), problems);
  await playTutorial(page, {
    onStep: async (n) => check(`tutorial passo ${n}`, await page.evaluate(() => document.getElementById("tutBox").innerText), problems),
  });
  assert.deepEqual(errors, []);
  await context.close();
  assert.deepEqual(problems, [], "textos de pt-PT ou nomes antigos no tutorial");
});
