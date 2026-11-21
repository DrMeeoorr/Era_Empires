// Testes de regras adicionais (lacunas dos testes internos), chamando as funções do jogo na página.
// Cada caso corre dentro da página e lança um erro se a regra não for cumprida.
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch, openGame } = require("./helpers");

// ctx: regras (algumas usam o motor dos laboratórios, runGame, que só existe na versão de desenvolvimento);
// uiCtx: a interface do jogador (index.html), que é a publicada.
let browser, ctx, uiCtx;
before(async () => {
  browser = await launch();
  ctx = await openGame(browser, { dev: true });
  uiCtx = await openGame(browser);
});
after(async () => browser && browser.close());

/** Corre fn(arg) na página (fn pode ser assíncrona); devolve o valor ou falha com a mensagem do erro lançado. */
async function rule(fn, arg) {
  const r = await ctx.page.evaluate(
    async ([src, a]) => {
      try {
        // Cada caso parte da configuração padrão; restaura o estado global no fim.
        const saved = { state, configApplied, gameMode, currentDifficulty };
        try { return { ok: true, value: await (0, eval)("(" + src + ")")(a) }; }
        finally { state = saved.state; configApplied = saved.configApplied; gameMode = saved.gameMode; currentDifficulty = saved.currentDifficulty; }
      } catch (e) { return { ok: false, msg: e.message || String(e) }; }
    },
    [fn.toString(), arg]
  );
  if (!r.ok) assert.fail(r.msg);
  return r.value;
}

// ── Mapa ──
test("mapa: vizinhança é simétrica, sem 'dar a volta' entre linhas, para todos os tamanhos de mapa", () =>
  rule(() => {
    for (let n = 4; n <= 30; n++)
      for (let i = 0; i < n; i++) {
        const nb = neighbors(i, n);
        if (new Set(nb).size !== nb.length) throw Error(`n=${n} i=${i}: vizinhos repetidos`);
        for (const j of nb) {
          if (j < 0 || j >= n) throw Error(`n=${n} i=${i}: vizinho ${j} fora do mapa`);
          if (gridDist(i, j) !== 1) throw Error(`n=${n}: ${i} e ${j} não são contíguos na grelha (atravessa a linha)`);
          if (!neighbors(j, n).includes(i)) throw Error(`n=${n}: ${i}→${j} sem ${j}→${i}`);
        }
      }
  }));

test("mapa: posições iniciais distintas e dentro do mapa para 1 a 5 IAs e vários tamanhos", () =>
  rule(() => {
    for (let n = 6; n <= 30; n++)
      for (let ai = 1; ai <= MAX_AI && ai + 1 <= n; ai++) {
        const pos = startPositions(n, ai + 1);
        if (new Set(pos).size !== pos.length || pos.some((p) => p < 0 || p >= n)) throw Error(`n=${n} ai=${ai}: ${pos}`);
        // Ninguém começa colado a outra civilização quando há espaço (n ≥ 12).
        if (n >= 12 && ai <= 3) for (const a of pos) for (const b of pos) if (a !== b && gridDist(a, b) < 2) throw Error(`n=${n} ai=${ai}: ${a} e ${b} vizinhos no início`);
      }
  }));

// ── Economia ──
test("economia: atrasos efetivos no modo rápido (militar/infra −1, tecnologia −2 com mínimo 1)", () =>
  rule(() => {
    const cases = [["military", 1, "slow", 1], ["military", 1, "fast", 0], ["infrastructure", 2, "fast", 1], ["technology", 3, "slow", 3], ["technology", 3, "fast", 1], ["technology", 2, "fast", 1], ["technology", 5, "fast", 3]];
    for (const [t, d, m, exp] of cases) if (effectiveDelay(t, d, m) !== exp) throw Error(`${t} atraso ${d} ${m}: ${effectiveDelay(t, d, m)} ≠ ${exp}`);
  }));

test("economia: investir valor negativo ou zero não cria investimento nem mexe no saldo; o saldo nunca fica negativo", () =>
  rule(() => {
    const c = clone(DEFAULTS), s = newState(c), t0 = P(s).treasury;
    if (invest(s, "military", -50, c) !== null || invest(s, "technology", 0, c) !== null) throw Error("investimento inválido criado");
    if (P(s).treasury !== t0 || s.investments.length) throw Error("saldo/investimentos alterados");
    invest(s, "infrastructure", t0, c);
    if (P(s).treasury !== 0 || P(s).invested.infrastructure !== t0) throw Error("investir o saldo todo falhou");
    let failed = false; try { invest(s, "military", 0.01, c); } catch (e) { failed = true; }
    if (!failed) throw Error("investimento sem saldo aceite");
  }));

