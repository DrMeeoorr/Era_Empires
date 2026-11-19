// Relatório da era: ataques, batalhas, conquistas e saques revelados um a um.
import {saveGame} from "../app/save.js";
import {state} from "../app/session.js";
import {$} from "./dom.js";
import {escapeHtml,uiText} from "./format.js";
import {showModal} from "./modal.js";

// Relatório da era: ataques, batalhas, conquistas e saques revelados um a um.
export function showEraReport(era){
 if(state.ui?.skipReport)return;
 const ev=state.log.filter(x=>x.era===era&&/conquist|repelid|batalha|ordem de|ataque|eliminad|saque/i.test(x.text)&&!/ordenou/i.test(x.text)).reverse();
 if(!ev.length)return;
 const mine=x=>/você|Você|Jogador|bem-sucedido|malsucedido|Seu/.test(x.text)||/de Jogador|\(de você\)/.test(x.text);
 showModal(`<h2>Relatório da era ${escapeHtml(era)}</h2><p class="small muted">As ordens de todos foram resolvidas juntas, em ordem sorteada.</p><div class="report">${ev.map((e,i)=>`<div class="report-line ${mine(e)?"mine":""}" style="animation-delay:${0.25+i*0.45}s">${escapeHtml(uiText(e.text))}</div>`).join("")}</div><label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="skipReport"> Não mostrar relatórios nesta partida</label>`,
  [{label:"Continuar",cls:"primary",onClick:()=>{if($("skipReport")?.checked){state.ui.skipReport=true;saveGame()}}}]);
}
