// Folhas inferiores (bottom sheets): ataque, planos, placar, detalhes, menu, terrenos. Uma de cada vez; o botão voltar fecha.
import {selectedTerritory,setSelectedTerritory} from "../app/session.js";
import {$} from "./dom.js";
import {renderMetrics} from "./hud.js";
import {renderMap,renderTerrainSheet} from "./map.js";
import {renderForecast,renderHistory,renderNotifications,renderCharts,renderVictory,renderResultDetails} from "./panels.js";

/* ── Folhas inferiores (bottom sheets): ataque, menu, placar, planos, ajuste fino, Como jogar e Detalhes ──
   Uma folha de cada vez. Fecham com toque fora, Esc, o botão ✕ e o botão voltar do navegador/Android
   (a folha aberta ocupa uma entrada do histórico). Enquanto há uma folha aberta, o resto da tela fica inerte
   e o foco fica preso dentro dela; ao fechar, o foco volta para quem a abriu. */
export const SHEET_HOOKS={
 attackSheet:{onClose:()=>{if(selectedTerritory!==null){setSelectedTerritory(null);renderMap()}}},
 terrainSheet:{onOpen:()=>renderTerrainSheet()},
 details:{onOpen:()=>{renderForecast();renderHistory();renderNotifications();requestAnimationFrame(renderCharts)}},
 scoreSheet:{onOpen:()=>{renderMetrics();renderVictory()}},
 resultSheet:{onOpen:()=>requestAnimationFrame(renderResultDetails)},
};
export const FOCUSABLE='button:not([disabled]):not([hidden]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
export let sheetOpen=null,sheetReturn=null,sheetHist=false,sheetIgnorePop=0;
export function isSheetOpen(id){return id?sheetOpen===id:!!sheetOpen}
export function setInertBehind(on){
 const keep=el=>el.classList.contains("sheet")||el.classList.contains("sheet-scrim");
 [...document.querySelectorAll(".wrap > *"),...document.querySelectorAll("#game > *")].forEach(el=>{if(el.id==="game"||keep(el))return;if(on)el.inert=true;else el.inert=false});
 const tut=$("tutBox");if(tut)tut.inert=on;
}
export function openSheet(id,opener){
 const el=$(id);if(!el||sheetOpen===id)return;
 if(sheetOpen)closeSheet({swap:true});
 else sheetReturn=opener||document.activeElement;
 sheetOpen=id;el.hidden=false;$("sheetScrim").hidden=false;setInertBehind(true);
 document.querySelectorAll(`[data-open="${id}"]`).forEach(b=>b.setAttribute("aria-expanded","true"));
 if(!sheetHist){try{history.pushState({imperiosSheet:id},"");sheetHist=true}catch(e){}}
 el.scrollTop=0;SHEET_HOOKS[id]?.onOpen?.();
 el.focus({preventScroll:true});
}
export function closeSheet({swap=false,fromPop=false,focus=true}={}){
 const id=sheetOpen;if(!id)return;sheetOpen=null;
 $(id).hidden=true;document.querySelectorAll(`[data-open="${id}"]`).forEach(b=>b.setAttribute("aria-expanded","false"));
 SHEET_HOOKS[id]?.onClose?.();
 if(swap)return;
 $("sheetScrim").hidden=true;setInertBehind(false);
 if(fromPop)sheetHist=false;
 else if(sheetHist){sheetHist=false;sheetIgnorePop++;try{history.back()}catch(e){sheetIgnorePop--}}
 let r=sheetReturn;sheetReturn=null;if(typeof r==="function")r=r();
 if(focus&&r&&r.isConnected&&r.offsetParent!==null)r.focus({preventScroll:true});
}
// Liga as folhas inferiores: propriedade .open, botão voltar do Android/navegador, toques e teclado (Esc, Tab).
export function initSheets(){
 // .open nas folhas (como nos antigos <details> "Como jogar" e "Detalhes"): ler diz se está aberta, escrever abre/fecha.
 document.querySelectorAll(".sheet").forEach(el=>Object.defineProperty(el,"open",{configurable:true,get(){return sheetOpen===el.id},set(v){if(v)openSheet(el.id);else if(sheetOpen===el.id)closeSheet()}}));
 window.addEventListener("popstate",()=>{
  if(sheetIgnorePop>0){sheetIgnorePop--;if(sheetOpen&&!sheetHist){try{history.pushState({imperiosSheet:sheetOpen},"");sheetHist=true}catch(e){}}return}
  if(sheetOpen)closeSheet({fromPop:true});
 });
 document.addEventListener("click",e=>{
  const o=e.target.closest("[data-open]");if(o&&!o.disabled){e.preventDefault();openSheet(o.dataset.open,o);return}
  if(e.target.closest("[data-close]")||e.target.id==="sheetScrim")closeSheet();
 });
 document.addEventListener("keydown",e=>{
  if(!sheetOpen||$("modalRoot").firstChild)return;
  if(e.key==="Escape"){e.preventDefault();closeSheet();return}
  if(e.key!=="Tab")return;
  const el=$(sheetOpen),f=[...el.querySelectorAll(FOCUSABLE)].filter(x=>x.offsetParent!==null&&!x.closest("[hidden]"));if(!f.length){e.preventDefault();el.focus();return}
  const first=f[0],last=f.at(-1),a=document.activeElement;
  if(e.shiftKey&&(a===first||a===el||!el.contains(a))){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(a===last||!el.contains(a))){e.preventDefault();first.focus()}
 });
}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setSheetOpen(v){sheetOpen=v;return v}
export function setSheetReturn(v){sheetReturn=v;return v}
export function setSheetHist(v){sheetHist=v;return v}
export function setSheetIgnorePop(v){sheetIgnorePop=v;return v}
