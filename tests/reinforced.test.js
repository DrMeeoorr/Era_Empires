// Versões reforçadas de testes internos fracos de defineTests() (index.html).
// Os testes internos continuam a correr em internal.test.js; estes NÃO os substituem ainda.
// Quando index.html puder ser editado, os internos devem ser trocados por estas versões
// (lista em tests/README.md, secção "Testes internos a trocar").
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame, dismissModals, concludeEraUI, MOBILE_SCREENS, menuClick } = require("./helpers");

const PIXEL = MOBILE_SCREENS[0][1];
let browser, ctx;
before(async () => {
  browser = await launch();
  ctx = await openGame(browser);
});
after(async () => browser && browser.close());

/** Corre fn(arg) na página isolando o estado global; falha com a mensagem do erro lançado. */
async function rule(fn, arg) {
  const r = await ctx.page.evaluate(
    ([src, a]) => {
      try {
        const saved = { state, configApplied: clone(configApplied), gameMode, currentDifficulty };
        try { return { ok: true, value: (0, eval)("(" + src + ")")(a) }; }
        finally { state = saved.state; configApplied = saved.configApplied; gameMode = saved.gameMode; currentDifficulty = saved.currentDifficulty; }
      } catch (e) { return { ok: false, msg: e.message || String(e) }; }
    },
    [fn.toString(), arg]
  );
  if (!r.ok) assert.fail(r.msg);
  return r.value;
}

// ── Substitui "Conquista respeita adjacência e aumenta territórios" ──
// O interno só verificava o dono se o sorteio desse vitória, e nunca testava um alvo NÃO adjacente.
test("conquista: alvo não adjacente é recusado sem gastar poder; vitória passa o território e só ele", () =>
  rule(() => {
    const c = clone(DEFAULTS), s = newState(c);
    P(s).military = 1000;
    const mine = s.owners.map((o, i) => (o === "player" ? i : -1)).filter((i) => i >= 0);
    const far = s.owners.findIndex((o, i) => o !== "player" && !adjacentOwned(s, i, "player"));
    if (far < 0) throw Error("mapa padrão sem território não adjacente (teste inválido)");
    const before = { owners: s.owners.slice(), mil: P(s).military, log: s.log.length };
    const no = attackTerritory(s, far, "player", c);
    if (no.ok) throw Error(`ataque ao território não adjacente ${far + 1} foi aceite`);
    if (JSON.stringify(s.owners) !== JSON.stringify(before.owners) || P(s).military !== before.mil) throw Error("ataque recusado alterou o mapa ou o poder");
    if (s.attacks.playerWins + s.attacks.playerLosses !== 0) throw Error("ataque recusado foi contabilizado");
    // Atacar um território próprio também é recusado.
    if (attackTerritory(s, mine[0], "player", c).ok) throw Error("ataque ao próprio território aceite");
    // Todos os alvos elegíveis são vizinhos (na grelha) de algum território do jogador.
    for (const t of eligibleTargets(s, "player"))
      if (!mine.some((m) => neighbors(m, s.owners.length).includes(t.i))) throw Error(`alvo ${t.i + 1} não é vizinho`);
    // Vitória garantida (forcedAttack é o mecanismo do tutorial): o território muda de dono e só esse.
    const t = eligibleTargets(s, "player")[0];
    const prevOwner = s.owners[t.i];
    s.forcedAttack = { owner: "player", win: true };
    const r = attackTerritory(s, t.i, "player", c);
    if (!r.ok || !r.win) throw Error("ataque com vitória forçada não venceu");
    if (s.owners[t.i] !== "player") throw Error("território conquistado não mudou de dono");
    const changed = s.owners.map((o, i) => (o !== before.owners[i] ? i : -1)).filter((i) => i >= 0);
    if (changed.length !== 1 || changed[0] !== t.i) throw Error("mudaram territórios além do alvo: " + changed);
    if (s.owners.filter((o) => o === "player").length !== mine.length + 1) throw Error("contagem de territórios do jogador errada");
    // Gasto de poder: custo de conquista + defesa do alvo × winCost.
    const need = r.spent;
    if (Math.abs(P(s).military - (1000 - need * c.military.winCost)) > 1e-9) throw Error(`poder após vitória ${P(s).military}, esperado ${1000 - need * c.military.winCost}`);
    if (prevOwner !== "neutral") throw Error("primeiro alvo elegível no mapa padrão devia ser neutro");
    // Agora o território recém-conquistado abre novos vizinhos que antes não eram elegíveis.
    const newly = neighbors(t.i, s.owners.length).filter((i) => s.owners[i] !== "player" && !before.owners.some((_, j) => before.owners[j] === "player" && neighbors(j, s.owners.length).includes(i)));
    for (const i of newly) if (!eligibleTargets(s, "player").some((x) => x.i === i)) throw Error(`vizinho novo ${i + 1} não ficou elegível`);
  }));