test("economia: todas as estratégias automáticas investem exatamente o orçamento e somam 100%", () =>
  rule(() => {
    for (const st of ["military", "aggressive", "infrastructure", "technology", "techFirst", "growth", "balanced"]) {
      const w = strategyWeights(st);
      if (w.reduce((a, b) => a + b, 0) !== 100) throw Error(`${st}: pesos somam ${w}`);
      const c = clone(DEFAULTS), s = newState(c);
      P(s).treasury = 123.4567;
      const a = allocateStrategy(s, c, st);
      const sum = a.military + a.infrastructure + a.technology;
      if (Math.abs(sum - 123.4567) > 1e-9 || P(s).treasury > 1e-9) throw Error(`${st}: investiu ${sum}, sobrou ${P(s).treasury}`);
      if (Math.abs(Math.round(a.military * 100) - a.military * 100) > 1e-6) throw Error(`${st}: militar sem a precisão configurada (${a.military})`);
    }
  }));

test("economia: conservação do tesouro em partidas longas (saldo = anterior + receita − investido + saque)", () =>
  rule(() => {
    const LP = LAB_PROFILES.map((x) => x[0]);
    let checked = 0;
    for (const mode of ["slow", "fast"])
      for (const seed of [3, 17, 29]) {
        const c = clone(DEFAULTS); c.simulation.seed = seed; c.map.aiCount = 3;
        const s = newState(c, { mode, profiles: LP.slice(seed % 3, seed % 3 + 4), allAI: true, endRules: true });
        let prev = s.civs.map((x) => x.treasury);
        while (!s.result && s.era < 40) {
          processEra(s, c, {});
          const e = s.timeline.at(-1);
          e.civs.forEach((r, k) => {
            const before = prev[k], inv = r.invested.military + r.invested.infrastructure + r.invested.technology;
            const expected = before + r.revenue.total - inv;
            const pillaged = s.timeline.length > 1 && r.attacks.enemyConquests > s.timeline.at(-2).civs[k].attacks.enemyConquests;
            const ok = pillaged ? r.treasury >= expected - 1e-6 : Math.abs(r.treasury - expected) < 1e-6 * Math.max(1, before);
            if (r.active && !ok) throw Error(`${mode} seed ${seed} era ${e.era} ${r.id}: saldo ${r.treasury} ≠ ${before} + ${r.revenue.total} − ${inv}`);
            checked++;
          });
          prev = e.civs.map((r) => r.treasury);
        }
      }
    return checked;
  }));

// Rodada 4 (20/11/2026): nenhuma dificuldade usa hoje valores diferentes no 1×1 e com 2+ rivais (Médio 1,00/1,00,
// Difícil 1,03/1,03), por isso a regra é testada com os valores do Médio de antes (1,00 no 1×1, 1,03 com 2+).
test("economia: aiIncomeMultiplier1v1 só vale no 1×1 (1,00 no 1×1, 1,03 com 2+ rivais)", () =>
  rule(() => {
    for (const [ai, exp] of [[1, 1], [2, 1.03], [3, 1.03]]) {
      const c = clone(DEFAULTS);
      c.economy.aiIncomeMultiplier = 1.03; c.economy.aiIncomeMultiplier1v1 = 1; c.map.aiCount = ai;
      const s = newState(c); beginEra(s, c);
      const pl = s.pending.revenue.player.total;
      for (const civ of aiCivs(s)) { const v = s.pending.revenue[civ.id].total; if (Math.abs(v - pl * exp) > 1e-9) throw Error(`${ai} IA(s): receita da IA ${v}, esperado ${pl * exp}`); }
    }
  }));

// ── Militar ──
test("militar: taxa de sucesso dos ataques ≈ 82% e o custo é cobrado na vitória e na derrota", () =>
  rule(() => {
    let wins = 0, n = 0;
    for (let seed = 1; seed <= 40; seed++)
      for (let era = 1; era <= 25; era++) {
        const c = clone(DEFAULTS); c.simulation.seed = seed * 1013;
        const s = newState(c); s.era = era; P(s).military = 100;
        const t = eligibleTargets(s, "player")[era % 2];
        const need = c.military.conquestCost + territoryDefense(s, t.i, c);
        const r = attackTerritory(s, t.i, "player", c);
        if (!r.ok || Math.abs(P(s).military - (100 - need)) > 1e-9) throw Error("custo do ataque incorreto");
        if (r.win !== (s.owners[t.i] === "player")) throw Error("resultado e mapa divergem");
        wins += r.win ? 1 : 0; n++;
      }
    const rate = wins / n;
    if (rate < 0.78 || rate > 0.86) throw Error(`taxa de sucesso ${rate.toFixed(3)} longe de 0,82 em ${n} ataques`);
    return rate;
  }));

