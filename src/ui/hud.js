// Barra de recursos (era, ouro, Força, terras, posição no placar) e placar completo.
import {state,configApplied} from "../app/session.js";
import {DIFFICULTIES} from "../core/config.js";
import {territorialMinimum,territoryBase,finalScores} from "../core/endgame.js";
import {countTerritories} from "../core/map.js";
import {P,getCiv} from "../core/state.js";
import {clamp} from "../core/util.js";
import {$} from "./dom.js";
import {fmt,escapeHtml,money,cssColor,ord} from "./format.js";
import {civLabel,profileLabel,civDisplayName,diffName} from "./labels.js";
import {t} from "../i18n/index.js";
import {renderDiscoveryHud} from "./discovery.js";

/* ── Barra de recursos (topo) ── */
// Números curtos para a barra: sem casas decimais a partir de 100.
export const hudNum=v=>fmt(v,Math.abs(v)>=100?0:1);
export function renderMetrics(){
 const s=state,me=P(s),r=s.pending?.revenue?.player||s.history.at(-1)||{normal:0,infra:0,tech:0,total:0},g=configApplied.endgame,min=territorialMinimum(territoryBase(s),g.territoryPct),mine=countTerritories(s,"player");
 const pct=clamp(100*s.era/Math.max(1,s.maxEras),0,100);
 // Sem limite: "Era N/∞", sem barra de progresso (o teto de segurança, 100 eras no Original, fica nas regras completas e no Placar).
 $("statEra").innerHTML=s.unlimited?`<div class="hud-era-t"><span>${t("hud.era")}</span><span class="of" aria-label="${t("hud.eraUnlAria",{era:escapeHtml(s.era)})}"><b>${escapeHtml(s.era)}</b>/∞</span></div><div class="hud-prog unlimited" aria-hidden="true"><span style="width:0%"></span></div>`
  :`<div class="hud-era-t"><span>${t("hud.era")}</span><span class="of"><b>${escapeHtml(s.era)}</b>/${escapeHtml(s.maxEras)}</span></div><div class="hud-prog" role="progressbar" aria-label="${t("hud.erasPlayed")}" aria-valuemin="0" aria-valuemax="${escapeHtml(s.maxEras)}" aria-valuenow="${escapeHtml(s.era)}"><span style="width:${pct}%"></span></div>`;
 $("statGold").innerHTML=`<span class="hud-ico gold-ico" aria-hidden="true">$</span><span class="hud-v"><b>${hudNum(me.treasury)} <small>${t("hud.gold")}</small></b><span class="k"><span class="green">+${hudNum(r.total)}</span>${t("hud.perEra")}</span></span>`;
 $("statGold").title=t("hud.goldTitle",{gold:money(r.total),land:fmt(r.normal,1),works:fmt(r.infra,1),science:fmt(r.tech,1)});
 $("statForce").innerHTML=`<span class="hud-ico force-ico" aria-hidden="true">⚔</span><span class="hud-v"><b>${fmt(me.military,1)}</b><span class="k">${t("hud.force")}</span></span>`;
 $("statForce").title=t("hud.forceTitle");
 renderDiscoveryHud();
 $("statTerr").innerHTML=`<span class="hud-ico terr-ico" aria-hidden="true">⚑</span><span class="hud-v"><b>${mine}<small>/${min}</small></b><span class="k">${t("hud.lands")}</span></span>`;
 $("statTerr").setAttribute("aria-label",t(mine>=min?"hud.landsAriaReached":"hud.landsAria",{mine:String(mine),min:String(min)}));
 const lv=liveScores(),pill=$("scorePill"),meS=lv?.find(x=>x.id==="player");
 if(!lv){pill.innerHTML=`<span aria-hidden="true">🏆</span> <span class="gap none">—</span>`;pill.setAttribute("aria-label",t("hud.pillNone"))}
 else if(!meS){pill.innerHTML=`<span aria-hidden="true">🏆</span> <span class="gap down">${t("hud.out")}</span>`;pill.setAttribute("aria-label",t("hud.pillOut"))}
 else{const pos=lv.indexOf(meS)+1,lead=lv[0],d=pos===1?(lv[1]?PTS(meS.score)-PTS(lv[1].score):0):PTS(lead.score)-PTS(meS.score);
  pill.innerHTML=`<span aria-hidden="true">🏆</span> ${ord(pos)} <span class="gap ${pos===1?"up":"down"}">${pos===1?"+":"−"}${d}</span>`;
  pill.setAttribute("aria-label",pos===1?(lv[1]?t("hud.pillLead",{pos:ord(pos),d:String(d),count:d}):t("hud.pillPos",{pos:ord(pos)})):t("hud.pillBehind",{pos:ord(pos),d:String(d),count:d,name:lead.name}))}
 $("matchInfo").textContent=[s.unlimited?t("setup.sum.unlimited"):t("setup.sum.eras",{n:String(s.maxEras)}),DIFFICULTIES[s.difficulty]?diffName(s.difficulty):diffName("medio"),t(s.mode==="fast"?"setup.sum.paceFast":"setup.sum.paceNormal"),g.supremacyEnabled===false&&t("setup.sum.conquest"),t("hud.matchLands",{mine:String(mine),free:String(countTerritories(s,"neutral"))})].filter(Boolean).join(" · ");
 // Placar completo (folha "Placar e vitória"): posição, pontos, diferença para o líder e variação na última era.
 const strip=$("scoreStrip");
 if(!lv){strip.innerHTML=`<p class="muted small">${t("hud.scoreLater")}</p>`;return}
  const top=PTS(lv[0].score),prev=state.timeline.length>1?(()=>{const e=state.timeline.at(-2);const sc=finalScores(e.civs.map(r=>({id:r.id,dims:r.dims})),e.era,configApplied);const m={};e.civs.forEach((r,k)=>m[r.id]=PTS(sc[k].score));return m})():{};
  strip.innerHTML=`<p class="small muted" style="margin:0">${t("hud.scoreHelp")}</p>`+lv.map((x,i)=>{const p=PTS(x.score),d=prev[x.id]!=null?p-prev[x.id]:null;
   return `<div class="score-row ${x.id==="player"?"me":""}" style="--c:${cssColor(x.civ?.chartColor)}"><span class="pos">${ord(i+1)}</span><span>${x.civ?civLabel(x.civ):escapeHtml(x.name)}${x.civ&&x.id!=="player"?` <span class="muted small">· ${escapeHtml(profileLabel(x.civ))}</span>`:""}</span><span class="pts"><strong>${p}</strong>${i>0?` <span class="gap">−${top-p}</span>`:""}${d?` <span class="trend ${d>0?"up":"down"}">${d>0?"↑":"↓"}${Math.abs(d)}</span>`:""}</span></div>`}).join("")
}
export const PTS=x=>Math.round(1000*x);   // pontos mostrados ao jogador (1000 = desempenho de referência)
// Placar atual: pontuação final calculada com os dados do fim da última era (civilizações ativas).
export function liveScores(){const e=state.timeline.at(-1);if(!e)return null;const act=e.civs.filter(r=>r.active!==false&&getCiv(state,r.id)?.active);if(!act.length)return null;
 return finalScores(act.map(r=>({id:r.id,dims:r.dims})),e.era,configApplied).map(x=>({...x,name:x.id==="player"?t("civ.youObj"):civDisplayName(getCiv(state,x.id))||x.id,civ:getCiv(state,x.id)})).sort((a,b)=>b.score-a.score)}
