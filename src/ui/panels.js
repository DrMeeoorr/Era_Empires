// Painéis: gráficos, histórico, previsão, eventos, condições de vitória e tela de resultado.
import {state,configApplied} from "../app/session.js";
import {DIFFICULTIES,mapSizeOf} from "../core/config.js";
import {infraReturn,techReturn} from "../core/economy.js";
import {territorialMinimum,territoryBase,finalScores,describeResult,supremacyMinEra} from "../core/endgame.js";
import {countTerritories} from "../core/map.js";
import {P,getCiv,aiCivs} from "../core/state.js";
import {clamp} from "../core/util.js";
import {svgLine} from "./charts.js";
import {$} from "./dom.js";
import {cssColor,escapeHtml,fmt,money,ord} from "./format.js";
import {getLanguage,t} from "../i18n/index.js";
import {startNewGame} from "./game.js";
import {liveScores,PTS} from "./hud.js";
import {isSheetOpen,closeSheet} from "./sheets.js";
import {civLabel,profileLabel,civSymHtml,civDisplayName,diffName,engineText,resultSentence} from "./labels.js";
import {resultMedalsHtml} from "./medals.js";
import {unlimitedCapFor} from "./mapshape.js";
import {victoryOn,applyVictoryVisibility,VICTORY_NAMES} from "./victories.js";
import {fillGdRules,discoveryPanelHtml,wonderPanelHtml,racePlayerPoints} from "./discovery.js";