// ── Substitui "Ataque bem-sucedido ou falho gera métricas de expansão" ──
// O interno só verificava a vitória se o sorteio a desse; a derrota nunca era verificada.
test("ataque: vitória e derrota contabilizadas nos contadores certos, com o poder gasto certo", () =>
  rule(() => {
    const c = clone(DEFAULTS);
    for (const win of [true, false]) {
      const s = newState(c);
      P(s).military = 1000;
      const t = eligibleTargets(s, "player")[0], owner0 = s.owners[t.i];
      s.forcedAttack = { owner: "player", win };
      const r = attackTerritory(s, t.i, "player", c);
      if (!r.ok || r.win !== win) throw Error(`ataque forçado (${win}) deu ${JSON.stringify(r)}`);
      const a = s.attacks, ca = P(s).attacks;
      const exp = win
        ? { playerWins: 1, playerLosses: 0, neutralConquests: 1, enemyConquests: 0, aiWins: 0, aiLosses: 0 }
        : { playerWins: 0, playerLosses: 1, neutralConquests: 0, enemyConquests: 0, aiWins: 0, aiLosses: 0 };
      for (const k in exp) if (a[k] !== exp[k]) throw Error(`${win ? "vitória" : "derrota"}: attacks.${k}=${a[k]}, esperado ${exp[k]}`);
      if (ca.wins !== (win ? 1 : 0) || ca.losses !== (win ? 0 : 1)) throw Error("contadores da civilização errados: " + JSON.stringify(ca));
      if (s.owners[t.i] !== (win ? "player" : owner0)) throw Error("dono do território errado após " + (win ? "vitória" : "derrota"));
      const cost = r.spent * (win ? c.military.winCost : c.military.lossCost);
      if (Math.abs(P(s).military - (1000 - cost)) > 1e-9) throw Error(`poder após ${win ? "vitória" : "derrota"}: ${P(s).military}, esperado ${1000 - cost}`);
      if (!s.log.some((l) => (win ? /Ataque bem-sucedido/ : /Ataque malsucedido/).test(l.text))) throw Error("registo de eventos sem o ataque");
    }
    // Sem forçar: o sorteio natural (82% de vitória) tem de produzir as duas saídas em sementes diferentes,
    // e com os contadores somando o número de ataques.
    let wins = 0, losses = 0;
    for (let seed = 0; seed < 60; seed++) {
      const s = newState(c); s.rngSeed = seed; P(s).military = 1000;
      const r = attackTerritory(s, eligibleTargets(s, "player")[0].i, "player", c);
      if (s.attacks.playerWins + s.attacks.playerLosses !== 1) throw Error("ataque não contabilizado (semente " + seed + ")");
      r.win ? wins++ : losses++;
    }
    if (!wins || !losses) throw Error(`sorteio natural deu só um resultado: ${wins} vitórias, ${losses} derrotas`);
  }));

// ── Substitui "Desempenho: uma partida de 30 eras com 4 civilizações em menos de 200 ms" ──
// O interno mede a média de 5 partidas sem aquecimento contra 200 ms: oscila com a carga da máquina.
// Aqui: aquecimento + mediana de 7 partidas, com limite configurável (PERF_BUDGET_MS, padrão 200 ms
// localmente e 600 ms em CI, onde as máquinas são mais lentas e partilhadas).
test("desempenho: mediana de 7 partidas de 30 eras com 4 civilizações abaixo do limite", async () => {
  const budget = Number(process.env.PERF_BUDGET_MS) || (process.env.CI ? 600 : 200);
  const ms = await rule(() => {
    const go = (g) => runGame(clone(DEFAULTS), { kind: "fixed", eras: 30, profiles: LAB_PROFILES.map((x) => x[0]), civCount: 4, seed: g });
    go(99); go(98); // aquecimento (compilação JIT)
    const t = [];
    for (let g = 0; g < 7; g++) { const t0 = performance.now(); go(g); t.push(performance.now() - t0); }
    return t.sort((a, b) => a - b)[3];
  });
  assert.ok(ms < budget, `mediana de ${ms.toFixed(1)} ms por partida (limite ${budget} ms)`);
});

