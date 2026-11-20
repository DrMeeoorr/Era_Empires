// Telas de celular: sem erros de consola, sem rolagem horizontal, botões principais visíveis e clicáveis.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, concludeEraUI, horizontalOverflow, assertClickable, screenshot, MOBILE_SCREENS, menuClick, choosePlan, openCustomize } = require("./helpers");

// Alvos de toque: as diretrizes Android pedem 48 dp. Os botões marcados como principais têm de ter
// pelo menos 48 px de altura e de largura; os restantes abaixo disso são listados como aviso.
const MIN_TAP = 48, WARN_TAP = 48;

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

async function checkButtons(page, list, where, smalls) {
  for (const [sel, label, primary, minWidth = MIN_TAP] of list) {
    const box = await assertClickable(page, sel, `${where} › ${label}`);
    if (primary) assert.ok(box.height >= MIN_TAP - 0.5, `${where} › ${label}: altura ${Math.round(box.height)} px < ${MIN_TAP} px`);
    if (primary) assert.ok(box.width >= minWidth - 0.5, `${where} › ${label}: largura ${Math.round(box.width)} px < ${minWidth} px`);
    if (box.height < WARN_TAP || box.width < WARN_TAP) smalls.push(`${where} › ${label} ${Math.round(box.width)}×${Math.round(box.height)}`);
  }
}

for (const [name, opts] of MOBILE_SCREENS) {
  test(`celular ${name}: telas inicial, configuração, jogo e fim de era`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: opts });
    const smalls = [];
    // Tela inicial.
    await page.waitForTimeout(500); // animação de entrada
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal na tela inicial");
    await checkButtons(page, [
      ["#homeStart", "Jogar", true], ["#homeTutorial", "Tutorial", true], ["#homeHowTo", "Como jogar", true],
    ], "inicial", smalls);
    // Versão do jogador (publicada): os atalhos dos laboratórios não aparecem.
    for (const sel of ["#homeCompare", "#homeLab"]) assert.equal(await page.locator(sel).isVisible(), false, `${sel} visível na versão do jogador`);
    await screenshot(page, `${name}-1-inicial`);
    // "Como jogar" (tela própria) abre, mostra as regras completas e fecha com "Entendi".
    await page.locator("#homeHowTo").click();
    await page.locator("#howToScreen").waitFor({ state: "visible" });
    await checkButtons(page, [["#howToBack", "Voltar", true], ["#howToFull > summary", "Regras completas", true], ["#howToOk", "Entendi", true]], "Como jogar", smalls);
    await page.locator("#howToFull > summary").click();
    assert.match(await page.locator("#howToFullBody").innerText(), /Como vencer/);
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal em Como jogar");
    await page.locator("#howToOk").click();
    await page.locator("#howToScreen").waitFor({ state: "hidden" });
    // Configuração da partida.
    await page.locator("#homeStart").click();
    await page.locator("#setupScreen").waitFor({ state: "visible" });
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal na configuração");
    await checkButtons(page, [
      ["#setupBack", "Voltar", true],
      ['#homeDifficulty [data-diff="muitofacil"]', "Dificuldade Muito fácil", true], ['#homeDifficulty [data-diff="medio"]', "Dificuldade Médio", true], ['#homeDifficulty [data-diff="hardcore"]', "Dificuldade Lendário", true],
      ['#homeOpponents [data-ai="1"]', "1 rival", true], ['#homeOpponents [data-ai="3"]', "3 rivais", true], ["#setupCustomize > summary", "Personalizar", true], ["#setupStart", "Jogar", true],
    ], "configuração", smalls);
    await openCustomize(page);
    await checkButtons(page, [
      ['#homeEraPresets [data-eras="15"]', "15 eras", true], ["#homeEraPresets .pg-other", "Outra duração (toque no campo)", true], ["#modeSlow", "Ritmo Normal", true], ["#modeFast", "Ritmo Rápido", true],
      ["#homeClassic", "Clássica", true], ["#homeConquest", "Conquista", true], ["#homeProfiles select", "estilo do rival", true], ["label.pg-switch", "Posição inicial aleatória (linha inteira)", true], ["#homeRandomStart", "interruptor (a linha inteira é o alvo)", false],
    ], "Personalizar", smalls);
    // 3 adversários: a configuração tem de continuar sem rolagem horizontal.
    await page.locator('#homeOpponents [data-ai="3"]').click();
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal com 3 adversários");
    await screenshot(page, `${name}-2-configuracao`);
    await page.locator("#setupStart").click();
    await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
    // Jogo.
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal na tela do jogo");
    // O botão "Concluir a era" fica sempre ao alcance (barra fixa em baixo), sem precisar rolar.
    const adv = await page.locator("#advance").boundingBox();
    const vp = page.viewportSize();
    assert.ok(adv && adv.y >= 0 && adv.y + adv.height <= vp.height + 1, `"Concluir a era" fora da tela no topo da página: y=${adv && adv.y}`);
    await screenshot(page, `${name}-3-jogo`);
    const target = await page.evaluate(() => eligibleTargets(state, "player")[0].i);
    const short = vp.height <= 700;
    // UX Fase 2: Início/Reiniciar ficam no menu ☰; Como jogar no "?"; Resto/Zerar na folha "Ajuste fino";
    // em telas baixas (≤ 700 px) os planos ficam na folha "Planos ▾". Todos continuam com ≥ 48 px.
    await checkButtons(page, [
      ["#menuBtn", "Menu ☰", true], ["#helpBtn", "Como jogar (?)", true], ["#scorePill", "Placar", true], ["#statTerr", "Terras", true],
      // O mapa tem 6 colunas: no Galaxy S9+ (320 px de largura) cada território fica com ~42 px de largura.
      [`[data-territory="${target}"]`, "território vizinho", true, 40],
      ['[data-area="mil"] [data-step="1"]', "+ militar", true], ['[data-area="infra"] [data-step="1"]', "+ obras", true], ['[data-area="tech"] [data-step="1"]', "+ ciência", true],
      ['[data-area="mil"] [data-step="-1"]', "− militar", true], ["#fineBtn", "Ajuste fino", true],
      ["#advance", "Concluir a era", true],
    ], "jogo", smalls);
    assert.equal(await page.locator("#plansBtn").isVisible(), short, `botão "Planos ▾" ${short ? "escondido" : "visível"} com ${vp.height} px de altura`);
    if (short) {
      await page.locator("#plansBtn").click();
      await checkButtons(page, [['[data-plan="balanced"]', "plano Equilibrado", true], ['[data-plan="attack"]', "plano Ataque", true], ['[data-plan="clear"]', "Limpar", true]], "folha Planos", smalls);
      await page.keyboard.press("Escape");
    } else {
      await checkButtons(page, [['[data-plan="balanced"]', "plano Equilibrado", true], ['[data-plan="attack"]', "plano Ataque", true], ['[data-plan="clear"]', "Limpar", true]], "jogo", smalls);
    }
    await page.locator("#fineBtn").click();
    await checkButtons(page, [['[data-area="mil"] [data-zero]', "Zerar militar", true], ['[data-area="mil"] [data-rest]', "Resto militar", true], ['[data-area="tech"] [data-rest]', "Resto ciência", true], ["#fineSheet [data-close]", "Fechar folha", true]], "folha Ajuste fino", smalls);
    await page.keyboard.press("Escape");
    await page.locator("#menuBtn").click();
    await checkButtons(page, [
      ["#returnHome", "Início", true], ["#restart", "Reiniciar", true],
      ['#menuSheet [data-open="howToScreen"]', "Como jogar", true], ['#menuSheet [data-open="details"]', "Detalhes da partida", true], ['#menuSheet [data-open="scoreSheet"]', "Placar e vitória", true],
    ], "menu", smalls);
    // "Reiniciar" fica discreto (não vermelho) e pede confirmação antes de apagar a partida.
    assert.equal(await page.locator("#restart").evaluate((e) => e.classList.contains("danger")), false, "Reiniciar em vermelho no menu");
    await page.locator("#restart").click();
    await checkButtons(page, [['#modalRoot button:has-text("Cancelar")', "Cancelar", true], ['#modalRoot button.danger:has-text("Reiniciar")', "Reiniciar (confirmação)", true]], "janela Reiniciar", smalls);
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal na janela Reiniciar");
    await page.locator('#modalRoot button:has-text("Cancelar")').click();
    assert.equal(await page.evaluate(() => state.era), 1);
    // Investir com os botões +/- e concluir duas eras (com relatório e aviso de saldo).
    await page.locator('[data-area="mil"] [data-step="1"]').click();
    const alloc = await page.evaluate(() => readAlloc());
    assert.ok(alloc[0] > 0, "o botão + militar não alterou o investimento");
    await concludeEraUI(page); // deixa saldo por investir → aviso "Concluir mesmo assim"
    await choosePlan(page, "attack");
    await concludeEraUI(page);
    assert.equal(await page.evaluate(() => state.era), 3);
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal depois de jogar eras");
    // Detalhes da partida (gráficos e histórico) também cabem na largura.
    await menuClick(page, '#menuSheet [data-open="details"]');
    await page.locator("#details").waitFor({ state: "visible" });
    await page.waitForTimeout(200);
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal com os detalhes abertos");
    await screenshot(page, `${name}-4-detalhes`);
    if (smalls.length) console.log(`  [${name}] alvos de toque < ${WARN_TAP} px: ${smalls.join("; ")}`);
    assert.deepEqual(errors, [], "erros de consola");
    await context.close();
  });
}