// Lista "a e b" no idioma (end.and).
const joinAnd=l=>l.join(t("end.and"));
export function chartData(key){return state.history.map(r=>({x:r.era,y:r[key]||0}))}
export function renderCharts(){
 if(!$("details").open)return;
 const tl=state.timeline,xo={xLabel:t("hud.era")};svgLine($("revenueChart"),[{data:chartData("normal"),color:"#62a8ff"},{data:chartData("infra"),color:"#56d6a1"},{data:chartData("tech"),color:"#b49aff"}],xo);
 const perCiv=key=>state.civs.map((c,k)=>({color:c.chartColor,data:tl.map(e=>({x:e.era,y:e.civs[k]?.[key]||0}))}));
 svgLine($("territoryChart"),perCiv("territories"),xo);svgLine($("militaryChart"),perCiv("military"),xo);
 const legend=state.civs.map(c=>`<span style="--c:${cssColor(c.chartColor)}">${civLabel(c)}</span>`).join("");$("territoryLegend").innerHTML=legend;$("militaryLegend").innerHTML=legend;
}
export function renderHistory(){
 const h=state.history;$("historyCount").textContent=h.length;
 $("historyTable").innerHTML=h.slice(-150).reverse().map(r=>`<tr><td>${escapeHtml(r.era)}</td><td>${fmt(r.total,2)}</td><td>${fmt(r.militaryInvested||0,2)}</td><td>${fmt(r.infraInvested||0,2)}</td><td>${fmt(r.techInvested||0,2)}</td><td>${fmt(r.budget,2)}</td><td>${escapeHtml(r.territories)}</td><td>${fmt(r.military,1)}</td></tr>`).join("");
 const last=state.pending?.revenue?.player||h.at(-1),tot=Math.max(1,last?.total||0);
 $("revenueBreakdown").innerHTML=[[t("details.lands"),last?.normal||0,"#62a8ff","blue"],[t("res.works"),last?.infra||0,"#56d6a1","green"],[t("res.science"),last?.tech||0,"#b49aff","purple"]].map(([n,v,c,cl])=>`<div class="row between" style="margin-top:6px"><span class="muted">${n}</span><strong class="${cl}">${money(v)}</strong></div><div class="bar"><span style="width:${100*v/tot}%;background:${c}"></span></div>`).join("");
}
export function renderForecast(){
 const era=state.era;let infra=[],tech=[];
 for(let t=1;t<=12;t++){let e=era+t,ir=0,tr=0;for(const inv of state.investments){if(inv.owner!=="player")continue;if(inv.type==="infrastructure")ir+=infraReturn(inv,e-inv.origin);if(inv.type==="technology")tr+=techReturn(state,inv,e)}infra.push(ir);tech.push(tr)}
 $("forecast").innerHTML=`<div class="log-item"><strong class="gold">${t("res.military")}</strong><p class="small muted">${t("details.fcMil",{n:fmt(P(state).military,1)})}</p></div><div class="log-item"><strong class="green">${t("res.works")}</strong><p class="small muted">${t("details.fcWorks",{next:money(infra[0]||0),five:money(infra[4]||0)})}</p></div><div class="log-item"><strong class="purple">${t("res.science")}</strong><p class="small muted">${t("details.fcSci",{next:money(tech[0]||0),five:money(tech[4]||0)})}</p></div><div class="small muted">${t("details.fcOnlyMade")}</div>`;
}
export function renderNotifications(){const events=state.log.filter(x=>/ataque|conquist|repelid|falhou|eliminad/i.test(x.text)).slice(0,30);$("notificationCount").textContent=events.length;$("notifications").innerHTML=events.length?events.map(e=>`<div class="log-item"><strong>${t("details.eraN",{era:escapeHtml(e.era)})}</strong> · ${escapeHtml(engineText(e.text))}</div>`).join(""):`<div class="small muted">${t("details.noAttacks")}</div>`}
/* ── Condições de vitória e fim de partida ── */
export function renderVictory(){
 // Regras completas (Como jogar): o teto do Sem limite desta partida (depende do tamanho do mapa).
 fillGdRules();applyVictoryVisibility();
 document.querySelectorAll("[data-unl-cap]").forEach(el=>{el.textContent=String(state?.unlimited?state.maxEras:unlimitedCapFor(mapSizeOf(state)))});
 const s=state,cfg=configApplied,g=cfg.endgame;
 const last=s.timeline.at(-1),min=territorialMinimum(territoryBase(s),g.territoryPct),left=Math.max(0,s.maxEras-s.era+(s.pending?1:0));
 $("victoryPill").textContent=s.result?t("vic.ended"):s.unlimited?t("setup.sum.unlimited"):left===1?t("vic.lastEra"):t("vic.erasLeft",{n:String(left),count:left});
 const bar=(v,max,c)=>`<div class="bar" style="margin:3px 0 8px"><span style="width:${clamp(100*v/Math.max(1e-9,max),0,100)}%;background:${cssColor(c)}"></span></div>`;
 const domOn=victoryOn("dominion",s),supOn=victoryOn("supremacy",s),base=territoryBase(s);
 const terr=s.civs.map(c=>{const nT=countTerritories(s,c.id),elim=c.active?"":` <span class="red">· ${t("vic.eliminated")}</span>`;if(!domOn)return `<div class="row between small"><span>${civLabel(c)}${elim}</span><strong>${nT}</strong></div>${bar(nT,base,c.chartColor)}`;return `<div class="row between small"><span>${civLabel(c)}${c.id!=="player"?` <span class="muted">· ${escapeHtml(profileLabel(c))}</span>`:""}${elim}</span><strong>${nT} / ${min}</strong></div>${bar(nT,min,c.chartColor)}`}).join("");
 const sup=s.supremacy||{},row=id=>last?.civs.find(r=>r.id===id),ices=s.civs.filter(c=>c.active).map(c=>({c,ice:row(c.id)?.ice})).sort((a,b)=>(b.ice??-1)-(a.ice??-1));
 const statusTxt=sup.status==="notApplicable"?"—":sup.status==="gapTooSmall"?t("sup.gapTooSmall",{pct:fmt(100*g.supremacyRelative,0)}):sup.status==="notYet"?t("sup.notYet",{era:String(supremacyMinEra(s,cfg)),max:String(Math.floor(g.supremacyMaxNeutralShare*territoryBase(s)+1e-9)),now:String(countTerritories(s,"neutral"))}):["off","none","suspended","tiedLeadership","belowMinimum","counting"].includes(sup.status)?t("sup."+sup.status):"";
 const iceRows=ices.map(({c,ice})=>`<div class="row between small"><span>${civLabel(c)}${sup.leader===c.id?` <span class="gold">· ${t("sup.leader")}</span>`:""}</span><strong>${ice==null?"—":fmt(ice,2)}</strong></div>`).join("");
 // Domínio com escolha: o que acontece ao chegar a 70% (e, se o jogador decidiu continuar, o que falta para vencer no fim).
 const mineT=countTerritories(s,"player"),holding=!s.result&&!s.unlimited&&s.dominion?.declined&&mineT>=min;
 const domTxt=s.unlimited||!s.dominion?t("vic.domNow"):holding?t("vic.domHolding",{min:String(min),era:String(s.maxEras)}):t("vic.domChoice");
 // Tipos de vitória desligados nesta partida: o domínio vira só a contagem de regiões; a supremacia some (também nos
 // saves antigos do modo Conquista, que tinham supremacyEnabled=false).
 const offList=["dominion","supremacy","discovery","wonder"].filter(k=>(k==="discovery"||k==="wonder")?(s.mapSize>1&&!victoryOn(k,s)):!victoryOn(k,s));
 const offTxt=offList.length?`<div class="small muted vic-off" style="margin:0 0 6px">${t("vic.offList",{list:offList.map(k=>t("vic.name."+k)).join(", ")})}</div>`:"";
 const supHide=!supOn;
 $("victoryPanel").innerHTML=offTxt+(domOn?`<h3>${t("vic.majority",{min:String(min),total:String(territoryBase(s))})}</h3><div class="small muted" id="dominionRule" style="margin:-2px 0 6px">${domTxt}</div>`:`<h3>${t("vic.regions")}</h3>`)+`${terr}${discoveryPanelHtml()}${wonderPanelHtml()}
 ${supHide?"":`<h3>${t("vic.supTitle",{n:String(g.supremacyEras)})}</h3>${iceRows||`<div class="small muted">${t("vic.supLater")}</div>`}
 <div class="small" style="margin-top:6px">${t("vic.streak")} <strong class="gold">${sup.streak||0} / ${g.supremacyEras}</strong>${sup.leader?` (${sup.leader==="player"?t("civ.youObj"):escapeHtml(civDisplayName(getCiv(s,sup.leader)))})`:""}. <span class="muted">${statusTxt}</span></div>`}
 <h3>${s.unlimited?t("vic.scoreTitleUnl",{n:String(s.maxEras)}):t("vic.scoreTitle",{n:String(s.maxEras)})}</h3><div class="small muted">${s.unlimited?t("vic.scoreUnl",{n:String(s.maxEras)}):t("vic.scoreLimit")} ${t("vic.scoreWeights",{pct:fmt(100*g.scoreWTerritory,0)})}</div>${(()=>{const lv=liveScores();if(!lv)return "";const mx=Math.max(...lv.map(x=>x.score));return `<div class="small muted" style="margin:6px 0 2px">${t("vic.ifNow")}</div>`+lv.map((x,i)=>`<div class="row between small"><span>${x.civ?civLabel(x.civ):escapeHtml(x.name)}${i===0?` <span class="gold">· ${ord(1)}</span>`:""}</span><strong>${t("vic.pts",{n:String(PTS(x.score))})}</strong></div>${bar(x.score,mx,x.civ?.chartColor||"#888")}`).join("")})()}`;
 renderResult();
}
// Pontuação de cada civilização ao longo da partida (mesma fórmula da pontuação final).
export function scoreSeries(){return state.timeline.map(e=>{const rows=e.civs.map(r=>({id:r.id,dims:r.dims}));const sc=finalScores(rows,e.era,configApplied);return e.civs.map((r,k)=>r.active?sc[k].score:0)})}
export function advantageEra(winnerIdx,series){let lastNotLead=0;series.forEach((row,i)=>{const max=Math.max(...row);if(row[winnerIdx]<max-1e-9)lastNotLead=i+1});return lastNotLead+1}
// Tela de resultado (Fase 3): vitória/derrota em destaque, sua posição, 3 números e "Jogar de novo" / "Ver detalhes".
// Os gráficos, a tabela de pontos e os estilos dos rivais ficam na folha "Detalhes do resultado" (#resultSheet).
// Títulos e motivos (chaves end.title.*, end.why.*, end.lost.*): score, territorial, supremacy, elimination, discovery, wonder, both.
const END_KINDS=["score","territorial","supremacy","elimination","discovery","wonder","both"];
const END_TITLE=k=>END_KINDS.includes(k)?t("end.title."+k):null;
const END_WHY=k=>END_KINDS.includes(k)?t("end.why."+k):"";
// Vitórias que não dependem dos pontos (o subtítulo explica quando o vencedor não lidera os pontos).
const NO_POINTS_KINDS=["territorial","supremacy","elimination"];
const END_LOST=k=>["discovery","wonder","both"].includes(k)?n=>t("end.lost."+k,{name:n}):null;
const EMBLEM={won:`<svg viewBox="0 0 84 96" aria-hidden="true"><defs><linearGradient id="resG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08f"/><stop offset="1" stop-color="#d9962a"/></linearGradient></defs><path d="M42 4 78 16v30c0 24-16 38-36 46C22 84 6 70 6 46V16Z" fill="#14213a" stroke="url(#resG)" stroke-width="4"/><path d="M20 58h44l-4-22-10 9-8-15-8 15-10-9Z" fill="url(#resG)"/><rect x="20" y="62" width="44" height="6" rx="2" fill="url(#resG)"/></svg>`,
 lost:`<svg viewBox="0 0 84 96" aria-hidden="true"><path d="M42 4 78 16v30c0 24-16 38-36 46C22 84 6 70 6 46V16Z" fill="#1a1d2b" stroke="#7d8aa3" stroke-width="4"/><path d="M44 14 36 40l12 6-10 24 4 12" fill="none" stroke="#ff9aa1" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
 draw:`<svg viewBox="0 0 84 96" aria-hidden="true"><path d="M42 4 78 16v30c0 24-16 38-36 46C22 84 6 70 6 46V16Z" fill="#14213a" stroke="#9fb0c7" stroke-width="4"/><path d="M24 44h36M24 56h36" stroke="#ffd479" stroke-width="6" stroke-linecap="round"/></svg>`};
// Linhas do placar final: pontuação final (vitória por pontos) ou o placar da última era.
function finalRows(r){const rows=r.scores?r.scores.map(x=>({id:x.id,score:x.score,civ:getCiv(state,x.id)})):(liveScores()||[]);return rows.slice().sort((a,b)=>b.score-a.score)}
export function resultSummary(s=state){
 const r=s.result;if(!r)return null;
 const won=r.type==="victory"&&r.winners[0]==="player",drawn=r.type==="draw"&&r.winners.includes("player"),why=id=>{const l=r.reasons?.[id]||[],d=l.includes("discovery"),w=l.includes("wonder");return d&&w?"both":d?"discovery":w?"wonder":l[0]};
 const rows=finalRows(r),k=rows.findIndex(x=>x.id==="player"),pos=k>=0?k+1:null,me=k>=0?PTS(rows[k].score):null;
 const other=pos===1?rows[1]:rows[0],gap=me!=null&&other?me-PTS(other.score):null;
 const winner=r.type==="victory"?getCiv(s,r.winners[0]):null;
 let title,sub;
 // Domínio, supremacia e eliminação vencem sem olhar os pontos: quando o vencedor não é o 1.º nos pontos (ou o
 // jogador perde liderando os pontos), o subtítulo explica isso em vez de só dar a posição (que parecia contraditória).
 const g=configApplied.endgame,noLead={pct:Math.round(100*(g.territoryPct??0.7)),n:g.supremacyEras??5};
 if(won){title=END_TITLE(why("player"))||t("end.victory");const k=why("player"),explain=pos>1&&NO_POINTS_KINDS.includes(k);
  sub=(r.dominionKept?t("end.kept",{n:String(countTerritories(s,"player")),total:String(territoryBase(s))})+" ":"")+(explain?t(r.dominionKept&&k==="territorial"?"end.winNoLead.kept":"end.winNoLead."+k,noLead):pos?t("end.finished",{pos:ord(pos),n:String(rows.length)}):"")}
 else if(drawn||(r.type==="draw")){title=t("end.draw");sub=r.allEliminated?t("end.allEliminated"):t("end.drawBetween",{list:joinAnd(r.winners.map(id=>id==="player"?t("civ.youObj"):escapeHtml(civDisplayName(getCiv(s,id)))))})}
 else{title=!P(s).active?t("end.eliminated"):winner&&END_LOST(why(winner.id))?END_LOST(why(winner.id))(escapeHtml(civDisplayName(winner))):t("end.defeat");sub=!winner?"":pos===1&&NO_POINTS_KINDS.includes(why(winner.id))?t("end.lostLead."+why(winner.id),{...noLead,civ:civLabel(winner)}):t("end.winnerWon",{civ:civLabel(winner),why:END_WHY(why(winner.id))})+(pos?" "+t("end.youPlaced",{pos:ord(pos)}):"")}
 const terr=countTerritories(s,"player"),wins=s.history.at(-1)?.attacksTotal?.playerWins??0;
 const tiles=[{v:`${terr}<small>/${territoryBase(s)}</small>`,k:t("end.tile.lands")},gap==null?{v:me==null?"—":fmt(me,0),k:t("end.tile.points")}:{v:(gap>=0?"+":"−")+fmt(Math.abs(gap),0),k:gap>=0?(pos===1?t("end.tile.ahead"):t("end.tile.points")):t("end.tile.toFirst")},{v:fmt(wins,0),k:t("end.tile.conquests",{count:wins})}];
 // Partida decidida pela Grande Descoberta ou pela Maravilha: o 3.º número vira os seus pontos dessa corrida.
 {const all=Object.values(r.reasons||{}).flat(),race=all.includes("discovery")?"discovery":all.includes("wonder")?"wonder":null;
  if(race)tiles[2]={v:fmt(Math.floor(racePlayerPoints(race)),0),k:t(race==="discovery"?"end.tile.sciPts":"end.tile.worksPts")}}
 return {won,drawn,tone:won?"won":(drawn||r.type==="draw")?"draw":"lost",title,sub,rows,pos,tiles,era:r.era};
}
export function renderResult(){
 const s=state,b=$("resultBanner"),scr=$("resultScreen"),r=s.result;
 document.documentElement.classList.toggle("result-open",!!r);
 if(!r){scr.hidden=true;scr.innerHTML="";if(!P(s).active){b.className="notice error";b.innerHTML=t("end.banner",{era:escapeHtml(P(s).eliminatedEra)})}else{b.className="hidden";b.innerHTML=""}return}
 b.className="hidden";b.innerHTML="";
 const sm=resultSummary(s),max=Math.max(1,...sm.rows.map(x=>PTS(x.score)));
 if(scr.dataset.key!==String(r.era)+sm.title+getLanguage()||scr.hidden){
 scr.dataset.key=String(r.era)+sm.title+getLanguage();
 scr.className="result-screen "+sm.tone;
 scr.innerHTML=`<div class="res-inner"><div class="res-emblem">${EMBLEM[sm.tone]}</div><div class="sum-kicker">${t("end.kicker",{era:escapeHtml(sm.era)})}</div><h2 class="res-title" id="resultTitle">${sm.title}</h2><p class="res-sub">${sm.sub}</p>
 <div class="sum-score res-score"><div class="sum-score-h"><span>${t("end.finalScore")}</span><span>${t("end.tile.points")}</span></div>${sm.rows.map((x,i)=>`<div class="sum-row ${x.id==="player"?"me":""}"><span class="pos">${ord(i+1)}</span><span class="nm">${x.civ?civLabel(x.civ):escapeHtml(x.name||x.id)}</span><span class="bar"><i style="--w:${(100*PTS(x.score)/max).toFixed(1)}%;background:${cssColor(x.civ?.chartColor)}"></i></span><b>${fmt(PTS(x.score),0)}</b><span></span></div>`).join("")}</div>
 <div class="res-tiles">${sm.tiles.map(t=>`<div class="res-tile"><div class="v">${t.v}</div><div class="k">${t.k}</div></div>`).join("")}</div>
 ${resultMedalsHtml()}
 <div class="res-actions"><button type="button" id="newGameAfterEnd" class="primary res-again">${t("alloc.again")}</button><div class="res-two"><button type="button" id="seeDetails" data-open="resultSheet" aria-haspopup="dialog">${t("end.seeDetails")}</button><button type="button" id="resultHome">${t("menu.home")}</button></div></div></div>`;
 // A partida acabou: fecha a folha que estiver aberta (placar, detalhes...) para a tela de resultado ficar à vista.
 if(scr.hidden&&isSheetOpen()&&!isSheetOpen("resultSheet"))closeSheet({focus:false});
 scr.hidden=false;
 $("newGameAfterEnd").onclick=startNewGame;$("resultHome").onclick=()=>$("returnHome").click();
 }
 if(isSheetOpen("resultSheet"))renderResultDetails();
}
// Folha "Ver detalhes": frase completa, quem liderou, estilos dos rivais, gráficos e tabela de pontos.
export function renderResultDetails(){
 const s=state,r=s.result,box=$("resultDetailsBody");if(!r||!box)return;
 const series=scoreSeries(),wIdx=r.type==="victory"?s.civs.findIndex(c=>c.id===r.winners[0]):-1,advEra=wIdx>=0?advantageEra(wIdx,series):null;
 const advTxt=wIdx>=0?(advEra>r.era?"":wIdx===0?t("end.leadYou",{era:String(advEra)}):t("end.leadCiv",{civ:escapeHtml(civDisplayName(s.civs[wIdx])),era:String(advEra)})):"";
 const scoreTable=r.scores?`<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>${t("end.th.civ")}</th><th>${t("end.th.score")}</th><th>${t("res.force")}</th><th>${t("res.works")}</th><th>${t("res.science")}</th><th>${t("res.gold")}</th><th>${t("details.lands")}</th></tr></thead><tbody>${[...r.scores].sort((a,b)=>b.score-a.score).map(x=>`<tr><td>${getCiv(s,x.id)?civLabel(getCiv(s,x.id)):escapeHtml(x.id)}</td><td><strong>${PTS(x.score)}</strong></td>${["military","infrastructure","technology","treasury","territories"].map(d=>`<td>${fmt(100*(x.parts[d]??0),0)}%</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:"";
 const legend=s.civs.map(c=>`<span style="--c:${c.chartColor}">${civLabel(c)}</span>`).join("");
 box.innerHTML=`<p class="small">${escapeHtml(resultSentence(s,r,describeResult))} <span class="pill">${DIFFICULTIES[s.difficulty]?diffName(s.difficulty):diffName("medio")}</span></p>${advTxt?`<p class="small muted">${advTxt}</p>`:""}<p class="small muted">${t("end.styles")} ${aiCivs(s).map(c=>t(c.hiddenProfile?"end.playedAsRandom":"end.playedAs",{civ:`${civSymHtml(c)} <strong>${escapeHtml(civDisplayName(c))}</strong>`,style:escapeHtml(profileLabel(c,true))})).join(" · ")}.</p>
 <h3>${t("end.scoreOverTime")}</h3>${advEra&&advEra<=r.era?`<div class="small muted">${t("end.dashed")}</div>`:""}<canvas id="endScoreChart" class="chart" style="height:180px"></canvas><div class="chart-legend">${legend}</div>
 <h3>${t("details.landsPerEra")}</h3><canvas id="endTerrChart" class="chart" style="height:180px"></canvas><div class="chart-legend">${legend}</div>${scoreTable}
 <div class="actions" style="margin-top:12px"><button type="button" id="changeSettingsAfterEnd">${t("end.changeChoices")}</button></div>`;
 svgLine($("endScoreChart"),s.civs.map((c,k)=>({color:c.chartColor,data:series.map((row,i)=>({x:i+1,y:PTS(row[k])}))})),{markX:advEra&&advEra<=r.era?advEra:null,xLabel:t("hud.era")});
 svgLine($("endTerrChart"),s.civs.map((c,k)=>({color:c.chartColor,data:s.timeline.map(e=>({x:e.era,y:e.civs[k].territories}))})),{xLabel:t("hud.era")});
 $("changeSettingsAfterEnd").onclick=()=>{closeSheet({focus:false});window.openSetup&&window.openSetup(true)};
}