// ── Reforça "Predefinições de dificuldade aplicam os valores certos" ──
// O interno não confere aiIncomeMultiplier1v1 nem o efeito real na receita das IAs.
test("dificuldades: os 4 valores (incluindo aiIncomeMultiplier1v1) e a receita real das IAs em 1×1 e com 3 rivais", () =>
  rule(() => {
    const exp = {
      muitofacil: [0.7, -1, 75, "neutralFirst"], facil: [0.92, -1, 75, "neutralFirst"], medio: [1.03, 1, 75, "neutralFirst"],
      dificil: [1.03, -1, 100, "leader"], hardcore: [1.12, -1, 100, "leader"],
    };
    const base = DEFAULTS.economy.baseIncome;
    for (const [k, v] of Object.entries(exp)) {
      // Começa de outra dificuldade para apanhar valores que "sobram" da anterior.
      for (const prev of ["medio", "dificil"]) {
        configApplied = clone(DEFAULTS); applyDifficulty(prev); applyDifficulty(k);
        const got = [configApplied.economy.aiIncomeMultiplier, configApplied.economy.aiIncomeMultiplier1v1, configApplied.military.aiAggression, configApplied.military.aiTarget];
        if (JSON.stringify(got) !== JSON.stringify(v)) throw Error(`${prev}→${k}: ${JSON.stringify(got)} ≠ ${JSON.stringify(v)}`);
        normalizeConfig(configApplied);
      }
      // Receita da 1.ª era de cada IA (1 território inicial cada, sem investimentos).
      for (const ai of [1, 3]) {
        const c = clone(configApplied); c.map.aiCount = ai;
        const s = newState(c); beginEra(s, c);
        const mult = ai === 1 && v[1] >= 0 ? v[1] : v[0];
        const pl = s.pending.revenue.player.total;
        if (Math.abs(pl - base) > 1e-9) throw Error(`${k} ${ai} IA: receita do jogador ${pl} ≠ ${base}`);
        for (const civ of s.civs.slice(1)) {
          const got = s.pending.revenue[civ.id].total;
          if (Math.abs(got - base * mult) > 1e-9) throw Error(`${k} com ${ai} IA: receita de ${civ.id} ${got}, esperado ${base * mult}`);
        }
      }
    }
  }));

test("dificuldade Médio pela interface: em 1×1 o rival recebe o mesmo que o jogador; com 3 rivais, +3%", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  const out = {};
  for (const ai of [1, 3]) {
    if (await page.locator("#homeScreen").isHidden()) await menuClick(page, "#returnHome");
    await page.locator("#homeStart").click();
    await page.locator('#homeDifficulty [data-diff="medio"]').click();
    await page.locator(`#homeOpponents [data-ai="${ai}"]`).click();
    await page.locator("#setupStart").click();
    const confirm = page.locator('#modalRoot button:has-text("Nova partida")');
    if (await confirm.count()) await confirm.click();
    await page.waitForFunction((n) => document.getElementById("homeScreen").hidden && state.era === 1 && state.civs.length === n + 1, ai);
    out[ai] = await page.evaluate(() => ({
      v1: configApplied.economy.aiIncomeMultiplier1v1,
      player: state.pending.revenue.player.total,
      ais: state.civs.slice(1).map((c) => state.pending.revenue[c.id].total),
    }));
  }
  await context.close();
  assert.equal(out[1].v1, 1);
  assert.deepEqual(out[1].ais, [out[1].player], "1×1 Médio: rival devia receber o mesmo que o jogador");
  for (const r of out[3].ais) assert.ok(Math.abs(r - out[3].player * 1.03) < 1e-9, `3 rivais Médio: ${r} ≠ ${out[3].player} × 1,03`);
  assert.deepEqual(errors, []);
});

