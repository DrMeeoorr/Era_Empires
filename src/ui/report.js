// Resumo da era (Fase 3): depois de "Concluir era", o que mudou para você — ouro recebido, regiões ganhas e
// perdidas, ataques ✓/✗ e a mudança no placar ▲▼ — e um botão grande "Era N →".
// Só aparece em tela cheia quando algo aconteceu com você (ataques seus ou contra você, regiões ganhas ou perdidas,
// mudança de posição no placar, eliminação). Nas eras tranquilas, um aviso curto no topo some sozinho, sem pedir toque.
// Não aparece no avanço rápido dos laboratórios nem quando as eras são jogadas por código (playEra): só pelo botão.
import {saveGame} from "../app/save.js";
import {state,configApplied} from "../app/session.js";
import {territorialMinimum,territoryBase} from "../core/endgame.js";
import {countTerritories} from "../core/map.js";
import {regionName} from "../core/names.js";
import {getCiv} from "../core/state.js";
import {$} from "./dom.js";
import {escapeHtml,fmt,cssColor,ord} from "./format.js";
import {t} from "../i18n/index.js";
import {liveScores,PTS,hudNum} from "./hud.js";
import {civLabel,civDisplayName} from "./labels.js";
import {medalNoticeHtml,medalToastText} from "./medals.js";
import {showModal} from "./modal.js";
import {showToast} from "./toast.js";
import {gdSnapshot,gdEvents} from "./discovery.js";

const reduced=()=>typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
const rankOf=lv=>{if(!lv)return null;const k=lv.findIndex(x=>x.id==="player");return k<0?null:{pos:k+1,pts:PTS(lv[k].score)}};
const ptsMap=lv=>Object.fromEntries((lv||[]).map(x=>[x.id,PTS(x.score)]));

// Foto do estado logo antes de concluir a era (game.js chama antes de playEra).
export function eraSnapshot(){
 const lv=liveScores();
 return {era:state.era,owners:state.owners.slice(),orders:(state.orders||[]).filter(o=>o.owner==="player").map(o=>o.idx),
  rank:rankOf(lv),pts:ptsMap(lv),gd:gdSnapshot(),active:Object.fromEntries(state.civs.map(c=>[c.id,!!c.active]))};
}
// O que mudou entre a foto e agora (sem DOM: os testes podem chamar).
export function eraChanges(b){
 const log=state.log.filter(x=>x.era===b.era).map(x=>x.text),ev=[];
 const nameOf=id=>id==="player"?t("civ.you"):civDisplayName(getCiv(state,id));
 for(const idx of b.orders){
  const won=state.owners[idx]==="player",cancel=!won&&log.some(t=>/cancelada/.test(t)&&t.includes(`território ${idx+1} `)&&/Ordem de (Você|Jogador)/.test(t));
  ev.push(won?{kind:"won",ok:true,idx,title:t("sum.won",{region:regionName(idx)}),sub:t("sum.won.sub")}
   :cancel?{kind:"cancel",ok:null,idx,title:t("sum.cancel",{region:regionName(idx)}),sub:t("sum.cancel.sub")}
   :{kind:"failed",ok:false,idx,title:t("sum.failed",{region:regionName(idx)}),sub:t("sum.failed.sub")});
 }
 state.owners.forEach((o,i)=>{if(b.owners[i]==="player"&&o!=="player")ev.push({kind:"lost",ok:false,idx:i,civ:o,title:t("sum.lost",{civ:nameOf(o),region:regionName(i)}),sub:t("sum.lost.sub")})});
 for(const line of log){const m=/^🛡️ Ataque de (.+?) repelido: território (\d+)/.exec(line);if(!m)continue;const idx=+m[2]-1;
  if(b.owners[idx]!=="player"||state.owners[idx]!=="player")continue;
  const civ=state.civs.find(c=>c.name===m[1]);ev.push({kind:"held",ok:true,idx,civ:civ?.id,title:t("sum.held",{civ:civ?nameOf(civ.id):m[1],region:regionName(idx)}),sub:t("sum.held.sub")})}
 for(const c of state.civs){if(b.active[c.id]&&!c.active)ev.push({kind:"elim",ok:c.id!=="player",civ:c.id,title:c.id==="player"?t("sum.youElim"):t("sum.elim",{civ:nameOf(c.id)}),sub:t(c.id==="player"?"sum.youElim.sub":"sum.elim.sub")})}
 // Rivais que cresceram sem ser à sua custa (regiões livres ou de outros rivais): uma linha por rival.
 const grow=[];for(const c of state.civs){if(c.id==="player")continue;const n=state.owners.filter((o,i)=>o===c.id&&b.owners[i]!==c.id&&b.owners[i]!=="player").length;if(n>0)grow.push({kind:"grow",ok:null,civ:c.id,title:t("sum.grow",{civ:nameOf(c.id),n:String(n),count:n}),sub:t("sum.grow.sub")})}
 // Domínio com escolha: o jogador decidiu continuar e mantém 70% (lembrete; não obriga o resumo em tela cheia).
 const min=territorialMinimum(territoryBase(state),configApplied.endgame.territoryPct),dom=[];
 if(state.dominion?.declined&&!state.unlimited&&countTerritories(state,"player")>=min)dom.push({kind:"dom",ok:true,title:t("sum.dom"),sub:t("sum.dom.sub",{min:String(min),era:String(state.maxEras)})});
 const lv=liveScores(),rank=rankOf(lv),r=state.pending?.revenue?.player||{total:0,normal:0,infra:0,tech:0};
 const mine=ev.length>0,moved=!!(b.rank&&rank&&b.rank.pos!==rank.pos);
 // Grande Descoberta e Maravilha (mapas 2×–4×): quem passou da metade de uma meta nesta era. Mostra o resumo em tela cheia.
 const disc=gdEvents(b.gd);
 return {era:b.era,next:state.era,gold:r.total||0,rev:r,events:[...disc,...dom,...ev,...grow],disc,mine,moved,rank,before:b.rank,lv,prevPts:b.pts,full:mine||moved||disc.length>0};
}
// Título do resumo: a chave (sum.t.*) e o texto.
function titleKey(c){const k=new Set(c.events.map(e=>e.kind));
 if(k.has("elim")&&c.events.some(e=>e.kind==="elim"&&e.civ==="player"))return "youElim";
 if(k.has("won"))return k.has("lost")?"wonLost":"won";
 if(k.has("lost"))return "lost";
 if(k.has("held"))return "held";
 if(k.has("failed"))return "failed";
 if(c.moved)return c.rank.pos<c.before.pos?"up":"down";
 if(c.disc?.length){const w=c.disc.every(e=>e.kind==="wonder"),d=c.disc.every(e=>e.kind==="disc");return c.disc.some(e=>e.civ)?(w?"raceWonder":d?"raceDisc":"raceEnd"):(w?"towardWonder":d?"towardDisc":"towardWin")}
 return "quiet";}
