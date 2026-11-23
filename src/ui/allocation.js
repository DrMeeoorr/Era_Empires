// Gaveta de investimento: Militar, Obras e Ciência, planos rápidos, + e −, Resto e Zerar.
import {state,configApplied,busy} from "../app/session.js";
import {effectiveDelay} from "../core/config.js";
import {P} from "../core/state.js";
import {clamp} from "../core/util.js";
import {$} from "./dom.js";
import {parseAmount,fmtInput,escapeHtml,fmt,money} from "./format.js";
import {sheetOpen,closeSheet} from "./sheets.js";
import {wonderCountsNow,wonderHintOff,wonderHintOn} from "./discovery.js";
import {t} from "../i18n/index.js";

/* ── Investimentos: botões, planos e valores ── */
export const AREAS=[["mil","military"],["infra","infrastructure"],["tech","technology"]];
export const PLANS={balanced:[34,33,33],attack:[65,25,10],economy:[20,65,15],tech:[20,20,60],clear:[0,0,0]};
export const round2=v=>Math.floor(v*100+1e-6)/100;
// Resto: o que falta, arredondado ao cêntimo mais próximo sem passar do disponível.
export const restOf=avail=>{const r=Math.round(avail*100)/100;return r>avail+1e-9?r-0.01:r};
export function readAlloc(){return AREAS.map(([k])=>Math.max(0,parseAmount($(k+"Spend").value)))}
export function setAlloc(vals){AREAS.forEach(([k],i)=>{$(k+"Spend").value=fmtInput(vals[i])});renderAllocation()}
export function applyPlan(name){const b=P(state).treasury,w=PLANS[name];const a=round2(b*w[0]/100),i=round2(b*w[1]/100),t=name==="clear"?0:Math.max(0,restOf(b-a-i));setAlloc([a,i,t])}
export function stepArea(idx,dir){const b=P(state).treasury,v=readAlloc(),others=v.reduce((s,x,j)=>s+(j===idx?0:x),0),step=Math.max(1,round2(b*0.1));v[idx]=clamp(round2(v[idx]+dir*step),0,round2(Math.max(0,b-others)));setAlloc(v)}
export function restArea(idx){const b=P(state).treasury,v=readAlloc(),others=v.reduce((s,x,j)=>s+(j===idx?0:x),0);v[idx]=restOf(Math.max(0,b-others));setAlloc(v)}
export function renderAllocation(statusMessage=null){
 const vals=readAlloc(),sum=vals.reduce((a,b)=>a+b,0),b=P(state).treasury,left=Math.max(0,b-sum),c=configApplied;
 const shownLeft=left<0.01?0:left,ended=!!state.result,over=sum>b+1e-8;
 $("actionLeft").classList.toggle("hidden",ended);$("actionEnded").classList.toggle("hidden",!ended);
 if(!ended)$("actionLeft").innerHTML=statusMessage?escapeHtml(statusMessage):over?t("alloc.over"):shownLeft===0?`<span aria-hidden="true">✓</span> ${t("alloc.allIn")}`:shownLeft<0.05?t("alloc.leftTiny",{n:fmt(0.1,1)}):t("alloc.left",{n:fmt(shownLeft,1),count:shownLeft});
 $("advance").classList.toggle("done-all",!ended&&shownLeft===0&&!over&&!statusMessage);
 AREAS.forEach(([k],i)=>{$(k+"Bar").style.width=(b>0?clamp(100*vals[i]/b,0,100):0)+"%";$(k+"Fine").textContent=fmt(vals[i],2)});
 $("allocationStatus").className="status"+(statusMessage||over?" error":"");$("allocationStatus").textContent=statusMessage||(over?t("alloc.overBudget"):left<0.01?t("alloc.allInvested"):t("alloc.toInvest",{gold:money(left)}));
 const milGain=vals[0]*c.military.pointsPerInvestment,infraGain=vals[1]*c.infrastructure.initialReturn,techGain=vals[2]*c.technology.progressPerInvestment*c.technology.benefitPerProgress,techEra=state.era+effectiveDelay("technology",c.technology.delay,state.mode);
 $("milForecast").textContent=t("alloc.milForecast",{n:fmt(milGain,1)});
 $("infraForecast").textContent=t("alloc.infraForecast",{gold:money(infraGain)});
 $("techForecast").textContent=t("alloc.techForecast",{gold:money(techGain),era:String(techEra)});
 $("milPrev").innerHTML=vals[0]>0?t("alloc.milPrev",{n:`<span class="gold">+${fmt(milGain,1)}</span>`}):t("alloc.short");
 $("infraPrev").innerHTML=vals[1]>0?`<span class="green">+${fmt(infraGain,2)}</span>${t("hud.perEra")}`:t("alloc.medium");
 // Maravilha da Humanidade (mapas 2×–4×): as Obras só contam nas eras em que são a maior fatia. Aviso curto na linha
 // das Obras e a frase inteira na folha de ajuste fino; muda a cada toque nos controles.
 const wc=wonderCountsNow(vals),ip=$("infraPrev");
 if(wc===false){ip.innerHTML=`<span class="wd-warn">${t("alloc.offWonder")}</span>`;ip.title=wonderHintOff()}else ip.removeAttribute("title");
 const wh=$("wonderHint");if(wh){wh.hidden=wc===null;wh.textContent=wc===null?"":wc?wonderHintOn():wonderHintOff();wh.classList.toggle("off",wc===false)}
 $("techPrev").innerHTML=vals[2]>0?`<span class="purple">+${fmt(techGain,2)}</span>${t("hud.perEra")}<span class="wide"> · ${t("alloc.techEra",{era:String(techEra)})}</span>`:t("alloc.long");
 $("advTitle").textContent=ended?t("alloc.againArrow"):t("alloc.conclude",{era:String(state.era)});
 $("advance").setAttribute("aria-label",ended?t("alloc.again"):t("alloc.concludeAria",{era:String(state.era),left:$("actionLeft").textContent.trim()}));
 $("advance").disabled=busy||(!ended&&over);
 document.querySelectorAll("#investCard button, #investCard input, #fineSheet button, #plans button").forEach(el=>{if(!el.matches("[data-open]"))el.disabled=ended||!P(state).active});
}
// Planos rápidos: chips na gaveta em telas altas; em telas baixas (≤ 700 px) ficam na folha "Planos ▾".
export const SHORT_SCREEN=matchMedia("(max-height:700px)");
export function placePlans(){const plans=$("plans"),slot=$(SHORT_SCREEN.matches?"plansSheetSlot":"plansInline");if(plans&&slot&&plans.parentElement!==slot)slot.appendChild(plans);if(!SHORT_SCREEN.matches&&sheetOpen==="planSheet")closeSheet({focus:false})}
// Ao rodar o celular ou mudar a altura da janela, os planos mudam de lugar.
export function watchShortScreen(){SHORT_SCREEN.addEventListener?.("change",placePlans)}
