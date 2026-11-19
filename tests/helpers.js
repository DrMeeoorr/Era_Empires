// Utilitários comuns da suíte de testes automáticos do Impérios.
// Usa o Playwright já instalado (local ou global). Não descarrega navegadores.
"use strict";
const path = require("node:path");
const fs = require("node:fs");

let playwright;
try {
  playwright = require("playwright");
} catch (e) {
  throw new Error(
    "Playwright não encontrado. Instale com `npm i -D playwright` e `npx playwright install chromium` " +
      "(ou use um ambiente onde `require('playwright')` funcione)."
  );
}
const { chromium, devices } = playwright;

const ROOT = path.resolve(__dirname, "..");
// O jogo é servido por uma origem http falsa (interceptada pelo Playwright, sem servidor):
// com file:// o Chromium perdia por vezes o localStorage ao recarregar (falso negativo no teste de salvar).
// GAME_URL pode apontar para outro endereço (ex.: servidor local ou build dividido em módulos).
const VIRTUAL_ORIGIN = "http://imperios.test";
const GAME_URL = process.env.GAME_URL || VIRTUAL_ORIGIN + "/index.html";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

/** Serve os ficheiros do repositório em VIRTUAL_ORIGIN dentro do contexto. */
async function serveRepo(context) {
  await context.route(VIRTUAL_ORIGIN + "/**", (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ path: file, contentType: MIME[path.extname(file)] || "application/octet-stream" });
  });
}
const SHOTS_DIR = path.join(__dirname, "artifacts");

// Chaves de localStorage usadas pelo jogo.
const KEYS = {
  save: "imperios-completo-partida",
  tutorialOffered: "imperios-tutorial-oferecido",
};

// Telas de celular exigidas. deviceScaleFactor 1: capturas leves (só para verificação).
const MOBILE_SCREENS = [
  ["Pixel 7", { ...devices["Pixel 7"], deviceScaleFactor: 1 }],
  ["Galaxy S9+", { ...devices["Galaxy S9+"], deviceScaleFactor: 1 }],
  [
    "360x640",
    {
      viewport: { width: 360, height: 640 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      userAgent: devices["Pixel 7"].userAgent,
    },
  ],
];

async function launch() {
  return chromium.launch();
}

/**
 * Abre o jogo num contexto novo (localStorage limpo).
 * opts.contextOptions: opções do Playwright (dispositivo, viewport...).
 * opts.offerTutorial: false (padrão) marca o tutorial como já oferecido, para não abrir o convite.
 * Devolve {context, page, errors}; `errors` acumula erros de consola e exceções da página.
 */
async function openGame(browser, { contextOptions = {}, offerTutorial = false } = {}) {
  const context = await browser.newContext({ deviceScaleFactor: 1, ...contextOptions });
  if (!process.env.GAME_URL) await serveRepo(context);
  if (!offerTutorial) {
    await context.addInitScript((k) => {
      try {
        if (!localStorage.getItem(k)) localStorage.setItem(k, "1");
      } catch (e) {}
    }, KEYS.tutorialOffered);
  }
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console.error: " + m.text());
  });
  page.on("pageerror", (e) => errors.push("exceção: " + (e.stack || e.message)));
  page.on("requestfailed", (r) => errors.push("pedido falhou: " + r.url()));
  await page.goto(GAME_URL);
  await page.waitForFunction(() => typeof state !== "undefined" && !!state && typeof runTests === "function");
  return { context, page, errors };
}

/** Fecha qualquer modal aberto clicando no botão principal (ou no primeiro). */
async function dismissModals(page, { max = 5 } = {}) {
  for (let i = 0; i < max; i++) {
    const btn = page.locator("#modalRoot .modal button.primary, #modalRoot .modal [data-mb]").first();
    if (!(await btn.count())) return;
    await btn.click();
  }
}

/** Conclui a era pelo botão da interface, lidando com o aviso de saldo e o relatório da era. */
async function concludeEraUI(page) {
  const eraBefore = await page.evaluate(() => state.era);
  await page.locator("#advance").click();
  // Aviso de saldo parado: "Concluir mesmo assim".
  const idle = page.locator('#modalRoot button:has-text("Concluir mesmo assim")');
  if (await idle.count()) await idle.click();
  await page.waitForFunction((e) => state.result || state.era > e, eraBefore);
  // O relatório da era abre 60 ms depois; espera um pouco e fecha-o.
  await page.waitForTimeout(120);
  await dismissModals(page);
}

/** Verifica rolagem horizontal do documento e da tela visível (inicial/configuração usam overflow próprio). */
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push(`documento: scrollWidth ${de.scrollWidth} > ${de.clientWidth}`);
    for (const id of ["homeScreen", "setupScreen"]) {
      const el = document.getElementById(id);
      if (el && !el.hidden && el.scrollWidth > el.clientWidth + 1) out.push(`${id}: scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
    }
    return out;
  });
}

/** Garante que o elemento está visível e clicável (scroll + verificação de que nada o tapa). */
async function assertClickable(page, selector, label = selector) {
  const loc = page.locator(selector).first();
  if (!(await loc.count())) throw new Error(`${label}: elemento não existe`);
  await loc.scrollIntoViewIfNeeded();
  if (!(await loc.isVisible())) throw new Error(`${label}: não está visível`);
  const box = await loc.boundingBox();
  const vp = page.viewportSize();
  if (!box || box.width < 1 || box.height < 1) throw new Error(`${label}: sem tamanho`);
  if (box.x < -1 || box.x + box.width > vp.width + 1) throw new Error(`${label}: sai da largura da tela (x=${box.x}, w=${box.width})`);
  // trial: verifica acionabilidade (visível, estável, ativo, não tapado) sem clicar.
  await loc.click({ trial: true, timeout: 3000 });
  return box;
}

async function screenshot(page, name) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const file = path.join(SHOTS_DIR, name.replace(/[^\w.-]+/g, "_") + ".png");
  await page.screenshot({ path: file });
  return file;
}

module.exports = {
  playwright, chromium, devices, ROOT, GAME_URL, KEYS, MOBILE_SCREENS, SHOTS_DIR,
  launch, openGame, dismissModals, concludeEraUI, horizontalOverflow, assertClickable, screenshot,
};
