// Mapa e folha de ataque (ataque imediato ou ordens simultâneas).
import {saveGame} from "../app/save.js";
import {state,selectedTerritory,configApplied,setSelectedTerritory} from "../app/session.js";
import {eligibleTargets,adjacentOwned} from "../core/map.js";
import {territoryDefense,attackNeed,techAttackDiscount,orderCostMultiplier,attackTerritory,cancelOrder,orderAttack} from "../core/military.js";
import {regionName,civName,civSym} from "../core/names.js";
import {P,aiCivs,getCiv} from "../core/state.js";
import {$} from "./dom.js";
import {cssColor,escapeHtml,fmt,uiText} from "./format.js";
import {renderAll} from "./game.js";
import {civLabel,profileLabel} from "./labels.js";
import {openSheet,isSheetOpen,closeSheet} from "./sheets.js";
import {showToast} from "./toast.js";

/* ── Mapa e painel do alvo ── */
/* Ajusta cada nome de região ao seu quadrado: a largura das letras muda com a fonte de cada
   celular. Primeiro reduz a fonte (até 8,5 px), depois aperta o espaço entre letras. */
export function fitRegionNames(){
 const MIN=8.5;
 document.querySelectorAll("[data-territory] .rname").forEach(n=>{
  n.style.fontSize="";n.style.letterSpacing="";
  const cell=n.closest("[data-territory]"),cs=getComputedStyle(cell);
  const room=cell.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  if(!(room>0)||n.scrollWidth<=room)return;
  const base=parseFloat(getComputedStyle(n).fontSize);
  const size=Math.max(MIN,Math.floor(base*room/n.scrollWidth*10)/10);
  n.style.fontSize=size+"px";
  for(let ls=-.04;n.scrollWidth>room&&ls>=-.1;ls-=.02)n.style.letterSpacing=ls.toFixed(2)+"em";
 });
}
// Legenda mais larga que a tela: marca para esmaecer a borda (indica que rola para o lado).
export function markLegend(){const l=$("mapLegend");if(!l)return;const upd=()=>l.classList.toggle("more",l.scrollWidth>l.clientWidth+1&&l.scrollLeft+l.clientWidth<l.scrollWidth-2);upd();if(!l.dataset.mk){l.dataset.mk=1;l.addEventListener("scroll",upd,{passive:true})}}
export function renderMap(){
 const targets=eligibleTargets(state,"player");
 $("map").innerHTML=state.owners.map((o,i)=>{const civ=o==="neutral"?null:getCiv(state,o),cls=o==="player"?"player":civ?"ai":"",style=civ&&o!=="player"?` style="background:${cssColor(civ.color)}55;border-color:${cssColor(civ.color)}"`:"",target=targets.some(t=>t.i===i)&&P(state).active&&!state.result,sel=selectedTerritory===i;
  return `<button class="territory ${cls} ${target?"target":""} ${sel?"selected":""}" data-territory="${i}" aria-label="${escapeHtml(regionName(i))}, região ${i+1}, ${o==="neutral"?"livre":o==="player"?"sua":"de "+escapeHtml(civName(civ))}${target?", alvo possível":""}"${style}><span class="rname">${escapeHtml(regionName(i))}</span><span class="who"><span class="tnum">${i+1}</span>${civ?`<span class="csym">${civSym(civ)}</span>`:""}</span>${target?`<span class="def gold">Def. ${fmt(territoryDefense(state,i,configApplied),0)}</span>`:""}</button>`}).join("");
 $("mapLegend").innerHTML=`<span>${civLabel(P(state))}</span>`+aiCivs(state).map(c=>`<span>${civLabel(c)}<span class="muted lg-style"> · ${escapeHtml(profileLabel(c))}</span>${c.active?"":" (eliminado)"}</span>`).join("")+`<span><i class="dot sq" style="background:#1a2940;border:1px solid #64758e"></i>Livre</span><span><i class="dot sq" style="border:2px solid #f4bd50"></i>Pode atacar</span>`;
 document.querySelectorAll("[data-territory]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.territory);setSelectedTerritory(i);renderMap();openSheet("attackSheet",()=>document.querySelector(`[data-territory="${i}"]`))}));
 fitRegionNames();markLegend();
 renderAttack();renderEvents();
 if(simOrders())myOrders().forEach((o,k)=>{const cell=document.querySelector(`[data-territory="${o.idx}"]`);if(cell){cell.classList.add("ordered");cell.insertAdjacentHTML("beforeend",`<span class="order-tag">${myOrders().length>1?"⚔ "+(k+1)+".ª":"⚔ ordem"}</span>`)}});
}
// Folha de ataque: região + dono, 3 números (Custo, Sua força, Chance), botão com o motivo quando não dá,
// atalho "Investir em Militar" e a explicação longa atrás de "Por quê?".
export const ATTACK_CHANCE="82%";
export const infoTip=(html,label="Por quê?")=>`<details class="tgt-info"><summary><span aria-hidden="true">ⓘ</span> O ataque acontece no fim da era. <u>${label}</u></summary><div>${html}</div></details>`;
export const targetNums=(cost,have)=>`<div class="tgt-nums"><div class="tgt-num"><span>Custo</span> <b>${fmt(cost,1)}</b></div><div class="tgt-num"><span>Sua força</span> <b class="${have+1e-9>=cost?"ok":"red"}">${fmt(have,1)}</b></div><div class="tgt-num"><span>Chance</span> <b>${ATTACK_CHANCE}</b></div></div>`;
// Região no painel do alvo: nome + número pequeno (o mesmo do mapa).
export const regionHtml=t=>`<strong>${escapeHtml(regionName(t))}</strong> <span class="muted small">${t+1}</span>`;
export const tgtTitle=html=>`<h2 class="tgt-title" id="attackTitle">${html}</h2>`;
export const setAttackBtn=(btn,text,enabled,{cancel=false,invest=false}={})=>{btn.textContent=text;btn.disabled=!enabled;btn.classList.toggle("cancel",cancel);const inv=$("attackInvest");if(inv)inv.hidden=!invest};
// Ordens simultâneas: a ordem fica marcada no mapa e o resultado sai no relatório do fim da era.
export const simOrders=()=>!!configApplied.military.simultaneousOrders,myOrders=()=>(state.orders||[]).filter(o=>o.owner==="player"),myOrder=t=>myOrders().find(o=>o.idx===t);
// Painel do alvo com ordens simultâneas (configuração padrão): a ordem é resolvida no fim da era.
export function renderOrderAttack(){
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military,ords=myOrders(),ord=t!==null?myOrder(t):null,next=orderCostMultiplier(configApplied,ords.length),maxO=m.maxOrdersPerEra||Infinity;
 setAttackBtn(btn,"Escolha um alvo",false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,state.result?"Partida terminada":"Sem ataques",false);$("mapStatus").innerHTML=tgtTitle(t===null?"Mapa":regionHtml(t))+`<p class="tgt-sub">${state.result?"A partida terminou.":"Você foi eliminado e não pode mais atacar."}</p>`;return}
 const ordTxt=ords.length?`<p class="tgt-orders">⚔ Ordens desta era: ${ords.map(o=>`${escapeHtml(regionName(o.idx))} (${fmt(o.need,1)}${o.mult>1?`, ×${fmt(o.mult,1)}`:""})`).join(" · ")}</p>`:"";
 const costTxt=maxO===1?"":ords.length?` O próximo ataque desta era custa ×${fmt(next,1)}.`:" Você pode dar várias ordens por era; cada ataque a mais custa mais (2.º ×2, 3.º ×3…).";
 const howOrders=`As ordens de todos são resolvidas juntas no fim da era: se um rival atacar o mesmo território, há <strong>batalha</strong> (vence quem tiver mais Força, somada à Ciência); depois, ${ATTACK_CHANCE} de chance de conquistar. A Força é gasta mesmo se o ataque falhar.`;
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle("Escolha um alvo")}${ordTxt}<p class="tgt-sub">Toque em um território com <span class="gold">contorno dourado</span> para atacar. Força livre: <strong>${fmt(mil,1)}</strong>.</p>${infoTip(`Cada ataque custa, em Força, a defesa do alvo + ${fmt(m.conquestCost,0)} de conquista.${costTxt} ${howOrders}`)}`;return}
 if(ord){setAttackBtn(btn,"Cancelar ordem",true,{cancel:true});$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ordem dada`)}${ordTxt}<p class="tgt-sub">${fmt(ord.need,1)} de Força reservada. Cancelar devolve a Força${ords.length>1?" e recalcula o custo das outras ordens":""}.</p>${infoTip(`A ordem é resolvida quando você concluir a era, junto com as dos rivais. ${howOrders}`)}`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,"Território seu",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · seu`)}${ordTxt}<p class="tgt-sub">Defesa ${fmt(territoryDefense(state,t,configApplied),1)}. Obras reforçam a defesa.</p>`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,"Fora do alcance",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?"livre":"de "+civLabel(getCiv(state,owner))}`)}${ordTxt}<p class="tgt-sub">Não faz fronteira com o seu império. Escolha um com contorno dourado.</p>`;return}
 const replacing=maxO===1&&ords.length,mult=replacing?1:next,def=territoryDefense(state,t,configApplied),base=attackNeed(state,t,"player",configApplied),disc=techAttackDiscount(state,"player",configApplied),need=base*mult,civ=owner==="neutral"?null:getCiv(state,owner),avail=mil+(replacing?ords[0].need:0);
 if(!replacing&&ords.length>=maxO){setAttackBtn(btn,`Máximo de ${maxO} ordens`,false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${ordTxt}<p class="tgt-sub">Você já deu o máximo de ${maxO} ordens nesta era.</p>`;return}
 const ok=avail+1e-9>=need;setAttackBtn(btn,ok?`${replacing?"Trocar ordem":"Atacar"} · usa ${fmt(need,1)} de Força`:`Faltam ${fmt(need-avail,1)} de Força`,ok,{invest:!ok&&mult<=1});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${mult>1?`<p class="tgt-sub">${ords.length+1}.º ataque desta era: custo ×${fmt(mult,1)}</p>`:""}${ordTxt}${targetNums(need,avail)}${infoTip(`Custo = defesa ${fmt(def,1)} + conquista ${fmt(m.conquestCost,0)}${disc>=0.005?` − ${fmt(100*disc,0)}% (Ciência)`:""}${mult>1?` = ${fmt(base,1)} × ${fmt(mult,1)} (${ords.length+1}.º ataque da era)`:""} = ${fmt(need,1)} de Força.${ok?"":mult>1?" Ataques a mais na mesma era custam mais.":" Invista em Militar: a Força chega na era seguinte."} ${howOrders}`)}`;
}
export function renderAttack(){
 if(simOrders())return renderOrderAttack();
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military;
 setAttackBtn(btn,"Escolha um alvo",false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,state.result?"Partida terminada":"Sem ataques",false);$("mapStatus").innerHTML=tgtTitle(t===null?"Mapa":regionHtml(t))+`<p class="tgt-sub">${state.result?"A partida terminou.":"Você foi eliminado e não pode mais atacar."}</p>`;return}
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle("Escolha um alvo")}<p class="tgt-sub">Toque em um território com <span class="gold">contorno dourado</span> para atacar. Força: <strong>${fmt(mil,1)}</strong>.</p>`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,"Território seu",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · seu`)}<p class="tgt-sub">Defesa ${fmt(territoryDefense(state,t,configApplied),1)}. Obras reforçam a defesa.</p>`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,"Fora do alcance",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?"livre":"de "+civLabel(getCiv(state,owner))}`)}<p class="tgt-sub">Não faz fronteira com o seu império. Escolha um com contorno dourado.</p>`;return}
 const def=territoryDefense(state,t,configApplied),need=attackNeed(state,t,"player",configApplied),disc=techAttackDiscount(state,"player",configApplied),discTxt=disc>=0.005?` − ${fmt(100*disc,0)}% (Ciência)`:"",civ=owner==="neutral"?null:getCiv(state,owner);
 const extra=civ?def-m.defenseOwned:0,defTxt=civ?`defesa ${fmt(m.defenseOwned,0)}${extra>0.05?` + ${fmt(extra,1)} de Obras`:""}`:`defesa ${fmt(def,0)}`;
 const ok=mil+1e-9>=need;setAttackBtn(btn,ok?`Atacar · usa ${fmt(need,1)} de Força`:`Faltam ${fmt(need-mil,1)} de Força`,ok,{invest:!ok});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${targetNums(need,mil)}${infoTip(`Custo = ${defTxt} + conquista ${fmt(m.conquestCost,0)}${discTxt} = ${fmt(need,1)} de Força. Vence em ${ATTACK_CHANCE} das vezes; a Força é gasta mesmo se o ataque falhar.${ok?"":" Invista em Militar: a Força chega na era seguinte."}`)}`;
}
// Botão "Atacar" do painel do alvo (ataque imediato quando as ordens simultâneas estão desligadas).
export function attackSelected(){
 if(simOrders())return orderSelected();
 if(selectedTerritory===null)return;
 const t=selectedTerritory,r=attackTerritory(state,t,"player",configApplied);setSelectedTerritory(null);closeSheet({focus:false});saveGame();renderAll();const msg=r.ok?(r.win?`<span class="green"><strong>Você conquistou ${escapeHtml(regionName(t))}!</strong></span>`:`<span class="red"><strong>O ataque a ${escapeHtml(regionName(t))} falhou</strong></span>; a Força foi gasta.`):escapeHtml(uiText(r.reason));$("mapStatus").innerHTML=msg;showToast(msg,!(r.ok&&r.win))
}
// Botão do painel com ordens simultâneas: dá ou cancela a ordem contra o território escolhido.
export function orderSelected(){
 if(selectedTerritory===null)return;const t=selectedTerritory,ord=myOrder(t);let msg,bad=false;
 if(ord){cancelOrder(state,"player",t);msg=`Ordem contra ${escapeHtml(regionName(t))} cancelada; Força devolvida.`}
 else{const r=orderAttack(state,t,"player",configApplied);bad=!r.ok;msg=r.ok?`<span class="gold"><strong>⚔ Ordem dada:</strong></span> atacar ${escapeHtml(regionName(t))} no fim da era (${fmt(r.need,1)} de Força reservada${r.mult>1?`, ${myOrders().length}.º ataque ×${fmt(r.mult,1)}`:""}).`:escapeHtml(uiText(r.reason))}
 setSelectedTerritory(null);closeSheet({focus:false});saveGame();renderAll();$("mapStatus").innerHTML=msg;showToast(msg,bad)}
export function renderEvents(){
 if(!$("lastEvents"))return;
 const ev=state.log.filter(x=>/ataque|conquist|repelid|falhou|eliminad|🏁/i.test(x.text)).slice(0,3);
 $("lastEvents").innerHTML=ev.length?ev.map(e=>`<div><span class="muted">Era ${escapeHtml(e.era)}</span> · ${escapeHtml(uiText(e.text))}</div>`).join(""):"";
}
