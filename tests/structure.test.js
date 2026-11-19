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
    // Enquanto o armazenamento estiver dentro do index.html: só o bloco `const storage={...};`.
    src = src.replace(/const storage=\{[\s\S]*?\n\};/, "");
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