test("militar: civilizações diferentes não partilham o mesmo sorteio ao atacar o mesmo território (via attackTerritory)", () =>
  rule(() => {
    // Lacuna: o teste interno equivalente recalcula a fórmula do sorteio em vez de chamar o jogo.
    const c = clone(DEFAULTS); c.map.aiCount = 2;
    let differ = 0;
    for (let era = 1; era <= 40; era++) {
      const res = ["player", "ai", "ai2"].map((id) => {
        const s = newState(c); s.owners.fill("neutral"); s.owners[6] = "player"; s.owners[8] = "ai"; s.owners[13] = "ai2"; s.era = era;
        getCiv(s, id).military = 100; return attackTerritory(s, 7, id, c).win;
      });
      if (new Set(res).size > 1) differ++;
    }
    if (!differ) throw Error("em 40 eras, as três civilizações tiveram sempre o mesmo resultado");
  }));

test("militar: ataques e ordens inválidos são recusados sem gastar poder", () =>
  rule(() => {
    const c = clone(DEFAULTS), s = newState(c); beginEra(s, c); P(s).military = 50;
    const own = s.owners.indexOf("player"), far = s.owners.length - 2;
    for (const [what, r] of [["atacar o próprio território", attackTerritory(s, own, "player", c)], ["atacar território não vizinho", attackTerritory(s, far, "player", c)], ["índice fora do mapa", attackTerritory(s, 99, "player", c)], ["ordem ao próprio território", orderAttack(s, own, "player", c)], ["ordem a não vizinho", orderAttack(s, far, "player", c)]])
      if (r.ok) throw Error(what + " foi aceite");
    if (P(s).military !== 50) throw Error("poder gasto em ação recusada");
    const t = eligibleTargets(s, "player")[0].i;
    if (!orderAttack(s, t, "player", c).ok) throw Error("ordem válida recusada");
    if (orderAttack(s, t, "player", c).ok) throw Error("segunda ordem ao mesmo território aceite");
    if (cancelOrder(s, "player", 23) !== false) throw Error("cancelar ordem inexistente devolveu true");
    A(s).active = false;
    if (attackTerritory(s, eligibleTargets(s, "ai")[0].i, "ai", c).ok) throw Error("civilização eliminada atacou");
  }));

test("militar: com 1 ordem por era, uma nova ordem substitui a anterior e devolve o poder", () =>
  rule(() => {
    const c = clone(DEFAULTS); c.military.maxOrdersPerEra = 1;
    const s = newState(c); beginEra(s, c); s.owners.fill("neutral"); s.owners[7] = "player"; P(s).military = 30;
    const a = orderAttack(s, 6, "player", c), b = orderAttack(s, 8, "player", c);
    const mine = s.orders.filter((o) => o.owner === "player");
    if (!a.ok || !b.ok || mine.length !== 1 || mine[0].idx !== 8) throw Error("ordem não substituída: " + JSON.stringify(mine));
    if (Math.abs(P(s).military - (30 - b.need)) > 1e-9) throw Error("poder da ordem substituída não devolvido");
  }));

// ── Partida ──
test("partida: invariantes de mapa e civilizações em todas as eras (eliminação definitiva, nada negativo, ordens limpas)", () =>
  rule(() => {
    const LP = LAB_PROFILES.map((x) => x[0]);
    for (const seed of [1, 2, 5, 8, 13]) {
      const c = clone(DEFAULTS); c.simulation.seed = seed; c.map.aiCount = 4;
      const s = newState(c, { profiles: LP.slice(0, 5), allAI: true, endRules: true });
      const ids = new Set(["neutral", ...s.civs.map((x) => x.id)]), dead = new Set();
      while (!s.result && s.era < 60) {
        processEra(s, c, {});
        if (s.owners.length !== c.map.territories || s.owners.some((o) => !ids.has(o))) throw Error(`seed ${seed} era ${s.era}: mapa corrompido`);
        if (s.orders.length) throw Error(`seed ${seed} era ${s.era}: ordens por resolver no fim da era`);
        if (s.timeline.length !== s.era) throw Error("histórico com número de eras errado");
        for (const civ of s.civs) {
          const t = countTerritories(s, civ.id);
          if (civ.active && t < 1) throw Error(`${civ.id} ativa sem territórios`);
          if (!civ.active) { if (t) throw Error(`${civ.id} eliminada com ${t} territórios`); dead.add(civ.id); }
          if (dead.has(civ.id) && civ.active) throw Error(`${civ.id} voltou depois de eliminada`);
          if (!(civ.treasury >= 0) || !(civ.military >= 0) || !(civ.techProgress >= 0)) throw Error(`${civ.id}: valores negativos/inválidos`);
        }
      }
      if (!s.result) throw Error(`seed ${seed}: a partida não terminou`);
    }
  }));

