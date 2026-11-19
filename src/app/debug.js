// Depuração e testes automáticos: expõe as funções e o estado do jogo como variáveis globais, como eram
// antes da divisão em módulos (na consola do navegador e nos testes de tests/*.test.js basta escrever
// `state`, `runTests()`, `newGame()`...). Também ficam reunidas em window.__imperios.
// Só é ligado na versão de desenvolvimento ou quando os testes o pedem (window.__IMPERIOS_TEST__ = true
// antes de o jogo abrir); o jogador normal não tem estas variáveis globais.
//
// namespaces: módulos (import * as ...) cujas exportações são expostas; a leitura é sempre o valor atual.
// setters: {nome: v => ...} para as variáveis que os testes podem substituir (ex.: state = newGame()).
export function exposeGlobals(namespaces, setters = {}) {
  const api = {};
  const readOnly = (k) => () => { throw new TypeError(`${k} não pode ser substituído (use os ganchos do jogo)`); };
  for (const ns of namespaces)
    for (const k of Object.keys(ns)) {
      const desc = { configurable: true, enumerable: true, get: () => ns[k], set: setters[k] || readOnly(k) };
      Object.defineProperty(api, k, desc);
      try { Object.defineProperty(globalThis, k, { ...desc, enumerable: false }); } catch (e) { /* nome reservado do navegador: só em __imperios */ }
    }
  globalThis.__imperios = api;
  return api;
}