function titleFor(c){return t("sum.t."+titleKey(c))}
const ICON={disc:["✦","warn"],wonder:["▰","warn"],dom:["♛","ok"],won:["⚑","ok"],failed:["⚔","bad"],cancel:["↩","info"],lost:["⚑","bad"],held:["🛡","ok"],elim:["☠","info"],grow:["▲","info"]};
function eventHtml(e,k){const [ic,tone]=ICON[e.kind]||["•","info"],civ=e.civ&&e.civ!=="player"?getCiv(state,e.civ):null;
 const tag=e.ok===true?`<span class="ev-tag ok" aria-label="${t("sum.ok")}">✓</span>`:e.ok===false?`<span class="ev-tag bad" aria-label="${t("sum.bad")}">✗</span>`:"";
 const title=escapeHtml(e.title).replace(escapeHtml(civ?civDisplayName(civ):"\u0000"),civ?civLabel(civ):"");
 return `<div class="ev ${tone} ${e.kind==="won"?"mine":""}" style="--d:${(0.15+k*0.09).toFixed(2)}s"><span class="ev-ic" aria-hidden="true">${ic}</span><div class="ev-t"><b>${title}</b><span>${escapeHtml(e.sub)}</span></div>${tag}</div>`}
function scoreHtml(c){
 if(!c.lv)return "";const max=Math.max(...c.lv.map(x=>PTS(x.score)),1);
 const mv=!c.rank?"":!c.before?ord(c.rank.pos):c.rank.pos<c.before.pos?`<span class="up">▲ ${t("sum.rankUp",{pos:ord(c.rank.pos)})}</span>`:c.rank.pos>c.before.pos?`<span class="down">▼ ${t("sum.rankDown",{pos:ord(c.rank.pos)})}</span>`:`<span class="same">= ${t("sum.rankSame",{pos:ord(c.rank.pos)})}</span>`;
 return `<div class="sum-score"><div class="sum-score-h"><span>${t("sum.score")}</span>${mv}</div>${c.lv.map((x,i)=>{const p=PTS(x.score),d=c.prevPts[x.id]!=null?p-c.prevPts[x.id]:null;
  return `<div class="sum-row ${x.id==="player"?"me":""}"><span class="pos">${ord(i+1)}</span><span class="nm">${x.civ?civLabel(x.civ):escapeHtml(x.name)}</span><span class="bar"><i style="--w:${(100*p/max).toFixed(1)}%;background:${cssColor(x.civ?.chartColor)}"></i></span><b>${fmt(p,0)}</b><span class="tr ${d>0?"up":d<0?"down":""}">${d?`${d>0?"▲":"▼"}${fmt(Math.abs(d),0)}`:""}</span></div>`}).join("")}</div>`}