test("partida: termina sempre até ao limite de eras (10, 15, 30 e 150) e o vencedor por pontos tem a maior pontuação", () =>
  rule(() => {
    const LP = LAB_PROFILES.map((x) => x[0]);
    const out = [];
    for (const maxEras of [10, 15, 30, 150])
      for (const civs of [2, 4])
        for (const seed of [1, 2, 3]) {
          const c = clone(DEFAULTS); c.endgame.maxEras = maxEras;
          const g = runGame(c, { kind: "auto", profiles: LP, civCount: civs, seed: seed * 31 + maxEras, game: seed });
          if (!g.result) throw Error(`maxEras ${maxEras}: sem resultado`);
          if (g.result.era > maxEras) throw Error(`maxEras ${maxEras}: terminou na era ${g.result.era}`);
          if (g.result.winners.length === 0 && !g.result.allEliminated) throw Error("resultado sem vencedores");
          const reasons = Object.values(g.result.reasons).flat();
          if (reasons.includes("score")) {
            if (g.result.era !== maxEras) throw Error("vitória por pontos antes da última era");
            const sc = g.result.scores, max = Math.max(...sc.map((x) => x.score));
            for (const w of g.result.winners) if (sc.find((x) => x.id === w).score < max * (1 - c.endgame.scoreTieMargin) - 1e-12) throw Error("vencedor por pontos não tem a maior pontuação");
          }
          out.push(g.result.era);
        }
    return out;
  }));

test("partida: o motor não usa Math.random (só a escolha de rival 'Aleatório' usa)", () =>
  rule(() => {
    const LP = LAB_PROFILES.map((x) => x[0]), o = { kind: "auto", profiles: LP, civCount: 3, seed: 77, game: 1 };
    const a = JSON.stringify(runGame(clone(DEFAULTS), o));
    const orig = Math.random; let calls = 0;
    Math.random = () => { calls++; return 0.999; };
    try { const b = JSON.stringify(runGame(clone(DEFAULTS), o)); if (a !== b) throw Error("resultado depende de Math.random"); }
    finally { Math.random = orig; }
    if (calls) throw Error(`Math.random chamado ${calls} vezes pelo motor`);
  }));

test("partida: rival 'Aleatório' sorteia um perfil válido e fica oculto até ao fim", () =>
  rule(() => {
    const valid = new Set(LAB_PROFILES.map((x) => x[0])), saved = opponentChoices.slice();
    try {
      opponentChoices = ["random", "military", "config"];
      const r = resolveOpponents(5);
      if (!valid.has(r[0].profile) || !r[0].hidden) throw Error("aleatório inválido ou visível");
      if (r[1].profile !== "military" || r[1].hidden) throw Error("perfil escolhido não respeitado");
      if (r[2].profile !== null) throw Error("'config' deveria seguir as Configurações");
      if (!valid.has(r[3].profile) || !valid.has(r[4].profile)) throw Error("IAs 4 e 5 sem perfil válido");
    } finally { opponentChoices = saved; }
  }));

// ── Configuração e gravação ──
test("configuração: normalizeConfig é idempotente e recusa valores fora dos limites", () =>
  rule(() => {
    const n1 = normalizeConfig(clone(DEFAULTS)), n2 = normalizeConfig(n1);
    if (JSON.stringify(n1) !== JSON.stringify(n2)) throw Error("normalizar duas vezes muda a configuração");
    const bad = [
      ["economy.initialBudget", -1], ["endgame.maxEras", 9], ["endgame.maxEras", 151], ["endgame.maxEras", 20.5], ["endgame.territoryPct", 0],
      ["map.territories", 3], ["map.territories", 31], ["map.aiCount", 6], ["endgame.scoreWTerritory", 0.5], ["endgame.iceWMilitary", 0.9],
      ["endgame.scoreNormalization", "cubic"], ["military.decayRate", 1.5], ["economy.baseIncome", "abc"],
      // NaN/null/"" (campo vazio) ficam em tests/known-bugs.test.js: hoje são aceites como 0.
    ];
    for (const [path, v] of bad) {
      const c = clone(DEFAULTS), [g, k] = path.split("."); c[g][k] = v;
      let failed = false; try { normalizeConfig(c); } catch (e) { failed = true; }
      if (!failed) throw Error(`${path}=${v} foi aceite`);
    }
  }));

