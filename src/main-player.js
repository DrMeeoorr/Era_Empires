// Entrada da versão do JOGADOR (index.html): só o jogo, o tutorial e a configuração da partida.
// Nada de src/labs/ é carregado (verificado por tests/player-version.test.js).
import {boot} from "./ui/boot.js";

// index.html?dev=1 redireciona para dev.html (script no <head>); nesse caso não arranca aqui.
// Os testes automáticos pedem as variáveis globais de depuração (window.__IMPERIOS_TEST__): só então é
// carregado src/debug-player.js.
if(!window.__imperiosRedirect)boot({
 saveSlot:"player",migrateOldSave:true,
 debug:globalThis.__IMPERIOS_TEST__?()=>import("./debug-player.js").then(m=>m.install()):null,
});
