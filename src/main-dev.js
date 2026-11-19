// Entrada da versão de DESENVOLVIMENTO (dev.html): o jogo e ainda os laboratórios (Configurações, Testes
// funcionais, Balanceamento, Validação das IAs), o botão Exportar e as variáveis globais de depuração.
import {boot} from "./ui/boot.js";
import {initLabs} from "./labs/index.js";
import {install} from "./debug-dev.js";

boot({saveSlot:"dev",labs:initLabs,debug:install});
