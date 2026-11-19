// Nomes no ecrã: estilo dos rivais (Equilibrado, Militar…), símbolo na cor do mapa e rótulo das civilizações.
import {LAB_PROFILE_NAME} from "../ai/profiles.js";
import {state,profileOf} from "../app/session.js";
import {civSym,civName} from "../core/names.js";
import {cssColor,escapeHtml} from "./format.js";

// Nomes de estilo mostrados ao jogador (os laboratórios continuam a usar LAB_PROFILE_NAME).
export const PLAYER_PROFILE_NAME={reference:"Equilibrado",military:"Militar",aggressive:"Agressivo",technologist:"Científico",economist:"Construtor",adaptive:"Adaptativo"};
export const playerProfileName=p=>PLAYER_PROFILE_NAME[p]||LAB_PROFILE_NAME[p]||p;
export function profileLabel(c,reveal=false){if(c.id==="player")return "";if(c.hiddenProfile&&!reveal&&!state.result)return "estilo oculto";return playerProfileName(profileOf(c))}
// Nome do jogador/rival com o símbolo (★ ▲ ● ◆ ■ ✚) na cor do mapa: não depende só da cor.
export const civSymHtml=c=>`<span class="csym" style="color:${cssColor(c.color)}" aria-hidden="true">${civSym(c)}</span>`;
export const civLabel=c=>`${civSymHtml(c)} ${escapeHtml(civName(c))}`;
