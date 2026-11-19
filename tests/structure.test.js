// Regras de organização do código (sem navegador): verificam a estrutura dos ficheiros.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Ficheiros com código do jogo: os .html da raiz e todos os .js de src/. */
function codeFiles() {
  const out = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  const walk = (dir) => {
    if (!fs.existsSync(path.join(ROOT, dir))) return;
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir + "/" + e.name;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith(".js")) out.push(rel);
    }
  };
  walk("src");
  return out;
}

/** Tira comentários de linha e de bloco (aproximado, suficiente para procurar palavras). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

test("localStorage só é usado pelo módulo de armazenamento (storage)", () => {
  const offenders = [];
  for (const rel of codeFiles()) {
    let src = stripComments(read(rel));
    if (rel === "src/platform/storage.js") continue;
    const n = (src.match(/\blocalStorage\b/g) || []).length;
    if (n) offenders.push(`${rel}: ${n}×`);
  }
  assert.deepEqual(offenders, [], "localStorage usado fora do storage");
});

test("nenhuma função do jogo é substituída em cadeia (sem `f=function(){_f();...}`; usar ganchos)", () => {
  const files = codeFiles().map((rel) => [rel, stripComments(read(rel))]);
  const names = new Set();
  for (const [, src] of files) for (const m of src.matchAll(/(?:^|[\s;}])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  const offenders = [];
  for (const [rel, src] of files)
    for (const n of names) {
      // Atribuição no início de uma instrução (depois de ; } ou mudança de linha): `renderMap=...`.
      // Variáveis locais com o mesmo nome em listas (`const a=1,pct=2`) ou valores padrão não contam.
      const re = new RegExp(`(^|[;}\\n])\\s*${n.replace(/\$/g, "\\$")}\\s*=(?![=>])`, "g");
      for (const m of src.matchAll(re)) offenders.push(`${rel}: ${n}= … ${src.slice(m.index, m.index + 60).trim()}`);
    }
  // Botões com o clique "embrulhado" por outra parte do código (const prev=el.onclick; el.onclick=e=>{prev(e)...}).
  for (const [rel, src] of files) for (const m of src.matchAll(/=\s*[\w$]+\.onclick\s*;/g)) offenders.push(`${rel}: ${m[0]}`);
  assert.deepEqual(offenders, []);
});

// Regra de ouro: as regras (src/core) e as IAs (src/ai) não dependem da interface, da sessão, dos
// laboratórios nem da plataforma, e não usam o navegador; assim podem ser testadas e simuladas no Node.
test("regra de ouro: src/core e src/ai não importam ui/app/labs/platform nem usam o DOM", () => {
  const files = codeFiles().filter((f) => f.startsWith("src/core/") || f.startsWith("src/ai/"));
  assert.ok(files.length >= 10, "esperava os módulos de src/core e src/ai");
  const offenders = [];
  const ALLOWED = /^src\/(core|ai)\//;
  const DOM = /\b(document|window|localStorage|sessionStorage|location|navigator|matchMedia|requestAnimationFrame|getComputedStyle|HTMLElement|globalThis)\b/;
  for (const rel of files) {
    const src = stripComments(read(rel));
    for (const m of src.matchAll(/(?:^|[\s;])(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      const spec = m[1] || m[2];
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
      if (!spec.startsWith(".") || !ALLOWED.test(target)) offenders.push(`${rel} importa ${spec}`);
    }
    const dom = src.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, "\"\"").match(DOM);
    if (dom) offenders.push(`${rel} usa ${dom[0]}`);
  }
  assert.deepEqual(offenders, []);
});

/** Importações relativas de um módulo, como caminhos a partir da raiz (ex.: "src/ui/map.js"). */
function importsOf(rel) {
  const src = stripComments(read(rel)), out = [];
  for (const m of src.matchAll(/(?:^|[\s;])(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s*["']([^"']+)["']/gm)) {
    const spec = m[1] || m[2] || m[3];
    out.push(spec.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)) : spec);
  }
  return out;
}

test("a interface do jogo (src/ui), a sessão (src/app) e a plataforma não dependem dos laboratórios", () => {
  const offenders = [];
  for (const rel of codeFiles().filter((f) => /^src\/(ui|app|platform)\//.test(f)))
    for (const t of importsOf(rel)) if (t.startsWith("src/labs/") || t === "src/legacy.js" || t.startsWith("src/main-")) offenders.push(`${rel} importa ${t}`);
  assert.deepEqual(offenders, []);
});

// ── Versão do jogador (index.html) e de desenvolvimento (dev.html) ──

test("index.html é exatamente o gerado a partir de dev.html (npm run build:jogador)", () => {
  const { buildPlayerHtml } = require("../tools/build-player-html.js");
  const expected = buildPlayerHtml(read("dev.html"));
  assert.ok(read("index.html") === expected, "index.html desatualizado: edite dev.html e rode `npm run build:jogador`");
  assert.ok(!/dev-only|labs\.css|main-dev\.js/.test(expected));
});

/** Todos os módulos importados (estática ou dinamicamente) a partir de `entry`, com o caminho de cada um. */
function moduleGraph(entry, { dynamic = true } = {}) {
  const seen = new Map([[entry, [entry]]]), queue = [entry];
  while (queue.length) {
    const f = queue.shift();
    const src = stripComments(read(f));
    const specs = [...src.matchAll(/(?:^|[\s;])(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm)].map((m) => m[1] || m[2]);
    if (dynamic) specs.push(...[...src.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]));
    for (const s of specs) {
      const t = path.posix.normalize(path.posix.join(path.posix.dirname(f), s));
      if (!seen.has(t)) { seen.set(t, [...seen.get(f), t]); queue.push(t); }
    }
  }
  return seen;
}

test("o código do jogador (src/main-player.js) não inclui nada de src/labs/", () => {
  // Inclui o src/debug-player.js (só carregado pelos testes automáticos).
  const g = moduleGraph("src/main-player.js");
  const bad = [...g].filter(([f]) => f.startsWith("src/labs/") || f === "src/debug-dev.js" || f === "src/main-dev.js").map(([, chain]) => chain.join(" → "));
  assert.deepEqual(bad, []);
  assert.ok(g.has("src/ui/game.js") && g.has("src/core/era.js"));
});

test("as variáveis de depuração (src/debug-dev.js / debug-player.js) cobrem todos os módulos", () => {
  const SKIP = new Set(["src/core/index.js", "src/ai/index.js", "src/app/debug.js", "src/ui/boot.js", "src/main-player.js", "src/main-dev.js", "src/debug-player.js", "src/debug-dev.js"]);
  const all = codeFiles().filter((f) => f.startsWith("src/") && !SKIP.has(f));
  const direct = (f) => new Set(importsOf(f));
  const dev = direct("src/debug-dev.js"), player = direct("src/debug-player.js");
  assert.deepEqual(all.filter((f) => !dev.has(f)), [], "faltam em src/debug-dev.js");
  assert.deepEqual(all.filter((f) => !f.startsWith("src/labs/") && !player.has(f)), [], "faltam em src/debug-player.js");
  assert.deepEqual([...player].filter((f) => f.startsWith("src/labs/")), [], "src/debug-player.js não pode importar os laboratórios");
});
