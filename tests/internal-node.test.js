// Os testes funcionais internos (defineTests) também correm no Node, sem navegador: as regras (src/core),
// as IAs (src/ai), a sessão (src/app/session.js) e o motor dos laboratórios não dependem da tela.
// É a forma mais rápida de verificar as regras: `node --test tests/internal-node.test.js` (~2 s).
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const SRC = path.resolve(__dirname, "..", "src");
const load = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
// Mesmo mínimo do teste no navegador (tests/internal.test.js): se diminuir, alguém apagou testes.
const MIN_INTERNAL_TESTS = 148;

test("Node: todos os testes internos passam, sem navegador", async () => {
  const session = await load("app/session.js");
  const t = await load("labs/tests-def.js");
  // Como o jogo ao abrir sem save: dificuldade padrão aplicada e uma partida nova em curso.
  session.applyDifficulty(session.currentDifficulty);
  session.setState(session.newGame());
  const before = JSON.stringify({ state: session.state, config: session.configApplied, mode: session.gameMode, diff: session.currentDifficulty });
  const r = t.executeTests(() => true, "Node");
  const failed = t.testRegistry().filter((x) => !t.ftResults.get(x.id).ok).map((x) => `${x.id} · ${x.name} → ${t.ftResults.get(x.id).msg}`);
  console.log(`  testes internos no Node: ${r.pass}/${r.total} aprovados em ${Math.round(t.ftHistory[0].ms)} ms`);
  assert.ok(r.total >= MIN_INTERNAL_TESTS, `Esperava pelo menos ${MIN_INTERNAL_TESTS} testes internos, há ${r.total}`);
  assert.deepEqual(failed, [], "Testes internos falharam no Node:\n" + failed.join("\n"));
  assert.equal(r.pass, r.total);
  const after = JSON.stringify({ state: session.state, config: session.configApplied, mode: session.gameMode, diff: session.currentDifficulty });
  assert.ok(before === after, "executeTests() alterou a partida em curso ou a configuração");
});

// Nota: a "impressão digital" (tests/fingerprint.js) só é comparada no navegador. O Node usa outra versão do
// motor V8, e Math.pow pode diferir no último bit (ex.: 3.6555124551181595 vs 3.655512455118159); com a
// mesma semente as partidas são iguais em cada motor, mas o código de 8 letras muda. Os testes internos
// verificam regras e tolerâncias, por isso passam nos dois.