// ── Substitui "Reinício restaura estado" ──
// O interno só criava um newState novo e verificava o próprio newState (tautológico). Aqui usa o botão.
const snap = (page) =>
  page.evaluate(() => ({
    era: state.era, result: state.result || null, history: state.history.length, investments: state.investments.length,
    treasury: P(state).treasury, military: P(state).military, invested: P(state).invested,
    civs: state.civs.length, owners: state.owners.map((o) => (o === "neutral" ? "n" : o === "player" ? "p" : "a")).join(""),
    attacks: state.attacks, maxEras: state.maxEras, difficulty: state.difficulty, mode: state.mode,
    aiCount: configApplied.map.aiCount, diffNow: currentDifficulty,
  }));

test("botão Reiniciar: 'Cancelar' mantém a partida; 'Reiniciar' volta à era 1 com as mesmas definições, também após recarregar", async () => {
  const { context, page, errors } = await openGame(browser, { contextOptions: PIXEL });
  await page.locator("#homeStart").click();
  await page.locator('#homeOpponents [data-ai="3"]').click();
  await page.locator('#homeEraPresets [data-eras="15"]').click();
  await page.locator('#homeDifficulty [data-diff="dificil"]').click();
  await page.locator("#setupStart").click();
  await page.waitForFunction(() => document.getElementById("homeScreen").hidden && state.era === 1 && !!state.pending);
  const fresh = await snap(page);
  for (let i = 0; i < 3; i++) { await page.locator('[data-plan="balanced"]').click(); await concludeEraUI(page); }
  const played = await snap(page);
  assert.equal(played.era, 4);
  assert.ok(played.investments > 0 && played.history === 3);

  // Cancelar no diálogo: nada muda.
  await menuClick(page, "#restart");
  await page.locator('#modalRoot button:has-text("Cancelar")').click();
  assert.deepEqual(await snap(page), played, "Cancelar no diálogo de Reiniciar alterou a partida");

  // Reiniciar de verdade.
  await menuClick(page, "#restart");
  await page.locator('#modalRoot button.danger:has-text("Reiniciar")').click();
  await page.waitForFunction(() => state.era === 1);
  await dismissModals(page);
  const restarted = await snap(page);
  assert.deepEqual(restarted, fresh, "Reiniciar não voltou ao estado de uma partida nova com as mesmas definições");
  assert.equal(await page.locator("#resultBanner").isVisible(), false);

  // Depois de recarregar continua a partida reiniciada (o save foi substituído).
  await page.reload();
  await page.waitForFunction(() => typeof state !== "undefined" && !!state);
  const reloaded = await snap(page);
  assert.equal(reloaded.era, 1);
  assert.equal(reloaded.history, 0);
  assert.equal(reloaded.investments, 0);
  assert.equal(reloaded.civs, 4);
  assert.equal(reloaded.maxEras, 15);
  assert.equal(reloaded.difficulty, "dificil");
  assert.deepEqual(errors, []);
  await context.close();
});

