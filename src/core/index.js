// Regras do jogo (motor), sem DOM: tudo o que as outras partes e os testes usam do núcleo.
// Regra de ouro: nada em src/core/ nem em src/ai/ importa src/ui/, src/app/, src/labs/ ou src/platform/
// (verificado por tests/structure.test.js).
export * from "./util.js";
export * from "./rng.js";
export * from "./format.js";
export * from "./config.js";
export * from "./names.js";
export * from "./map.js";
export * from "./state.js";
export * from "./economy.js";
export * from "./military.js";
export * from "./references.js";
export * from "./endgame.js";
export * from "./era.js";
export * from "./match.js";