// Mostra o resumo da era b.era (tela cheia) ou o aviso curto. Devolve o que foi mostrado ("full", "toast" ou "").
// medals: medalhas NOVAS desta era ([{id,first}]; game.js) → bloco "Nova medalha" no resumo ou no aviso curto.
export function showEraSummary(b,medals=[]){
 if(!b||state.result)return "";
 const c=eraChanges(b),skip=!!state.ui?.skipReport;
 if((!c.full&&!medals.length)||skip){
  showToast(medals.length?medalToastText(medals)+" · "+t("sum.eraDone",{era:escapeHtml(c.era)}):`<strong>${t("sum.eraDone",{era:escapeHtml(c.era)})}</strong> · ${t("sum.goldPlus",{n:hudNum(c.gold)})}${c.rank?" · "+t("sum.rankToast",{pos:ord(c.rank.pos)}):""}${skip&&c.mine?" · "+t("sum.seeDetails"):""}${c.disc.length?" · "+c.disc.map(e=>escapeHtml(e.title)).join(" · "):""}`);
  return "toast";
 }
 const r=c.rev,parts=[["sum.fromLands",r.normal],["sum.fromWorks",r.infra],["sum.fromScience",r.tech]].filter(([,v])=>v>=0.05).map(([k,v])=>t(k,{n:hudNum(v)})).join(" · ");
 showModal(`<div class="sum-kicker">${t("sum.eraDone",{era:escapeHtml(c.era)})}</div><h2 class="sum-title" id="sumTitle">${medals.length&&titleKey(c)==="quiet"?t("sum.newMedal"):titleFor(c)}</h2>
<div class="sum-gold"><div class="n"><span class="coin" aria-hidden="true">$</span><span id="sumGold" data-to="${c.gold}">+${hudNum(c.gold)}</span></div><div class="t">${t("sum.goldFor",{era:escapeHtml(c.next)})}${parts?`<br><span>${parts}</span>`:""}</div></div>
${medalNoticeHtml(medals)}<div class="sum-events">${c.events.map(eventHtml).join("")||`<p class="muted small">${t("sum.noAttacks")}</p>`}</div>${scoreHtml(c)}`,
  [{label:`${t("sum.next",{era:escapeHtml(c.next)})} <span aria-hidden="true">→</span>`,cls:"primary sum-next"}]);
 const back=$("modalRoot").querySelector(".modal-back");back.classList.add("sum-back");back.setAttribute("aria-labelledby","sumTitle");back.querySelector(".modal").classList.add("era-sum");back.querySelector(".modal").id="eraSummary";
 back.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();back.querySelector(".sum-next")?.click()}});
 // Animação curta: o ouro conta para cima e as barras crescem (desligada com "reduzir movimento").
 const g=$("sumGold");
 if(!reduced()&&g&&typeof requestAnimationFrame==="function"){const to=c.gold,t0=performance.now(),D=600;g.textContent="+0";
  const f=t=>{if(!g.isConnected)return;const k=Math.min(1,(t-t0)/D);g.textContent="+"+hudNum(to*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
 return "full";
}
// Menu ☰: liga/desliga o resumo em tela cheia nesta partida (desligado, fica só o aviso curto).
export function toggleEraSummary(){state.ui.skipReport=!state.ui.skipReport;saveGame();renderSummaryToggle()}
export function renderSummaryToggle(){const b=$("summaryToggle");if(!b)return;const on=!state?.ui?.skipReport;b.setAttribute("aria-pressed",String(on));const s=b.querySelector(".mi-state");if(s)s.textContent=t(on?"menu.on":"menu.off")}
