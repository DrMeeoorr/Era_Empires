// Arranque comum às duas versões (jogador e desenvolvimento). Espera o save (armazenamento assíncrono) e só
// depois liga a tela inicial e o tutorial; os laboratórios só existem na versão de desenvolvimento (dev.html).
// window.__imperiosReady fica true quando tudo está pronto (os testes automáticos esperam por isso).
//   saveSlot: "player" ou "dev" (chave do save) · migrateOldSave: mover o save da chave antiga (só jogador)
//   labs: função que liga os laboratórios · debug: função que expõe as variáveis globais de depuração.
import {migrateLegacySaveKey,useSaveSlot} from "../app/save.js";
import {initSheets} from "./sheets.js";
import {watchShortScreen} from "./allocation.js";
import {initGame} from "./game.js";
import {initHome} from "./home.js";
import {initTutorial} from "./tutorial.js";
import {$} from "./dom.js";

export async function boot({saveSlot="player",migrateOldSave=false,labs=null,debug=null}={}){
 if(debug)await debug();
 useSaveSlot(saveSlot);
 if(migrateOldSave)await migrateLegacySaveKey();
 initSheets();watchShortScreen();
 await initGame();
 initHome();
 await initTutorial();
 if(labs&&$("lab"))await labs();
 window.__imperiosReady=true;
}
