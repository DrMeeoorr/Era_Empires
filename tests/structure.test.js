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