test("gravação: saveGame/loadSavedGame preservam a partida; dados inválidos devolvem null", () =>
  // saveGame/loadSavedGame são assíncronos (armazenamento pronto para o app).
  rule(async () => {
    const KEY = SAVE_KEY, before = localStorage.getItem(KEY);
    try {
      gameMode = "fast"; configApplied = clone(DEFAULTS); configApplied.map.aiCount = 2; state = newGame();
      for (let i = 0; i < 4; i++) playEra({ military: 5, infrastructure: 5, technology: 5 });
      await saveGame();
      const g = await loadSavedGame();
      if (!g || JSON.stringify(g.state) !== JSON.stringify(state)) throw Error("estado gravado ≠ estado carregado");
      if (g.gameMode !== "fast" || g.config.map.aiCount !== 2) throw Error("modo/configuração não preservados");
      for (const raw of ["", "{", "null", '{"v":2,"state":{}}', '{"v":1,"state":{"civs":[],"owners":null}}', '{"v":1,"state":{"civs":[],"owners":[]},"config":{}}']) {
        localStorage.setItem(KEY, raw);
        if ((await loadSavedGame()) !== null) throw Error("save inválido aceite: " + raw);
      }
    } finally { if (before === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, before); }
  }));

// ── Interface ──
test("interface: não deixa investir mais do que o orçamento (campo ajustado ao máximo)", async () => {
  const p = uiCtx.page;
  await p.evaluate(() => { configApplied = clone(DEFAULTS); state = newGame(); renderAll(); document.getElementById("homeScreen").hidden = true; });
  const budget = await p.evaluate(() => P(state).treasury);
  await p.locator("#milSpend").fill(String(budget * 3));
  await p.locator("#milSpend").dispatchEvent("input");
  const v = await p.evaluate(() => readAlloc()[0]);
  assert.ok(v <= budget + 1e-9, `campo aceitou ${v} com orçamento ${budget}`);
  await p.locator("#infraSpend").fill("10");
  await p.locator("#infraSpend").dispatchEvent("input");
  const sum = await p.evaluate(() => readAlloc().reduce((a, b) => a + b, 0));
  assert.ok(sum <= budget + 1e-9, `soma ${sum} acima do orçamento ${budget}`);
});

test("interface: números no formato do Brasil (vírgula decimal, sem 'u..') e campos aceitam vírgula", async () => {
  const p = uiCtx.page;
  await p.evaluate(() => { configApplied = clone(DEFAULTS); state = newGame(); renderAll(); document.getElementById("homeScreen").hidden = true; });
  assert.deepEqual(await p.evaluate(() => [parseAmount("12,5"), parseAmount("12.5"), parseAmount("1.250"), parseAmount("1.250,75"), parseAmount(""), parseAmount("abc")]), [12.5, 12.5, 1250, 1250.75, 0, 0]);
  assert.equal(await p.evaluate(() => fmt(1234.5, 1)), "1.234,5");
  await p.locator('[data-plan="balanced"]').click();
  const shown = await p.locator("#milSpend").inputValue();
  assert.ok(!shown.includes("."), `campo mostra ponto decimal: ${shown}`);
  const alloc = await p.evaluate(() => readAlloc());
  assert.ok(Math.abs(alloc.reduce((a, b) => a + b, 0) - (await p.evaluate(() => P(state).treasury))) < 0.02, "plano não distribuiu o orçamento todo");
  await p.locator("#infraSpend").fill("10,5");
  await p.locator("#infraSpend").dispatchEvent("input");
  assert.equal(await p.evaluate(() => readAlloc()[1]), 10.5);
  await p.evaluate(() => { document.getElementById("details").open = true; renderAll(); });
  const text = await p.evaluate(() => document.getElementById("game").innerText);
  assert.ok(!/u\.\./.test(text), "texto com 'u..'");
});
