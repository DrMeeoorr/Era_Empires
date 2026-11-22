// Grande Descoberta (vitória por Ciência; mapas 2×–4×): faixa do seu progresso no topo, barras por império no Placar,
// avisos de quem passou da metade da meta e textos das regras. Só apresentação: os números vêm do motor
// (src/core/endgame.js). No mapa Original a regra não existe e nada disto aparece.
import {state,configApplied} from "../app/session.js";
import {MAP_SIZES} from "../core/config.js";
import {greatDiscoveryActive,greatDiscoveryProgress,greatDiscoveryGoal,greatDiscoveryMinRegions} from "../core/endgame.js";
import {makeGreatDiscovery,getCiv} from "../core/state.js";
import {civName} from "../core/names.js";
import {$} from "./dom.js";
import {cssColor,escapeHtml,fmt} from "./format.js";
import {civLabel} from "./labels.js";

export const GD_NAME="Grande Descoberta";
export const gdActive=(s=state)=>!!s&&greatDiscoveryActive(s);
const pts=v=>fmt(Math.floor(v+1e-9),0);
// Meta e mínimo de regiões de um tamanho de mapa, antes de a partida existir (tela Personalizar).
export function gdForSize(size){
 const g=MAP_SIZES[size];if(!g||size<=1)return null;
 try{return makeGreatDiscovery(configApplied,size,g.cols*g.rows)}catch(_){return null}
}
// Regra numa frase (Personalizar e regras completas).
export const gdRuleText=(goal,min)=>`${GD_NAME}: junte ${pts(goal)} pontos de Ciência (o que você investe em Ciência) com pelo menos ${min} regiões. Os rivais atacam quem se aproxima da meta.`;
// Sem partida com a regra: os números dos 3 tamanhos.
export function gdRuleGeneric(){
 const l=[2,3,4].map(k=>{const g=gdForSize(k);return g?`${k}× ${pts(g.goal)} com ${g.minRegions} regiões`:""}).filter(Boolean).join("; ");
 return `${GD_NAME} (só nos mapas 2×, 3× e 4×): junte pontos de Ciência (o que você investe em Ciência; o saque não conta) e tenha um mínimo de regiões${l?` — ${l}`:""}. Vence no fim da era. Os rivais atacam quem se aproxima da meta.`;
}
export function fillGdRules(){
 const s=state,txt=gdActive(s)?gdRuleText(greatDiscoveryGoal(s),greatDiscoveryMinRegions(s))+" Vence no fim da era; o saque não conta.":gdRuleGeneric();
 document.querySelectorAll("[data-gd-rule]").forEach(el=>{el.textContent=txt});
}
const mine=(s=state)=>greatDiscoveryProgress(s).find(x=>x.id==="player")||null;

// Faixa compacta no topo: "Descoberta [barra] 7.430/24.000 · ⚑ 18/20".
export function renderDiscoveryHud(){
 const el=$("statDiscovery");if(!el)return;
 const s=state,on=gdActive(s)&&!!getCiv(s,"player")?.active,me=on?mine(s):null;
 el.hidden=!me;if(!me){el.innerHTML="";return}
 const lack=me.minRegions-me.regions,half=me.share>=.5;
 el.className=`hud-gd${me.reached?" done":half?" half":""}`;
 el.setAttribute("aria-label",`${GD_NAME}: ${pts(me.progress)} de ${pts(me.goal)} pontos de Ciência (${fmt(100*me.share,0)}%); regiões ${me.regions} de ${me.minRegions}${me.regionsOk?", mínimo atingido":`, faltam ${lack}`}.`);
 el.innerHTML=`<svg class="ic gd-ic" aria-hidden="true"><use href="#i-spark"/></svg><span class="gd-k" aria-hidden="true">Descoberta</span><span class="gd-bar" aria-hidden="true"><i style="width:${(100*me.share).toFixed(1)}%"></i><b></b></span><span class="gd-v" aria-hidden="true"><b>${pts(me.progress)}</b>/${pts(me.goal)}</span><span class="gd-r ${me.regionsOk?"ok":"lack"}" aria-hidden="true">⚑ ${me.regions}/${me.minRegions}${me.regionsOk?" ✓":""}</span>`;
}
// Bloco do Placar ("Condições de vitória"): uma barra por império, % da meta e regiões ok/faltando.
export function discoveryPanelHtml(){
 const s=state;if(!gdActive(s))return "";
 const list=greatDiscoveryProgress(s).slice().sort((a,b)=>b.share-a.share||b.progress-a.progress);if(!list.length)return "";
 const goal=greatDiscoveryGoal(s),min=greatDiscoveryMinRegions(s);
 return `<h3>${GD_NAME}: ${pts(goal)} pontos de Ciência + ${min} regiões</h3><div class="small muted" style="margin:-2px 0 6px">Pontos = 20% do ouro que cada um investiu em Ciência (o saque não conta). Quem passa da metade vira alvo dos rivais.</div>`+
  list.map(x=>{const c=getCiv(s,x.id),lack=x.minRegions-x.regions;
   return `<div class="gd-row${x.id==="player"?" me":""}" data-gd="${escapeHtml(x.id)}"><div class="row between small"><span>${civLabel(c)}${x.share>=.5&&!x.reached?' <span class="gold">· passou da metade</span>':""}</span><strong>${pts(x.progress)} <span class="muted">· ${fmt(100*x.share,0)}%</span></strong></div><div class="bar gd-pbar" style="margin:3px 0 2px"><span style="width:${(100*x.share).toFixed(1)}%;background:${cssColor(c?.chartColor)}"></span><i class="gd-half" aria-hidden="true"></i></div><div class="gd-reg small ${x.regionsOk?"ok":"lack"}">${x.regionsOk?`✓ ${x.regions} regiões (mínimo ${x.minRegions})`:`✗ ${x.regions} de ${x.minRegions} regiões · faltam ${lack}`}</div></div>`}).join("");
}
// Foto antes de concluir a era (report.js): % da meta de cada império.
export const gdSnapshot=()=>gdActive()?Object.fromEntries(greatDiscoveryProgress(state).map(x=>[x.id,x.share])):null;
// Avisos da era: quem passou de 50% da meta nesta era (cada império passa uma vez só: os pontos nunca diminuem).
export function gdEvents(before){
 if(!before||!gdActive())return [];const out=[];
 for(const x of greatDiscoveryProgress(state)){if(x.reached||x.share<.5||(before[x.id]??0)>=.5)continue;
  out.push(x.id==="player"
   ?{kind:"disc",ok:null,title:`Você passou da metade da ${GD_NAME}`,sub:"os rivais vão reagir: mais Força e ataques contra você"}
   :{kind:"disc",ok:null,civ:x.id,title:`${civNameOf(x.id)} está a caminho da ${GD_NAME}`,sub:`${pts(x.progress)} de ${pts(x.goal)} pontos de Ciência · ${x.regions}/${x.minRegions} regiões`});
 }
 return out;
}
const civNameOf=id=>civName(getCiv(state,id));
// Tela de resultado: pontos de Ciência do jogador (3.º número quando a partida foi decidida pela Grande Descoberta).
export const gdPlayerPoints=()=>mine()?.progress??0;