// ── Substitui "Cancelamento preserva eras concluídas (primitiva)" ──
// O interno só corria processEra uma vez e verificava history.length === 1 (não cancelava nada).
// Aqui usa o "Avanço rápido de eras" dos laboratórios (?dev=1) e o botão Cancelar a meio.
//
// Ritmo controlado pelo relógio da página (page.clock): runLong processa um bloco e espera um
// setTimeout(0) antes do seguinte. Com o relógio em pausa, só avança quando o teste deixa passar
// tempo (page.clock.runFor), um bloco (= 1 era) de cada vez, por isso o clique em Cancelar acontece sempre com o avanço a meio.
// Antes o teste dependia do tempo real: as 1000 eras pedidas acabam em ~150 ms (a IA vence por
// maioria territorial na era 22, independentemente de maxEras), e no CI o avanço terminava e
// abria o modal de resultado antes do clique em Cancelar (run 44568991059).
test("avanço rápido: Cancelar a meio para, preserva as eras concluídas e a partida continua jogável", async () => {
  const { context, page, errors } = await openGame(browser, { dev: true });
  // Bloco de 1 era: cada tique do relógio processa uma era. maxEras alto para o limite de eras não contar.
  await page.locator("#homeLab").click();
  await page.locator('[data-param="simulation.blockSize"]').fill("1");
  await page.locator('[data-param="endgame.maxEras"]').fill("150");
  await page.locator("#applyConfig").click();
  await page.locator("#restartWithConfig").click();
  const confirm = page.locator('#modalRoot .modal button.primary, #modalRoot .modal button.danger, #modalRoot .modal button.good');
  if (await confirm.count()) await confirm.first().click();
  await page.waitForFunction(() => state.era === 1 && state.history.length === 0 && configApplied.simulation.blockSize === 1);
  const e0 = await page.evaluate(() => ({ era: state.era, h: state.history.length }));

  // Relógio da página em pausa (não usar waitForFunction a partir daqui: o polling por rAF também pára).
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 60_000);
  const look = () => page.evaluate(() => ({
    h: state.history.length, status: document.getElementById("advanceStatus").textContent,
    cancelDisabled: document.getElementById("cancelAdvance").disabled, result: !!state.result,
  }));

  await page.locator("#customEras").fill("1000");
  await page.locator("#customAdvance").click();
  // O primeiro bloco corre logo no clique; depois o avanço espera pelo relógio.
  let now = await look();
  assert.equal(now.h, e0.h + 1, "o primeiro bloco do avanço não correu no clique");
  assert.match(now.status, /^Processadas 1 de 1\.000 eras/);
  assert.equal(now.cancelDisabled, false, "Cancelar não ficou ativo durante o avanço");
  // Deixa passar o relógio aos poucos até haver pelo menos 4 eras concluídas, sempre com o avanço a correr.
  for (let tick = 0; now.h < e0.h + 4; tick++) {
    if (tick > 20) assert.fail("o avanço não progride com o relógio da página");
    const prev = now.h;
    await page.clock.runFor(1);
    now = await look();
    assert.ok(now.h - prev <= 2, `um tique de 1 ms processou ${now.h - prev} eras`);
    assert.equal(now.result, false, "a partida terminou durante o avanço (teste inválido)");
    assert.equal(now.cancelDisabled, false, "Cancelar ficou inativo com o avanço a meio");
  }
  const beforeCancel = now.h - e0.h;
  // Cancelar a meio (clique real no botão, que tem de estar visível, ativo e sem nada por cima).
  await page.locator("#cancelAdvance").click({ timeout: 5000 });
  now = await look();
  assert.equal(now.status, "Cancelamento solicitado; concluindo o bloco atual...");
  await page.clock.runFor(1);
  const r = await page.evaluate(() => ({
    status: document.getElementById("advanceStatus").textContent, era: state.era, h: state.history.length,
    eras: state.history.map((x) => x.era), result: !!state.result, advanceDisabled: document.getElementById("advance").disabled,
    cancelDisabled: document.getElementById("cancelAdvance").disabled, modal: document.getElementById("modalRoot").innerHTML.trim() !== "",
  }));
  assert.equal(r.cancelDisabled, true, "o avanço não terminou depois de cancelar");
  const m = /Cancelado após (\d+) eras/.exec(r.status);
  assert.ok(m, "estado do avanço não diz que foi cancelado: " + r.status);
  const done = Number(m[1]);
  assert.equal(done, beforeCancel, `cancelado após ${done} eras (esperado: as ${beforeCancel} concluídas antes do clique)`);
  assert.equal(r.result, false);
  assert.equal(r.modal, false, "abriu um modal ao cancelar o avanço");
  assert.equal(r.h, e0.h + done, "histórico não tem todas as eras concluídas antes do cancelamento");
  assert.equal(r.era, e0.era + done);
  assert.deepEqual(r.eras, r.eras.map((_, i) => r.eras[0] + i), "eras no histórico não são consecutivas");
  assert.equal(r.advanceDisabled, false, "'Concluir a era' ficou desativado após cancelar");
  // Parou mesmo: mesmo com muito tempo a passar no relógio da página, não avança mais.
  await page.clock.runFor(5000);
  assert.equal(await page.evaluate(() => state.history.length), r.h, "o avanço continuou depois de cancelar");
  // E a partida continua jogável a partir dali.
  await page.evaluate(() => { playEra({ military: 0, infrastructure: 0, technology: 0 }); renderAll(); });
  assert.equal(await page.evaluate(() => state.history.length), r.h + 1);
  assert.deepEqual(errors, []);
  await context.close();
});
