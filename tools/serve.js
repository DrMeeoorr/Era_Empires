// Servidor local mínimo (sem dependências) para jogar no computador: os módulos JavaScript não abrem com
// duplo clique (file://), precisam de um endereço http://.
// Uso: npm start   (ou: node tools/serve.js 8080)   → http://localhost:8080 (jogador) e /dev.html (desenvolvimento)
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT + path.sep) || /(^|[\\/])\.|node_modules/.test(path.relative(ROOT, file))) { res.writeHead(403); return res.end("proibido"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("não encontrado"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Impérios em http://localhost:${PORT}/  (versão de desenvolvimento: http://localhost:${PORT}/dev.html)`);
  console.log("Para parar: Ctrl+C");
});
