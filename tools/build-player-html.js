// Gera o index.html (versão do JOGADOR) a partir do dev.html (versão de desenvolvimento):
//  - tira todos os elementos com a classe "dev-only" (laboratórios, abas, Exportar, "Versão completa"...);
//  - carrega só styles/base.css e styles/game.css e o src/main-player.js (o jogador não baixa os laboratórios);
//  - marca <html class="player-build"> e redireciona index.html?dev=1 para dev.html (links antigos).
// Uso: npm run build:jogador   (tests/structure.test.js falha se o index.html não for igual ao gerado)
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const REDIRECT = `<script>
// Versão do jogador. Endereços antigos com ?dev=1 abrem a versão de desenvolvimento (dev.html).
(function(){const q=new URLSearchParams(location.search);if(q.get("dev")!=="1")return;q.delete("dev");window.__imperiosRedirect=true;const r=q.toString();location.replace("dev.html"+(r?"?"+r:"")+location.hash)})();
</script>
`;

/** Remove os elementos cujo atributo class contém a palavra "dev-only" (HTML bem formado, sem <tags> em comentários). */
function stripDevOnly(html) {
  const open = /<([a-zA-Z][\w-]*)\b[^>]*\bclass="(?:[^"]*\s)?dev-only(?:\s[^"]*)?"[^>]*>/g;
  let out = html, m;
  while ((m = open.exec(out))) {
    const tag = m[1].toLowerCase(), start = m.index;
    // Espaço/mudança de linha logo antes do elemento também sai (quando o elemento ocupa a linha toda).
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
    re.lastIndex = start;
    let depth = 0, end = -1, t;
    while ((t = re.exec(out))) {
      if (t[1]) depth--; else if (!/\/>$/.test(t[0])) depth++;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    if (end < 0) throw new Error("elemento dev-only sem fim: " + m[0]);
    let a = start, b = end;
    const lineStart = out.lastIndexOf("\n", a - 1) + 1, lineEnd = out.indexOf("\n", b);
    if (/^\s*$/.test(out.slice(lineStart, a)) && /^\s*$/.test(out.slice(b, lineEnd < 0 ? out.length : lineEnd))) { a = lineStart; b = lineEnd < 0 ? out.length : lineEnd + 1; }
    out = out.slice(0, a) + out.slice(b);
    open.lastIndex = a;
  }
  return out;
}

function buildPlayerHtml(devHtml) {
  let s = devHtml;
  const swap = (a, b) => { if (!s.includes(a)) throw new Error("dev.html sem: " + a); s = s.replace(a, b); };
  swap('<html lang="pt-BR">', '<html lang="pt-BR" class="player-build">');
  s = s.replace(/<!-- Versão de DESENVOLVIMENTO:[\s\S]*?-->\n/, "<!-- Versão do JOGADOR — gerada a partir de dev.html por tools/build-player-html.js (npm run build:jogador). Não edite à mão. -->\n" + REDIRECT);
  swap('<link rel="stylesheet" href="styles/labs.css">\n', "");
  swap('<script type="module" src="src/main-dev.js"></script>', '<script type="module" src="src/main-player.js"></script>');
  return stripDevOnly(s);
}

module.exports = { buildPlayerHtml, stripDevOnly };

if (require.main === module) {
  const dev = fs.readFileSync(path.join(ROOT, "dev.html"), "utf8");
  const out = buildPlayerHtml(dev);
  fs.writeFileSync(path.join(ROOT, "index.html"), out);
  console.log(`index.html gerado: ${(out.length / 1024).toFixed(1)} KB (dev.html: ${(dev.length / 1024).toFixed(1)} KB)`);
}
