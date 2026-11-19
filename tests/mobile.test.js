// Telas de celular: sem erros de consola, sem rolagem horizontal, botões principais visíveis e clicáveis.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, concludeEraUI, horizontalOverflow, assertClickable, screenshot, MOBILE_SCREENS } = require("./helpers");

// Altura mínima aceite para os botões principais (as diretrizes Android recomendam 48 dp;
// abaixo de 36 px o toque fica difícil). Botões abaixo de 40 px são listados como aviso.
const MIN_TAP = 36, WARN_TAP = 40;

let browser;
before(async () => (browser = await launch()));
after(async () => browser && browser.close());

async function checkButtons(page, list, where, smalls) {
  for (const [sel, label, primary] of list) {
    const box = await assertClickable(page, sel, `${where} › ${label}`);
    if (primary) assert.ok(box.height >= MIN_TAP, `${where} › ${label}: altura ${Math.round(box.height)} px < ${MIN_TAP} px`);
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
      ["#homeStart", "Nova partida", true], ["#homeTutorial", "Tutorial", true], ["#homeHowTo", "Como jogar", true],
      ["#homeCompare", "Balanceamento", true], ["#homeLab", "Configurações", true],
    ], "inicial", smalls);
    await screenshot(page, `${name}-1-inicial`);
    // "Como jogar" abre e fecha.
    await page.locator("#homeHowTo").click();
    await assertClickable(page, "#modalRoot .modal button.primary", "Como jogar › Entendi");
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal no modal Como jogar");
    await dismissModals(page);
    // Configuração da partida.
    await page.locator("#homeStart").click();
    await page.locator("#setupScreen").waitFor({ state: "visible" });
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal na configuração");
    await checkButtons(page, [
      ["#setupBack", "Voltar", false], ["#modeSlow", "Modo lento", true], ["#modeFast", "Modo rápido", true],
      ['#homeDifficulty [data-diff="medio"]', "Dificuldade Médio", true], ['#homeDifficulty [data-diff="hardcore"]', "Dificuldade Hardcore", true],
      ['#homeOpponents [data-ai="3"]', "3 adversários", true], ['#homeEraPresets [data-eras="15"]', "15 eras", true],
      ["#homeConquest", "Conquista", true], ["#setupStart", "Começar", true],
    ], "configuração", smalls);
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
    await checkButtons(page, [
      ["#returnHome", "Início", true], ["#restart", "Reiniciar", true],
      [`[data-territory="${target}"]`, "território vizinho", true],
      ['[data-plan="balanced"]', "plano Equilibrado", true], ['[data-plan="attack"]', "plano Ataque", true], ['[data-plan="clear"]', "Limpar", true],
      ['[data-area="mil"] [data-step="1"]', "+ militar", true], ['[data-area="infra"] [data-step="1"]', "+ infraestrutura", true], ['[data-area="tech"] [data-step="1"]', "+ tecnologia", true],
      ["#advance", "Concluir a era", true],
    ], "jogo", smalls);
    // Investir com os botões +/- e concluir duas eras (com relatório e aviso de saldo).
    await page.locator('[data-area="mil"] [data-step="1"]').click();
    const alloc = await page.evaluate(() => readAlloc());
    assert.ok(alloc[0] > 0, "o botão + militar não alterou o investimento");
    await concludeEraUI(page); // deixa saldo por investir → aviso "Concluir mesmo assim"
    await page.locator('[data-plan="attack"]').click();
    await concludeEraUI(page);
    assert.equal(await page.evaluate(() => state.era), 3);
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal depois de jogar eras");
    // Detalhes da partida (gráficos e histórico) também cabem na largura.
    await page.locator("#details summary").click();
    await page.waitForTimeout(200);
    assert.deepEqual(await horizontalOverflow(page), [], "rolagem horizontal com os detalhes abertos");
    await screenshot(page, `${name}-4-detalhes`);
    if (smalls.length) console.log(`  [${name}] alvos de toque < ${WARN_TAP} px: ${smalls.join("; ")}`);
    assert.deepEqual(errors, [], "erros de consola");
    await context.close();
  });
}