// UX Fase 2: ao tocar num território abre-se a folha de ataque (por cima da barra de baixo). O botão fica
// inteiro na tela e não tapado; quando desabilitado, diz o motivo dentro dele e oferece "Investir em Militar".
for (const [name, opts] of MOBILE_SCREENS) {
  test(`celular ${name}: folha de ataque com o botão visível e o motivo quando desabilitado`, async () => {
    const { context, page, errors } = await openGame(browser, { contextOptions: { ...opts, reducedMotion: "reduce" } });
    await page.locator("#homeStart").click();
    await page.locator("#setupStart").click();
    await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1);
    const t = await page.evaluate(() => eligibleTargets(state, "player")[0].i);
    await page.locator(`[data-territory="${t}"]`).click({ noWaitAfter: true });
    await page.locator("#attackSheet").waitFor({ state: "visible" });
    const geo = await page.evaluate(() => {
      const btn = document.getElementById("attack"), b = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { top: b.top, bottom: b.bottom, h: innerHeight, height: b.height, onTop: hit === btn || btn.contains(hit), text: btn.textContent, disabled: btn.disabled };
    });
    assert.ok(geo.top >= 0 && geo.bottom <= geo.h + 1 && geo.onTop && geo.height >= 48, `botão escondido ou tapado: ${JSON.stringify(geo)}`);
    assert.equal(geo.disabled, true);
    assert.match(geo.text, /^Faltam [\d.,]+ de Força$/);
    assert.ok(await page.locator("#attackInvest").isVisible(), 'atalho "Investir em Militar" não aparece');
    const status = (await page.locator("#mapStatus").innerText()).replace(/\s+/g, " ");
    assert.match(status, /Custo/); assert.match(status, /Sua força/); assert.match(status, /Chance 82%/);
    await screenshot(page, `${name}-5-alvo`);
    assert.deepEqual(errors, []);
    await context.close();
  });
}
